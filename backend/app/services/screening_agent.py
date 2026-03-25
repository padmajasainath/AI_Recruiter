"""
AI Screening Agent — scores candidates against job requirements using Gemini AI.
Automatically triggers email when score meets threshold.
"""
import json
import logging
from datetime import datetime
from typing import Optional

from google import genai
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.candidate import Application
from app.models.job import Job
from app.services.resume_parser import parse_resume

logger = logging.getLogger(__name__)
settings = get_settings()


async def screen_candidate(
    application: Application,
    job: Job,
    resume_bytes: bytes,
    resume_filename: str,
    db: Session,
) -> dict:
    """
    Full screening pipeline:
    1. Parse resume → structured data
    2. Match against job requirements
    3. Score candidate (0-100)
    4. Update application record
    5. Trigger email if score >= threshold
    
    Returns the screening result dict.
    """
    # Update status to SCREENING
    application.status = "SCREENING"
    db.commit()

    # Step 1: Parse the resume
    parsed_resume = await parse_resume(resume_bytes, resume_filename)
    application.resume_parsed_data = parsed_resume

    if parsed_resume.get("error"):
        logger.warning(f"Resume parsing had issues: {parsed_resume['error']}")

    # Step 2: Score against JD using Gemini
    scoring_result = await _score_candidate(job, parsed_resume)

    # Step 3: Update application with results
    application.ai_score = scoring_result["score"]
    application.ai_reasoning = scoring_result["reasoning"]
    application.ai_skills_match = scoring_result["skills_match"]
    application.ai_experience_match = scoring_result["experience_match"]
    application.screened_at = datetime.utcnow()

    # Step 4: Determine status based on threshold
    if scoring_result["score"] >= job.screening_threshold:
        application.status = "SHORTLISTED"
    else:
        application.status = "REJECTED"

    db.commit()
    db.refresh(application)

    logger.info(
        f"Screened application {application.id}: "
        f"score={scoring_result['score']}, "
        f"threshold={job.screening_threshold}, "
        f"status={application.status}"
    )

    return scoring_result


async def _score_candidate(job: Job, parsed_resume: dict) -> dict:
    """Use Gemini AI to score a candidate against job requirements."""
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    skills_list = ", ".join(job.skills_required) if job.skills_required else "Not specified"
    candidate_skills = ", ".join(parsed_resume.get("skills", [])) if parsed_resume.get("skills") else "None extracted"

    prompt = f"""You are an expert AI recruitment screening agent. Score this candidate against the job requirements.

## JOB REQUIREMENTS:
- **Title**: {job.title}
- **Description**: {job.description}
- **Required Skills**: {skills_list}
- **Experience Required**: {job.years_of_experience_min}-{job.years_of_experience_max or 'any'} years
- **Location**: {job.location or 'Not specified'} ({job.location_type})

## CANDIDATE PROFILE:
- **Name**: {parsed_resume.get('name', 'Unknown')}
- **Summary**: {parsed_resume.get('summary', 'N/A')}
- **Total Experience**: {parsed_resume.get('total_years_of_experience', 0)} years
- **Skills**: {candidate_skills}
- **Education**: {json.dumps(parsed_resume.get('education', []))}
- **Work Experience**: {json.dumps(parsed_resume.get('work_experience', []))}
- **Certifications**: {json.dumps(parsed_resume.get('certifications', []))}

## SCORING CRITERIA:
1. **Skills Match (40%)**: How many required skills does the candidate have? Consider synonyms and related technologies.
2. **Experience Match (30%)**: Does the candidate meet the experience requirements?
3. **Education & Certifications (15%)**: Relevant education and certifications.
4. **Overall Fit (15%)**: How well does the candidate's background align with the JD?

Return a JSON object with EXACTLY these keys:
{{
    "score": <number 0-100>,
    "reasoning": "Detailed 3-5 sentence explanation of the score, covering strengths and gaps",
    "skills_match": {{
        "matched": ["skill1", "skill2"],
        "missing": ["skill3"],
        "extra": ["additional_skill1"],
        "score_component": <number 0-40>
    }},
    "experience_match": {{
        "required_min": {job.years_of_experience_min},
        "required_max": {job.years_of_experience_max or 'null'},
        "candidate_years": {parsed_resume.get('total_years_of_experience', 0)},
        "match": true/false,
        "score_component": <number 0-30>
    }},
    "recommendation": "STRONG_YES" | "YES" | "MAYBE" | "NO"
}}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks.
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        result_text = response.text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
        if result_text.endswith("```"):
            result_text = result_text.rsplit("```", 1)[0]
        result_text = result_text.strip()

        result = json.loads(result_text)

        # Ensure score is within bounds
        result["score"] = max(0, min(100, float(result.get("score", 0))))

        return result

    except Exception as e:
        logger.error(f"Scoring failed: {e}")
        return {
            "score": 0,
            "reasoning": f"Automated scoring failed: {str(e)}. Manual review required.",
            "skills_match": {"matched": [], "missing": list(job.skills_required or []), "extra": [], "score_component": 0},
            "experience_match": {
                "required_min": job.years_of_experience_min,
                "required_max": job.years_of_experience_max,
                "candidate_years": parsed_resume.get("total_years_of_experience", 0),
                "match": False,
                "score_component": 0,
            },
            "recommendation": "NO",
        }
