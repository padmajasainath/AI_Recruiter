"""
Email Agent — sends emails via Microsoft Graph API (Outlook) and handles AI-powered replies.
Uses reply@cloudmetica.com as the sender.
Supports: outbound emails, inbound polling, manual replies, and auto-reply toggle.
"""
import json
import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
import msal
from google import genai
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.email_log import EmailLog
from app.models.candidate import Application
from app.models.job import Job
from app.models.company import Company

logger = logging.getLogger(__name__)
settings = get_settings()


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences (```html ... ```) that Gemini wraps around HTML output."""
    # Remove opening fence like ```html or ```
    text = re.sub(r'^\s*```(?:html)?\s*\n?', '', text, flags=re.IGNORECASE)
    # Remove closing fence
    text = re.sub(r'\n?\s*```\s*$', '', text)
    return text.strip()


def clean_reply_subject(subject: str) -> str:
    """Strip 'Re: ' prefixes and return the base subject."""
    if not subject:
        return "(No Subject)"
    # Regex to strip one or more "Re:" prefixes (case-insensitive, optional spaces)
    cleaned = re.sub(r'^(?i:Re\s*:\s*)+', '', subject).strip()
    return cleaned


def _get_graph_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    """Acquire an access token for Microsoft Graph API using client credentials."""
    app = msal.ConfidentialClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        client_credential=client_secret,
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise Exception(f"Failed to acquire Graph token: {result.get('error_description', 'Unknown error')}")
    return result["access_token"]


async def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    application_id: str,
    db: Session,
    company: Optional[Company] = None,
    reply_to: Optional[str] = None,
    ai_generated: bool = True,
) -> dict:
    """Send an email via Microsoft Graph API and log it."""
    # Prioritize company-specific credentials
    tenant_id = (company.outlook_tenant_id if company else None) or settings.OUTLOOK_TENANT_ID
    client_id = (company.outlook_client_id if company else None) or settings.OUTLOOK_CLIENT_ID
    client_secret = (company.outlook_client_secret if company else None) or settings.OUTLOOK_CLIENT_SECRET
    sender = (company.outlook_sender_email if company else None) or settings.OUTLOOK_SENDER_EMAIL

    if not all([tenant_id, client_id, client_secret, sender]):
        logger.warning(f"Outlook integration not configured for company {company.name if company else 'unknown'}")
        raise Exception("Outlook integration not configured for this company")

    token = _get_graph_token(tenant_id, client_id, client_secret)

    # Build the email payload
    message = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body_html,
            },
            "toRecipients": [
                {"emailAddress": {"address": to_email}}
            ],
        },
        "saveToSentItems": True,
    }

    if reply_to:
        message["message"]["replyTo"] = [
            {"emailAddress": {"address": reply_to}}
        ]

    # 1. Create the message
    async with httpx.AsyncClient() as client:
        create_res = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{sender}/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=message["message"], # Graph /messages wants the inner message object
        )

    if create_res.status_code not in (200, 201):
        logger.error(f"Email creation failed: {create_res.status_code} - {create_res.text}")
        raise Exception(f"Failed to create email draft: {create_res.text}")

    msg_data = create_res.json()
    graph_msg_id = msg_data.get("id")
    conversation_id = msg_data.get("conversationId")

    # 2. Send the created message
    async with httpx.AsyncClient() as client:
        send_res = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{graph_msg_id}/send",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

    if send_res.status_code not in (200, 202):
        logger.error(f"Email send failed: {send_res.status_code} - {send_res.text}")
        raise Exception(f"Failed to send email: {send_res.text}")

    # Log the email with the captured conversation_id
    # CRITICAL: We do NOT store graph_msg_id here because it is a DRAFT ID which expires after sending.
    # We leave message_id as None and let the poll_inbox fill it in with the permanent Sent ID.
    email_log = EmailLog(
        application_id=application_id,
        direction="OUTBOUND",
        subject=subject,
        body=body_html,
        from_email=sender,
        to_email=to_email,
        ai_generated=ai_generated,
        message_id=None, # Will be filled by poll_inbox
        conversation_id=conversation_id,
        sent_at=datetime.utcnow(),
    )
    db.add(email_log)
    db.commit()

    logger.info(f"Email sent to {to_email} for application {application_id} (ConvID: {conversation_id})")
    return {"status": "sent", "to": to_email, "conversation_id": conversation_id}


async def send_manual_email(
    application_id: str,
    subject: Optional[str],
    body_html: str,
    db: Session,
    parent_message_id: Optional[str] = None,
) -> dict:
    """Send a manually-composed email. Uses threading if parent_message_id is provided."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise Exception(f"Application {application_id} not found")

    if parent_message_id:
        # Send as a REPLY to an existing message
        return await send_reply(
            message_id=parent_message_id,
            comment=body_html,
            application_id=application_id,
            db=db,
            ai_generated=False
        )
    else:
        # Start a NEW thread
        return await send_email(
            to_email=application.candidate_email,
            subject=subject or f"Update regarding your application for {application.job.title if application.job else ''}",
            body_html=body_html,
            application_id=application_id,
            db=db,
            reply_to=settings.OUTLOOK_SENDER_EMAIL,
            ai_generated=False,
        )


