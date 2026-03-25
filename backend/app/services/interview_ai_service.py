"""
Interview AI Service
Analyzes interview transcripts using Gemini to generate scores and feedback.
"""

import json
import logging
from datetime import datetime
from google import genai
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.interview import Interview
from app.models.candidate import Application
from app.models.job import Job

logger = logging.getLogger(__name__)

async def analyze_interview_transcript(interview_id: str):
    """
    Use Gemini to analyze the completed interview transcript.
    Update the interview record with scores and analysis.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    db = SessionLocal()
    try:
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview or not interview.transcript:
            logger.warning(f"No transcript found for interview {interview_id}")
            return

        application = interview.application
        job = application.job
        
        # Format transcript for the prompt
        transcript_text = ""
        transcript_data = interview.transcript
        
        # Robustly handle transcript if it's a JSON string
        if isinstance(transcript_data, str):
            try:
                transcript_data = json.loads(transcript_data)
            except Exception:
                logger.error(f"Failed to parse transcript string for {interview_id}")
                return

        if not transcript_data:
            logger.warning(f"Empty transcript for interview {interview_id}")
            return

        for entry in transcript_data:
            # Handle potential different keys (role/speaker, content/text)
            role_val = entry.get("role") or entry.get("speaker", "unknown")
            content_val = entry.get("content") or entry.get("text", "")
            
            role = "Candidate" if role_val == "user" else "Interviewer (AI)"
            transcript_text += f"{role}: {content_val}\n\n"

        prompt = f"""You are an expert technical recruiter analyzing an interview transcript.
JOB TITLE: {job.title}
JOB DESCRIPTION:
{job.description}

INTERVIEW TRANSCRIPT:
{transcript_text}

TASK:
Analyze the transcript above and provide a detailed evaluation.
Return a JSON object with EXACTLY these keys:
{{
    "score": <number 0-100>,
    "summary": "2-3 sentence overview of performance",
    "strengths": ["strength1", "strength2", ...],
    "weaknesses": ["weakness1", "weakness2", ...],
    "improvements": ["tip1", "tip2", ...],
    "topics_covered": ["topic1", "topic2", ...],
    "feedback": "Detailed feedback for the recruiter"
}}

IMPORTANT: Return ONLY valid JSON.
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        result_text = response.text.strip()
        # Clean up potential markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()
            
        analysis = json.loads(result_text)
        
        # Update interview record
        interview.interview_score = analysis.get("score")
        interview.ai_summary = analysis.get("summary")
        interview.ai_strengths = analysis.get("strengths")
        interview.ai_weaknesses = analysis.get("weaknesses")
        interview.ai_improvements = analysis.get("improvements")
        interview.interview_topics = analysis.get("topics_covered")
        interview.interview_feedback = analysis.get("feedback")
        
        interview.status = "COMPLETED"
        interview.completed_at = datetime.utcnow()
        
        # Calculate duration roughly if not tracked perfectly
        if interview.started_at:
            delta = interview.completed_at - interview.started_at
            interview.interview_duration_minutes = int(delta.total_seconds() / 60)

        # Update application status
        application.status = "INTERVIEW_COMPLETED"
        
        db.commit()
        logger.info(f"Successfully analyzed interview {interview_id} for {application.candidate_name}")
        
    except Exception as e:
        logger.error(f"Failed to analyze transcript for {interview_id}: {e}")
        # traceback.print_exc()
        raise e
    finally:
        db.close()
