"""
Resume Parser — extracts structured data from PDF/DOCX resumes using Gemini AI.
"""
import io
import json
import logging
from typing import Optional
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from google import genai
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text content from a PDF file."""
    reader = PdfReader(io.BytesIO(file_bytes))
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text content from a DOCX file."""
    doc = DocxDocument(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])


def extract_text_from_resume(file_bytes: bytes, filename: str) -> str:
    """Detect file type and extract text."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif lower.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    elif lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file format: {filename}. Supported: PDF, DOCX, TXT")


async def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """
    Parse a resume file into structured data using Gemini AI.
    
    Returns:
        dict with keys: name, email, phone, education, work_experience,
        skills, certifications, total_years_of_experience, summary
    """
    # Step 1: Extract raw text
    raw_text = extract_text_from_resume(file_bytes, filename)

    if not raw_text.strip():
        return {"error": "Could not extract text from resume", "raw_text": ""}

    # Step 2: Use Gemini to structure the data
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = f"""You are an expert resume parser. Extract structured information from the following resume text.

Return a JSON object with EXACTLY these keys:
{{
    "name": "Full name of the candidate",
    "email": "Email address or null",
    "phone": "Phone number or null",
    "location": "Location/city or null",
    "summary": "Brief professional summary (2-3 sentences)",
    "total_years_of_experience": <number or 0>,
    "education": [
        {{
            "degree": "Degree name",
            "institution": "University/School name",
            "year": "Graduation year or null",
            "field": "Field of study"
        }}
    ],
    "work_experience": [
        {{
            "title": "Job title",
            "company": "Company name",
            "duration": "e.g., Jan 2020 - Present",
            "years": <approximate years as number>,
            "description": "Brief description of role and responsibilities"
        }}
    ],
    "skills": ["skill1", "skill2", ...],
    "certifications": ["cert1", "cert2", ...],
    "languages": ["language1", ...]
}}

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.

RESUME TEXT:
{raw_text}
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        result_text = response.text.strip()

        # Clean up potential markdown code blocks
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
        if result_text.endswith("```"):
            result_text = result_text.rsplit("```", 1)[0]
        result_text = result_text.strip()

        parsed = json.loads(result_text)
        parsed["raw_text"] = raw_text[:2000]  # Store truncated raw text for reference
        return parsed

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        return {
            "error": "Failed to parse resume structure",
            "raw_text": raw_text[:2000],
            "skills": [],
            "total_years_of_experience": 0,
        }
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        return {
            "error": str(e),
            "raw_text": raw_text[:2000],
            "skills": [],
            "total_years_of_experience": 0,
        }