async def send_reply(
    message_id: str,
    comment: str,
    application_id: str,
    db: Session,
    company: Optional[Company] = None,
    ai_generated: bool = False,
) -> dict:
    """Reply to an existing email thread using Microsoft Graph API."""
    # Prioritize company-specific credentials
    tenant_id = (company.outlook_tenant_id if company else None) or settings.OUTLOOK_TENANT_ID
    client_id = (company.outlook_client_id if company else None) or settings.OUTLOOK_CLIENT_ID
    client_secret = (company.outlook_client_secret if company else None) or settings.OUTLOOK_CLIENT_SECRET
    sender = (company.outlook_sender_email if company else None) or settings.OUTLOOK_SENDER_EMAIL

    if not all([tenant_id, client_id, client_secret, sender]):
        raise Exception("Outlook integration not configured for this company")

    token = _get_graph_token(tenant_id, client_id, client_secret)

    # Check if we have a conversation_id for this message or if the message_id is a conversation_id itself
    cid = None
    email_log = db.query(EmailLog).filter(
        (EmailLog.message_id == message_id) | (EmailLog.conversation_id == message_id)
    ).first()
    
    if email_log:
        cid = email_log.conversation_id
    elif message_id.startswith("AAQk"): # Looks like a conversation ID
        cid = message_id

    target_id = message_id

    if cid:
        logger.info(f"Resolving latest message for conversation {cid}")
        async with httpx.AsyncClient() as client:
            # We try to find the latest message in this conversation across folders
            res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{sender}/messages",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "$filter": f"conversationId eq '{cid}'",
                    "$top": 10,
                    "$select": "id,receivedDateTime,sentDateTime",
                },
            )
            
            msgs = []
            if res.status_code == 200:
                msgs = res.json().get("value", [])
            
            # Also check sent items specifically as it sometimes doesn't appear in the general messages list immediately
            sent_res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{sender}/mailFolders/sentitems/messages",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "$filter": f"conversationId eq '{cid}'",
                    "$top": 10,
                    "$select": "id,sentDateTime",
                },
            )
            if sent_res.status_code == 200:
                msgs.extend(sent_res.json().get("value", []))

            if msgs:
                # Pick the one with the latest date
                msgs.sort(key=lambda x: x.get("receivedDateTime") or x.get("sentDateTime") or "", reverse=True)
                target_id = msgs[0]["id"]
                logger.info(f"Resolved latest message ID: {target_id} for conversation {cid}")

    # If target_id still looks like a conversation ID (starts with AAQk), 
    # and we couldn't resolve it to a message ID (starts with AAMk), 
    # we should ABORT with a specific message.
    if target_id.startswith("AAQk") and not target_id.startswith("AAMk"):
         logger.warning(f"Could not resolve conversation ID {target_id} to a message ID.")
         raise Exception("The thread is still synchronizing with Outlook. Please click 'Sync' in a moment then try again to ensure a threaded reply.")

    # Load application to get candidate email
    application = db.query(Application).filter(Application.id == application_id).first()
    candidate_email = application.candidate_email if application else None

    if not candidate_email:
        logger.error(f"Cannot reply: No candidate email found for application {application_id}")
        raise Exception("Candidate email not found")

    # 1. Create a reply draft
    async with httpx.AsyncClient() as client:
        # We use createReply which returns a draft message
        create_res = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{target_id}/createReply",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            # We will patch the body ourselves to ensure full HTML styling stays intact
            json={},
        )
        if create_res.status_code not in (200, 201):
            logger.error(f"Failed to create reply draft: {create_res.status_code} - {create_res.text}")
            raise Exception(f"Failed to create reply draft: {create_res.text}")
        
        draft = create_res.json()
        draft_id = draft["id"]

        # 2. Update the draft to ensure IT GOES TO THE CANDIDATE
        # This fixes the issue where replying to our own message sends it back to us
        logger.info(f"Patching draft {draft_id} for recipient {candidate_email}")
        patch_res = await client.patch(
            f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{draft_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "body": {
                    "contentType": "html",
                    "content": comment
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": candidate_email
                        }
                    }
                ]
            },
        )
        if patch_res.status_code != 200:
            logger.error(f"Failed to patch reply recipients: {patch_res.status_code} - {patch_res.text}")
            # Raise here so we don't send to wrong person
            raise Exception(f"Failed to set recipient for reply: {patch_res.text}")
        
        logger.info(f"Draft patched successfully. Sending now...")

        # 3. Send the draft
        send_res = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{draft_id}/send",
            headers={"Authorization": f"Bearer {token}"},
        )
        if send_res.status_code not in (200, 202):
            logger.error(f"Failed to send reply draft: {send_res.status_code} - {send_res.text}")
            raise Exception(f"Failed to send reply email: {send_res.text}")
        
        logger.info(f"Email sent successfully as a reply to {target_id}")

    # Fetch the actual subject from the target message to log it accurately
    logged_subject = "Re: (Conversation)"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{target_id}",
                headers={"Authorization": f"Bearer {token}"},
                params={"$select": "subject"},
            )
            if res.status_code == 200:
                raw_subject = res.json().get("subject", "")
                logged_subject = clean_reply_subject(raw_subject)
    except Exception as e:
        logger.warning(f"Could not fetch subject for logging: {e}")

    # Log the outbound email
    email_log = EmailLog(
        application_id=application_id,
        direction="OUTBOUND",
        subject=logged_subject,
        body=comment,
        from_email=sender,
        to_email=candidate_email,
        ai_generated=ai_generated,
        sent_at=datetime.utcnow(),
        conversation_id=target_id if target_id.startswith("AAQk") else cid
    )
    db.add(email_log)
    db.commit()

    return {"status": "replied", "target_id": target_id}


