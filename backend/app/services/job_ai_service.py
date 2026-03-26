"""
AI Job Service — handles AI-powered job posting enhancements.
"""
import logging
from google import genai
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

async def generate_default_interview_prompt(title: str, description: str) -> str:
    """
    Use Gemini AI to generate a tailored interview persona and instructions
    based on the job title and description.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = f"""You are an expert technical recruiter and hiring manager. 
Create a detailed 'System Instruction' for an AI Interviewer who will conduct a live voice interview for the following role:

## ROLE DETAILS
- **Title**: {title}
- **Description**: {description}

## YOUR TASK
Generate a professional, role-specific persona and a set of instructions for the AI Interviewer.
The instructions should include:
1. **Persona**: Define a clear professional identity (e.g., "You are a Senior Frontend Engineer with 10 years of experience...").
2. **Interview Goal**: What should the AI focus on evaluating? (e.g., "Evaluate the candidate's deep understanding of React hooks and performance optimization").
3. **Key Topics**: Suggest 3-4 specific technical areas to probe based on the JD.
4. **Tone & Style**: (e.g., "Be collaborative but rigorous. Ask follow-up 'why' questions").

## CONSTRAINTS FOR THE GENERATED PROMPT
- Do NOT include technical rules like "keep responses short" or "no markdown" (these are added automatically by the system).
- Focus ONLY on the interviewer's persona, expertise, and specific role-based evaluation criteria.
- Limit the generated text to 2-3 concise paragraphs.

Return ONLY the generated instruction text. No preamble, no markdown formatting.
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        result_text = response.text.strip()
        
        # Clean up any potential markdown code blocks if the AI ignored instructions
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
        if result_text.endswith("```"):
            result_text = result_text.rsplit("```", 1)[0]
        
        return result_text.strip()

    except Exception as e:
        logger.error(f"Failed to generate AI interview prompt: {e}")
        # Robust fallback
        return f"You are an expert interviewer for the {title} role. Your goal is to evaluate the candidate's technical skills and cultural fit based on the following description: {description[:200]}..."
