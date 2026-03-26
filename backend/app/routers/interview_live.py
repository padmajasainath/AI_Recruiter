"""
Gemini Multimodal Live API Router (Multimodal Audio Version)
"""
import asyncio
import base64
import json
import logging
import uuid
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from google.genai import Client
import google.genai.types as types
from app.schemas.interview import InterviewPublicResponse

from app.database import get_db, engine, Base
from app.models import Interview, Application, Job
from app.config import get_settings
from app.services.interview_ai_service import analyze_interview_transcript
from app.services.sharepoint_service import upload_interview_file_to_sharepoint

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

# In-memory storage for active sessions
active_sessions: Dict[str, "GeminiLiveSession"] = {}

def get_system_instruction(candidate_name: str, custom_prompt: Optional[str] = None) -> str:
    """Generates the system instruction for the Gemini Live session."""
    if custom_prompt:
        persona_and_instructions = custom_prompt
    else:
        persona_and_instructions = f"You are Alex, an expert AI Technical Interviewer. You are interviewing {candidate_name} for a technical role. Be professional but encouraging."
    
    vision_instruction = "You have VISUAL AWARENESS. You can see the candidate through their webcam if they have it turned on. You can acknowledge their surroundings, their expressions, or anything they show you. Use this to make the interview feel more personal and interactive."
    
    # System Framework for technical stability
    framework = "You are in a LIVE VOICE interaction. Keep responses short and conversational. Do not use markdown."
    
    instruction_text = f"{persona_and_instructions}\n\n{vision_instruction}\n\n{framework}"
    return instruction_text

class GeminiLiveSession:
    """Manages a single Multimodal Live session with Gemini."""
    
    def __init__(self, interview_id: str, candidate_name: str, api_key: str, custom_prompt: Optional[str] = None):
        self.interview_id = interview_id
        self.candidate_name = candidate_name
        self.custom_prompt = custom_prompt
        self.client = Client(api_key=api_key)
        self.model = "models/gemini-2.5-flash-native-audio-latest"
        self.session = None
        self._receive_task = None
        self._audio_count = 0
        
    async def connect(self):
        """Initialize the Gemini Live session."""
        try:
            # We use the context manager version to ensure cleanup
            print(f"GEMINI_DEBUG: Connecting to {self.model} via client.aio.live", flush=True)
            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=types.Content(
                    parts=[types.Part(text=get_system_instruction(self.candidate_name, self.custom_prompt))]
                )
            )
            
            # Using the 2026 aio sub-module for async connection
            self._session_context = self.client.aio.live.connect(model=self.model, config=config)
            self.session = await self._session_context.__aenter__()
            logger.error(f"GEMINI_DEBUG: Connected to {self.model}")
            return True
        except Exception as e:
            logger.error(f"GEMINI_DEBUG: Connection failure: {e}")
            return False

    async def send_audio(self, audio_data: bytes):
        """Send audio bytes to Gemini using the correct realtime_input schema."""
        if self.session:
            try:
                self._audio_count += 1
                if self._audio_count % 50 == 0:
                    logger.error(f"GEMINI_DEBUG: Pushing audio chunk {self._audio_count}")
                
                await self.session.send(
                    input=types.Blob(data=audio_data, mime_type="audio/pcm")
                )
            except Exception as e:
                logger.error(f"GEMINI_DEBUG_ERROR: Audio send failed: {e}")

    async def send_image(self, image_data: bytes):
        """Send image bytes (video frame) to Gemini."""
        if self.session:
            try:
                await self.session.send(
                    input=types.Blob(data=image_data, mime_type="image/jpeg")
                )
            except Exception as e:
                logger.error(f"GEMINI_DEBUG_ERROR: Image send failed: {e}")

    async def receive_responses(self):
        """Yield responses from Gemini."""
        if not self.session:
            logger.error("GEMINI_DEBUG: No session for receiver")
            return

        logger.error("GEMINI_DEBUG: Receiver loop active")
        try:
            while True:
                turn = self.session.receive()
                async for message in turn:
                    if message.setup_complete:
                        logger.error("GEMINI_DEBUG: Setup complete")
                        continue

                    content = message.server_content
                    if not content:
                        continue
                    
                    if content.model_turn:
                        for part in content.model_turn.parts:
                            if part.text:
                                logger.error(f"GEMINI_DEBUG: AI Text: {part.text[:20]}...")
                                yield {"type": "text", "text": part.text}
                            if part.inline_data and isinstance(part.inline_data.data, bytes):
                                # AI is speaking
                                yield {
                                    "type": "audio",
                                    "data": base64.b64encode(part.inline_data.data).decode("utf-8"),
                                    "mime_type": part.inline_data.mime_type or "audio/pcm"
                                }
                    
                    if content.turn_complete:
                        logger.error("GEMINI_DEBUG: AI turn finished")
                        yield {"type": "turn_complete"}
        except Exception as e:
            logger.error(f"GEMINI_DEBUG_ERROR: Receiver crashed: {e}")

    async def close(self):
        """Close the session."""
        if self.session:
            try:
                await self._session_context.__aexit__(None, None, None)
                logger.error("GEMINI_DEBUG: Session closed cleanup")
            except Exception as e:
                logger.error(f"GEMINI_DEBUG: Close error: {e}")