async def send_interview_scheduling_email(
    application: Application,
    job: Job,
    db: Session,
) -> dict:
    """Send an email inviting the candidate to schedule an AI interview."""
    company_name = job.company.name if job.company else "The hiring team"

    subject = f"Great news! Next steps for {job.title} at {company_name}"

    body_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations, {application.candidate_name}!</h1>
        </div>
        
        <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; line-height: 1.6;">
                We've reviewed your application for the <strong>{job.title}</strong> position at 
                <strong>{company_name}</strong>, and we're impressed with your background!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
                We'd love to move forward with the next step — an <strong>AI-led technical interview</strong>.
                This is a live, conversational interview conducted by our AI system that evaluates your 
                skills in a fair and structured way.
            </p>
            
            <h2 style="color: #667eea; font-size: 18px;">What to expect:</h2>
            <ul style="font-size: 15px; line-height: 1.8;">
                <li>⏱️ Duration: approximately 30-45 minutes</li>
                <li>💻 Topics related to: {', '.join(job.skills_required[:5]) if job.skills_required else 'the role requirements'}</li>
                <li>🎙️ Live audio-based conversation with our AI interviewer</li>
                <li>📊 Immediate feedback and scoring</li>
            </ul>
            
            <p style="font-size: 16px; line-height: 1.6;">
                <strong>Please reply to this email with your availability</strong> for the next 5-7 business days, 
                and we'll send you a link to schedule your interview.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
                Feel free to reply with any questions — we're here to help!
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            
            <p style="font-size: 13px; color: #718096;">
                This email was sent by the AI Recruitment team at {company_name}.
                Reply directly to this email for assistance.
            </p>
        </div>
    </div>
    """

    return await send_email(
        to_email=application.candidate_email,
        subject=subject,
        body_html=body_html,
        application_id=application.id,
        db=db,
        company=job.company,
        reply_to=settings.OUTLOOK_SENDER_EMAIL,
    )


async def send_rejection_email(
    application: Application,
    job: Job,
    db: Session,
) -> dict:
    """Send a professional rejection email to the candidate."""
    company_name = job.company.name if job.company else "The hiring team"

    subject = f"Update regarding your application for {job.title} at {company_name}"

    body_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #f8fafc; padding: 32px; border-radius: 12px 12px 0 0; border: 1px solid #e2e8f0; border-bottom: none;">
            <h1 style="color: #475569; margin: 0; font-size: 24px;">Update regarding your application</h1>
        </div>
        
        <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi {application.candidate_name.split()[0]},
            </p>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Thank you for taking the time to apply for the <strong>{job.title}</strong> position at <strong>{company_name}</strong>.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Our team has carefully reviewed your application and background. While your skills are impressive, 
                we have decided to move forward with other candidates whose experience more closely aligns with 
                our current needs for this specific role.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We genuinely appreciate your interest in joining {company_name}. We'll keep your profile in our 
                talent pool and will reach out if a future opening matches your expertise.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
                We wish you the very best in your job search and future professional endeavors.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            
            <p style="font-size: 13px; color: #718096;">
                The Recruitment Team at {company_name}<br/>
                Reply directly to this email if you have any questions.
            </p>
        </div>
    </div>
    """

    return await send_email(
        to_email=application.candidate_email,
        subject=subject,
        body_html=body_html,
        application_id=application.id,
        db=db,
        company=job.company,
        reply_to=settings.OUTLOOK_SENDER_EMAIL,
    )


