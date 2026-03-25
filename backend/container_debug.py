"""
Live Interview WebSocket Router
Proxies audio between the candidate's browser and Gemini Live Audio API.
Adapts the proven pattern from DataGenius.
"""

import asyncio
import base64
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks, HTTPException
from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.interview import Interview
from app.models.job import Job
from app.models.candidate import Application
from app.services.interview_ai_service import analyze_interview_transcript
from app.schemas.interview import InterviewPublicResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interview", tags=["Live Interview"])


@router.get("/{token}/info", response_model=InterviewPublicResponse)
async def get_interview_info(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Get interview and job info using the secure token.
    Used for the candidate welcome screen.
    """
    interview = db.query(Interview).filter(Interview.interview_token == token).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found or link is invalid")

    # Check expiry
    if interview.token_expires_at < datetime.utcnow():
        if interview.status != "EXPIRED":
            interview.status = "EXPIRED"
            db.commit()
        raise HTTPException(status_code=403, detail="This interview link has expired")

    # Get application and job info
    application = interview.application
    job = application.job
    company = job.company

    return {
        "id": interview.id,
        "status": interview.status,
        "interview_type": interview.interview_type,
        "time_limit_minutes": interview.time_limit_minutes,
        "token_expires_at": interview.token_expires_at,
        "job_title": job.title,
        "company_name": company.name,
        "candidate_name": application.candidate_name,
    }


class GeminiLiveSession:
    """Manages a live audio session with Gemini."""
    
    def __init__(self, api_key: str, context: dict):
        self.api_key = api_key
        self.context = context
        self.client: Optional[genai.Client] = None
        self.session = None
        self._is_connected = False
        self._session_context = None

    async def connect(self) -> bool:
        """Initialize connection to Gemini Live API."""
        try:
            self.client = genai.Client(api_key=self.api_key)
            
            # Construct system instruction from JD and Resume
            job_title = self.context.get("job_title", "Position")
            job_desc = self.context.get("job_description", "")
            candidate_name = self.context.get("candidate_name", "Candidate")
            resume_summary = self.context.get("resume_summary", "")
            
            system_instruction = f"""You are Alex, an expert AI Technical Interviewer for a company. 
You are conducting a live voice interview with {candidate_name} for the {job_title} role.

JOB DESCRIPTION:
{job_desc}

CANDIDATE BACKGROUND:
{resume_summary}

YOUR GOAL:
1. Conduct a professional, 20-30 minute technical and behavioral interview.
2. Start by introducing yourself and asking the candidate to introduce themselves.
3. Ask 8-12 questions in total, ranging from technical skills relevant to the JD to behavioral situations.
4. Listen carefully to the candidate's audio responses.
5. Ask follow-up questions based on their specific answers.
6. If the candidate is stuck, provide a small hint and move on.
7. Be encouraging but maintain high professional standards.

GUIDELINES:
- Keep your responses concise (2-3 sentences max) to maintain a natural conversation flow.
- Focus on how their past experience (from the background provided) maps to the job requirements.
- At the end, thank the candidate and tell them the interview is complete.
- Do NOT output any internal monologues, thoughts, or actions in asterisks (e.g., **Initiating...**).
- Speak directly to the candidate at all times.
- Your text output must exactly match what you speak out loud. No action descriptions.
"""
            
            config = {
                "response_modalities": ["AUDIO"],
                "system_instruction": system_instruction,
            }
            
            # Connect to Gemini 2.0 Flash (Multimodal Live)
            # Using the native-audio-preview model as per DataGenius
            # Note: 2.0 Flash also supports this now, but specifying the one known to work with live audio
            session_context = self.client.aio.live.connect(
                model="gemini-2.5-flash-native-audio-latest", # Using latest supported live multimodal model
                config=config
            )
            
            self.session = await session_context.__aenter__()
            self._session_context = session_context
            self._is_connected = True
            
            logger.info(f"Connected to Gemini Live API for {candidate_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Gemini Live API: {e}")
            return False

    async def send_audio(self, audio_data: bytes) -> None:
        """Send audio data to Gemini."""
        if not self.session:
            return
        try:
            await self.session.send(
                input={"mime_type": "audio/pcm", "data": audio_data}
            )
        except Exception as e:
            logger.error(f"Error sending audio to Gemini: {e}")

    async def receive_responses(self):
        """Generator yielding responses from Gemini."""
        if not self.session:
            return
        try:
            async for response in self.session.receive():
                if response.server_content and response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            yield {
                                "type": "audio",
                                "data": base64.b64encode(part.inline_data.data).decode(),
                                "mime_type": "audio/pcm"
                            }
                        elif part.text:
                            yield {
                                "type": "text",
                                "text": part.text
                            }
                
                if response.server_content and getattr(response.server_content, "turn_complete", False):
                    yield {"type": "turn_complete"}
        except Exception as e:
            logger.error(f"Error receiving from Gemini: {e}")
            yield {"type": "error", "message": str(e)}

    async def close(self):
        """Close Gemini session."""
        if self._session_context:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error closing Gemini session: {e}")
        self._is_connected = False


@router.websocket("/{token}/live")
async def live_interview_websocket(
    websocket: WebSocket,
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for candidate voice interview.
    Authenticates via token and relays audio to Gemini.
    """
    await websocket.accept()
    
    # 1. Validate Token
    interview = db.query(Interview).filter(Interview.interview_token == token).first()
    if not interview:
        await websocket.send_json({"type": "error", "message": "Invalid interview token"})
        await websocket.close()
        return

    if interview.token_expires_at < datetime.utcnow():
        await websocket.send_json({"type": "error", "message": "Interview link has expired"})
        await websocket.close()
        return

    if interview.status == "COMPLETED":
        await websocket.send_json({"type": "error", "message": "Interview already completed"})
        await websocket.close()
        return

    # 2. Get Context
    application = interview.application
    job = application.job
    
    context = {
        "job_title": job.title,
        "job_description": job.description,
        "candidate_name": application.candidate_name,
        "resume_summary": application.ai_reasoning, # Use screening reasoning as summary
    }

    # 3. Connect to Gemini
    settings = get_settings()
    gemini_session = GeminiLiveSession(settings.GEMINI_API_KEY, context)
    
    success = await gemini_session.connect()
    if not success:
        await websocket.send_json({"type": "error", "message": "Failed to connect to AI service"})
        await websocket.close()
        return

    # Update status to IN_PROGRESS
    interview.status = "IN_PROGRESS"
    if not interview.started_at:
        interview.started_at = datetime.utcnow()
    db.commit()

    await websocket.send_json({"type": "connected"})
    
    # Track transcript for persistence (updated locally and periodically synced or synced at end)
    # For now, we'll sync at turn_complete to avoid data loss
    current_transcript = interview.transcript or []
    current_bot_text = ""

    async def receive_from_client():
        """Handle incoming messages from browser."""
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                logger.info(f"WS RAW MESSAGE RECEIVED. Type: {msg_type}")
                
                # Handle audio chunks from the frontend
                if msg_type == "audio":
                    audio_bytes = base64.b64decode(data["data"])
                    logger.info(f"Received audio chunk of {len(audio_bytes)} bytes from frontend")
                    await gemini_session.send_audio(audio_bytes)
                    logger.info("Successfully handed off audio chunk to Gemini session")
                elif msg_type == "text":
                    # Optional text support
                    user_text = data.get("text", "")
                    # Log user text (if any)
                    nonlocal current_transcript
                    current_transcript.append({
                        "role": "user",
                        "content": user_text,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                elif msg_type == "end":
                        logger.info(f"Candidate {application.candidate_name} ended the session")
                        break
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for {application.candidate_name}")
        except Exception as e:
            logger.error(f"Error in receive_from_client: {e}")

    async def send_to_client():
        """Handle outgoing messages from Gemini to browser."""
        nonlocal current_bot_text, current_transcript
        try:
            async for response in gemini_session.receive_responses():
                await websocket.send_json(response)
                
                # Update transcript logic
                if response["type"] == "text":
                    current_bot_text += response["text"]
                elif response["type"] == "turn_complete":
                    if current_bot_text:
                        current_transcript.append({
                            "role": "bot",
                            "content": current_bot_text,
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        # Sync to DB
                        db.query(Interview).filter(Interview.id == interview.id).update({
                            "transcript": current_transcript,
                            "questions_asked": interview.questions_asked + 1 if current_bot_text else interview.questions_asked
                        })
                        db.commit()
                        current_bot_text = ""
        except Exception as e:
            logger.error(f"Error in send_to_client: {e}")

    # Trigger AI to introduce itself and start the interview
    try:
        await gemini_session.session.send(
            input=f"The candidate {application.candidate_name} has just connected. Please greet them by name, introduce yourself, and ask your first interview question.",
            end_of_turn=True
        )
    except Exception as e:
        logger.error(f"Failed to send initial prompt to Gemini: {e}")

    # Run tasks concurrently
    try:
        await asyncio.gather(
            receive_from_client(),
            send_to_client(),
            return_exceptions=True
        )
    finally:
        try:
            await websocket.send_json({"type": "completed"})
        except:
            pass
        await gemini_session.close()
        
        # Trigger post-interview analysis
        if current_transcript:
            background_tasks.add_task(analyze_interview_transcript, interview.id, db)
            
        try:
            await websocket.close()
        except:
            pass