@router.get("/{token}/info", response_model=InterviewPublicResponse)
async def get_interview_info(token: str, db: Session = Depends(get_db)):
    """Get public information for an interview session (no auth required)."""
    interview = db.query(Interview).filter(Interview.interview_token == token).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    application = interview.application
    job = application.job if application else None
    
    return {
        "id": interview.id,
        "status": interview.status,
        "interview_type": interview.interview_type,
        "time_limit_minutes": interview.time_limit_minutes,
        "token_expires_at": interview.token_expires_at,
        "job_title": job.title if job else "Technical Engineer",
        "company_name": job.company.name if job and job.company else "AI Recruiter",
        "candidate_name": application.candidate_name if application else "Candidate"
    }

@router.post("/{token}/upload-recording")
async def upload_interview_recording(
    token: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Endpoint for the frontend to upload the interview recording blob."""
    interview = db.query(Interview).filter(Interview.interview_token == token).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    application = interview.application
    company = application.job.company if application and application.job else None
    
    if not application or not application.job:
        raise HTTPException(status_code=400, detail="Incomplete interview data")

    try:
        file_bytes = await file.read()
        filename = f"interview_recording_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.webm"
        
        # Upload to SharePoint
        sharepoint_id, web_url = await upload_interview_file_to_sharepoint(
            company_name=company.name if company else "AI Recruiter",
            job_title=application.job.title if application and application.job else "General Role",
            candidate_email=application.candidate_email if application else "unknown",
            filename=filename,
            file_bytes=file_bytes,
            content_type=file.content_type,
            company=company
        )
        
        # Update interview record
        interview.recording_url = sharepoint_id
        interview.recording_web_url = web_url
        interview.recording_status = "UPLOADED"
        db.add(interview)
        db.commit()
        
        logger.error(f"LIVE_WS: Recording uploaded to SharePoint for interview {interview.id}")
        return {"status": "success", "sharepoint_id": sharepoint_id}
        
    except Exception as e:
        logger.error(f"LIVE_WS_ERROR: Recording upload failed: {e}")
        interview.recording_status = "FAILED"
        db.add(interview)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/{token}/live")
async def live_interview_websocket(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    """The live interview WebSocket endpoint."""
    # Find the interview
    interview = db.query(Interview).filter(Interview.interview_token == token).first()
    if not interview:
        await websocket.close(code=1008, reason="Invalid interview token")
        return

    application = interview.application
    job = application.job if application else None
    
    await websocket.accept()
    logger.error(f"LIVE_WS: Connected candidate {application.candidate_name if application else 'Unknown'}")

    # Prepare context
    context = {
        "candidate_name": application.candidate_name if application else "Candidate",
        "job_title": job.title if job else "Position",
        "company_name": job.company.name if job and job.company else "the company",
        "system_prompt": f"You are Alex, an expert AI Technical Interviewer at {job.company.name if job and job.company else 'the company'}. You are interviewing {application.candidate_name if application else 'Raj'} for the {job.title if job else 'Engineer'} role. Be professional but encouraging."
    }

    # Initialize Gemini session
    gemini_session = GeminiLiveSession(
        interview_id=str(interview.id),
        candidate_name=application.candidate_name if application else "Candidate",
        api_key=settings.GEMINI_API_KEY,
        custom_prompt=job.ai_interview_prompt if job else None
    )
    
    if not await gemini_session.connect():
        await websocket.send_json({"type": "error", "message": "Failed to connect to AI engine"})
        await websocket.close()
        return

    # Tracking for transcript
    current_transcript = []
    
    # Set start time if not already set (e.g., first connection)
    if not interview.started_at:
        interview.started_at = datetime.utcnow()
        db.add(interview)
        db.commit()
        db.refresh(interview)
        logger.error(f"LIVE_WS: Interview started at {interview.started_at}")
    
    async def send_greeting():
        """Send a polite immediate greeting to start the interaction."""
        await asyncio.sleep(1.5)
        try:
            logger.error("GEMINI_DEBUG: Triggering greeting")
            await gemini_session.session.send(
                input=f"The candidate {application.candidate_name} has just connected. Please greet them by name, state you are here to conduct their engineer interview, and ask your first question. Say 'ALEX_HAS_AWAKENED' at the start.",
                end_of_turn=True
            )
        except Exception as e:
            logger.error(f"GEMINI_DEBUG: Greeting failed: {e}")

    async def receive_from_client():
        """Handle incoming mic audio from browser."""
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "audio":
                    # Add user audio to transcript (placeholder)
                    current_transcript.append({"role": "user", "content": "[User speaking...]", "timestamp": datetime.utcnow().isoformat()})
                    await websocket.send_json({"type": "transcript_update", "transcript": current_transcript})
                    audio_bytes = base64.b64decode(data["data"])
                    await gemini_session.send_audio(audio_bytes)
                elif msg_type == "image":
                    # Vision frame from candidate
                    image_bytes = base64.b64decode(data["data"])
                    await gemini_session.send_image(image_bytes)
                elif msg_type == "text":
                    # User typed something
                    current_transcript.append({"role": "user", "content": data.get("text", ""), "timestamp": datetime.utcnow().isoformat()})
                    await websocket.send_json({"type": "transcript_update", "transcript": current_transcript})
                elif msg_type == "end":
                    logger.error("LIVE_WS: Candidate ended session")
                    break
        except Exception as e:
            logger.error(f"LIVE_WS_ERROR: Client receive error: {e}")

    async def send_to_client():
        """Pipe Gemini responses back to browser."""
        try:
            turn_complete_count = 0
            async for response in gemini_session.receive_responses():
                # Forward to websocket
                await websocket.send_json(response)
                
                # If text, keep track for the final transcript
                if response["type"] == "text":
                    current_transcript.append({"role": "bot", "content": response["text"], "timestamp": datetime.utcnow().isoformat()})
                    # Send transcript update to frontend in real-time
                    await websocket.send_json({"type": "transcript_update", "transcript": current_transcript})
                
                # If audio, it's a complete response from Alex
                if response["type"] == "audio":
                    # Add a placeholder for the audio response if no text was added
                    if not any(item["role"] == "bot" and item.get("timestamp") == response.get("_timestamp") for item in current_transcript):
                        current_transcript.append({"role": "bot", "content": "[Alex responded]", "timestamp": datetime.utcnow().isoformat()})
                        await websocket.send_json({"type": "transcript_update", "transcript": current_transcript})
                
                # After turn complete, ensure we update
                if response["type"] == "turn_complete":
                    turn_complete_count += 1
                    # Only add if we haven't added anything yet this turn
                    if turn_complete_count == 1 and (not current_transcript or current_transcript[-1]["role"] != "bot"):
                        current_transcript.append({"role": "bot", "content": "[Alex responded]", "timestamp": datetime.utcnow().isoformat()})
                        await websocket.send_json({"type": "transcript_update", "transcript": current_transcript})
                    turn_complete_count = 0
        except Exception as e:
            logger.error(f"LIVE_WS_ERROR: Stream to client error: {e}")
        except Exception as e:
            logger.error(f"LIVE_WS_ERROR: Stream to client error: {e}")
        except Exception as e:
            logger.error(f"LIVE_WS_ERROR: Stream to client error: {e}")

    # Kick off greeting
    greeting_task = asyncio.create_task(send_greeting())
    
    # Run loops
    try:
        # We use wait with FIRST_COMPLETED so that if either the client disconnects 
        # or Gemini finishes, we can clean up immediately.
        done, pending = await asyncio.wait(
            [
                asyncio.create_task(receive_from_client()),
                asyncio.create_task(send_to_client())
            ],
            return_when=asyncio.FIRST_COMPLETED
        )
        # Cancel any remaining tasks
        for task in pending:
            task.cancel()
            
    except Exception as e:
        logger.error(f"LIVE_WS_ERROR: Main loop crashed: {e}")
    finally:
        greeting_task.cancel()
        await gemini_session.close()
        
        # Save transcript on exit - ALWAYS update status to COMPLETED if it was started
        try:
            # Re-fetch or use existing session to ensure we are in a clean state
            if current_transcript:
                interview.transcript = json.dumps(current_transcript)
            
            interview.status = 'COMPLETED'
            interview.completed_at = datetime.utcnow()
            
            db.add(interview)
            db.commit()
            logger.error(f"LIVE_WS: Interview {interview.id} marked COMPLETED. Transcript saved: {len(current_transcript) > 0}")
            
            # Kick off AI grading in the background only if we have a transcript
            if current_transcript:
                asyncio.create_task(analyze_interview_transcript(interview.id))
        except Exception as e:
            logger.error(f"LIVE_WS_ERROR: Final DB save failed: {e}")
            db.rollback()