async def poll_inbox(db: Session) -> list[dict]:
    """
    Poll multiple company inboxes (if configured) for new messages from candidates.
    Matches inbound emails to applications and processes them.
    Returns list of processed messages across all companies.
    """
    # 1. Get all companies that have Outlook configured (or at least one for global fallback)
    companies = db.query(Company).all()
    
    # If no companies found, try global settings only
    if not companies:
        logger.warning("No companies found in DB, skipping inbox polling")
        return []

    processed_overall = []

    for comp in companies:
        tenant_id = comp.outlook_tenant_id or settings.OUTLOOK_TENANT_ID
        client_id = comp.outlook_client_id or settings.OUTLOOK_CLIENT_ID
        client_secret = comp.outlook_client_secret or settings.OUTLOOK_CLIENT_SECRET
        sender = comp.outlook_sender_email or settings.OUTLOOK_SENDER_EMAIL

        if not all([tenant_id, client_id, client_secret, sender]):
            continue

        logger.info(f"Polling inbox for company {comp.name} ({sender})")
        try:
            token = _get_graph_token(tenant_id, client_id, client_secret)

            # Get messages from the last 24 hours that haven't been processed
            since = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://graph.microsoft.com/v1.0/users/{sender}/messages",
                    headers={"Authorization": f"Bearer {token}"},
                    params={
                        "$filter": f"receivedDateTime ge {since} and isDraft eq false",
                        "$orderby": "receivedDateTime desc",
                        "$top": 50,
                        "$select": "id,from,toRecipients,subject,bodyPreview,body,receivedDateTime,isRead,conversationId",
                    },
                )

            if response.status_code != 200:
                logger.error(f"Failed to poll inbox for {sender}: {response.status_code} - {response.text}")
                continue

            messages = response.json().get("value", [])
            processed = []

            for msg in messages:
                from_email = msg.get("from", {}).get("emailAddress", {}).get("address", "")
                subject = msg.get("subject", "")
                body_text = msg.get("bodyPreview", "") or msg.get("body", {}).get("content", "")
                msg_id = msg.get("id", "")
                conversation_id = msg.get("conversationId", "")
                
                if from_email.lower() == sender.lower():
                    continue

                existing = db.query(EmailLog).filter(EmailLog.message_id == msg_id).first()
                if existing:
                    continue

                application = None
                existing_thread = db.query(EmailLog).filter(EmailLog.conversation_id == conversation_id).first()
                if existing_thread:
                    application = db.query(Application).filter(Application.id == existing_thread.application_id).first()
                
                if not application:
                    application = db.query(Application).filter(
                        Application.candidate_email == from_email
                    ).order_by(Application.created_at.desc()).first()

                if not application:
                    continue

                inbound_log = EmailLog(
                    application_id=application.id,
                    direction="INBOUND",
                    subject=subject,
                    body=body_text,
                    from_email=from_email,
                    to_email=sender,
                    ai_generated=False,
                    message_id=msg_id,
                    conversation_id=conversation_id,
                )
                db.add(inbound_log)
                db.commit()

                job = application.job
                if comp.auto_reply_enabled:
                    await _generate_and_send_ai_reply(
                        application=application,
                        job=job,
                        subject=subject,
                        body_text=body_text,
                        db=db,
                        parent_message_id=msg_id
                    )
                    processed.append({
                        "from": from_email,
                        "subject": subject,
                        "application_id": application.id,
                        "action": "auto_replied",
                    })
                else:
                    processed.append({
                        "from": from_email,
                        "subject": subject,
                        "application_id": application.id,
                        "action": "logged_only",
                    })

                try:
                    async with httpx.AsyncClient() as client:
                        await client.patch(
                           f"https://graph.microsoft.com/v1.0/users/{sender}/messages/{msg_id}",
                            headers={
                                "Authorization": f"Bearer {token}",
                                "Content-Type": "application/json",
                            },
                            json={"isRead": True},
                        )
                except Exception as e:
                    logger.warning(f"Failed to mark message as read: {e}")

            # ─── 2. Update Sent Items' IDs ───
            async with httpx.AsyncClient() as client:
                sent_res = await client.get(
                    f"https://graph.microsoft.com/v1.0/users/{sender}/mailFolders/sentitems/messages",
                    headers={"Authorization": f"Bearer {token}"},
                    params={
                        "$filter": f"sentDateTime ge {since}",
                        "$orderby": "sentDateTime desc",
                        "$top": 50,
                        "$select": "id,toRecipients,subject,conversationId,sentDateTime",
                    },
                )
            if sent_res.status_code == 200:
                sent_msgs = sent_res.json().get("value", [])
                for smsg in sent_msgs:
                    sid = smsg.get("id")
                    scid = smsg.get("conversationId")
                    to_list = smsg.get("toRecipients", [{}])
                    to_email = to_list[0].get("emailAddress", {}).get("address", "") if to_list else ""

                    if db.query(EmailLog).filter(EmailLog.message_id == sid).first():
                        continue

                    unidentified = db.query(EmailLog).filter(
                        EmailLog.direction == "OUTBOUND",
                        EmailLog.to_email == to_email,
                        EmailLog.conversation_id == scid,
                        EmailLog.message_id == None
                    ).order_by(EmailLog.sent_at.asc()).first()
                    
                    if unidentified:
                        unidentified.message_id = sid
                        db.commit()

            processed_overall.extend(processed)
        except Exception as e:
            logger.error(f"Error polling inbox for {comp.name}: {e}")

    return processed_overall


async def _generate_and_send_ai_reply(
    application: Application,
    job: Job,
    subject: str,
    body_text: str,
    db: Session,
    parent_message_id: Optional[str] = None
) -> Optional[dict]:
    """Generate an AI reply using Gemini and send it. Uses threading if parent_message_id provided."""
    # Get conversation history for context
    email_history = db.query(EmailLog).filter(
        EmailLog.application_id == application.id
    ).order_by(EmailLog.sent_at).all()

    history_text = "\n".join([
        f"[{log.direction}] {log.subject}: {log.body[:800]}"
        for log in email_history[-5:]
    ])

    company_name = job.company.name if job.company else "the company"

    # Use Gemini to generate a reply
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    skills_str = ', '.join(job.skills_required[:10]) if job.skills_required else 'Not specified'
    job_description_summary = (job.description[:1500] + '...') if job.description and len(job.description) > 1500 else (job.description or 'Not available')

    prompt = f"""You are a professional, friendly recruitment assistant for {company_name}.

A candidate has replied to an email about their application for the "{job.title}" position.

## Job Details (ONLY use these to answer SPECIFIC questions):
- Title: {job.title}
- Location: {job.location or 'Not specified'}
- Skills Required: {skills_str}
- Description: {job_description_summary}

## Email History:
{history_text}

## Latest Reply from Candidate:
Subject: {subject}
Body: {body_text}

## Application Status: {application.status}

## Instructions:
1. **BE CONCISE**: Focus on replying to what the candidate just said. Do NOT repeat yourself if information was already shared in the history.
2. **NO JD DUMPING**: Do NOT include details from the Job Description unless the candidate SPECIFICALLY asked a question about the role's responsibilities or requirements. If they are just saying thanks or sharing availability, don't mention the JD at all.
3. **Conversational Flow**: If the candidate is sharing availability, acknowledge it warmly and let them know you'll send a scheduling link soon.
4. **Specific Questions**: If they have questions about the interview process, answer it simply: It's an AI-led live technical interview, ~30-45 minutes, covering skills relevant to the role.
5. **Format**: Do NOT include a greeting (e.g. "Hi John") or a sign-off. These are added automatically.
6. **No Attachments**: You CANNOT attach files. Include all necessary info in the text if (and only if) requested.

Generate ONLY the reply message as plain text paragraphs. No HTML, no greeting, no sign-off.
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        reply_text = _strip_code_fences(response.text.strip())

        # Convert plain text paragraphs to HTML paragraphs
        paragraphs = [p.strip() for p in reply_text.split('\n') if p.strip()]
        body_paragraphs_html = ''.join([
            f'<p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px;">{p}</p>'
            for p in paragraphs
        ])

        branded_title = f"{job.title} at {company_name}"

        # Wrap in the branded email template (matches the initial interview invitation)
        reply_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">{branded_title}</h1>
        </div>

        <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px;">
                Hi {application.candidate_name.split()[0]},
            </p>

            {body_paragraphs_html}

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 12px;">
                Feel free to reply with any questions — we're here to help!
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

            <p style="font-size: 13px; color: #718096;">
                AI Recruitment Team at {company_name}<br/>
                Reply directly to this email for assistance.
            </p>
        </div>
    </div>
    """

        if parent_message_id:
            # Send as a REPLY to maintain threading
            result = await send_reply(
                message_id=parent_message_id,
                comment=reply_html,
                application_id=application.id,
                db=db,
                company=job.company,
                ai_generated=True
            )
        else:
            # Fallback to starting a new thread (e.g. if we somehow lost the parent ID)
            result = await send_email(
                to_email=application.candidate_email,
                subject=clean_reply_subject(subject),
                body_html=reply_html,
                application_id=application.id,
                db=db,
                company=job.company,
            )

        return result

    except Exception as e:
        logger.error(f"Error generating email reply: {e}")
        return None


async def handle_inbound_email(
    from_email: str,
    subject: str,
    body_text: str,
    db: Session,
) -> Optional[dict]:
    """
    Process an inbound email reply from a candidate (webhook path).
    Uses Gemini AI to understand the intent and generate an appropriate response.
    """
    application = db.query(Application).filter(
        Application.candidate_email == from_email
    ).order_by(Application.created_at.desc()).first()

    if not application:
        logger.warning(f"Inbound email from unknown candidate: {from_email}")
        return None

    # Log the inbound email
    inbound_log = EmailLog(
        application_id=application.id,
        direction="INBOUND",
        subject=subject,
        body=body_text,
        from_email=from_email,
        to_email=settings.OUTLOOK_SENDER_EMAIL,
        ai_generated=False,
    )
    db.add(inbound_log)
    db.commit()

    # Check auto-reply setting
    job = application.job
    company = job.company if job else None

    if company and not company.auto_reply_enabled:
        logger.info(f"Auto-reply disabled for {company.name}, email logged only")
        return {"status": "logged", "auto_reply": False}

    # Auto-reply with AI - USE THE INBOUND MSG ID
    return await _generate_and_send_ai_reply(
        application=application,
        job=job,
        subject=subject,
        body_text=body_text,
        db=db,
        parent_message_id=inbound_log.message_id
    )
async def send_interview_link_email(
    application: Application,
    job: Job,
    interview_token: str,
    db: Session,
) -> dict:
    """Send an email with the unique link to start the AI interview."""
    company_name = job.company.name if job.company else "The hiring team"
    
    # Get frontend URL from settings
    from app.config import get_settings
    frontend_url = get_settings().FRONTEND_URL
    interview_url = f"{frontend_url}/interview/{interview_token}"

    subject = f"Your AI Interview Link for {job.title} at {company_name}"

    body_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚀 Ready for your interview, {application.candidate_name.split()[0]}?</h1>
        </div>
        
        <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; line-height: 1.6;">
                Great news! You've been selected for the next stage of our process for the <strong>{job.title}</strong> role.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
                Your AI-led voice interview is now ready. You can complete this anytime in the next <strong>72 hours</strong>.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="{interview_url}" style="background: #667eea; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block;">Start AI Interview</a>
            </div>
            
            <h2 style="color: #667eea; font-size: 18px;">Quick Tips:</h2>
            <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 24px;">
                <li>🎤 Use a device with a working microphone (headphones recommended)</li>
                <li>🤫 Sit in a quiet environment</li>
                <li>⏱️ The session will take about 30 minutes</li>
                <li>🌐 Use a stable internet connection</li>
            </ul>
            
            <p style="font-size: 14px; color: #718096; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #667eea;">
                <strong>Note:</strong> This link is unique to you and will expire in 72 hours. Please do not share it with others.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            
            <p style="font-size: 13px; color: #718096;">
                The Recruitment Team at {company_name}<br/>
                Reply directly to this email if you encounter any technical issues.
            </p>
        </div>
    </div>
    """

    return await send_email(
        to_email=application.candidate_email,
        subject=subject,
        body_html=body_html,
        application_id=application.id,
        db=db,
        company=job.company,
        reply_to=settings.OUTLOOK_SENDER_EMAIL,
    )
