import os
import json
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# System instructions for LLM
SYSTEM_INSTRUCTION = """You are an AI lead categorization assistant. Your job is to analyze inbound lead messages and classify them, and draft a short response.

Classification criteria:
- "Hot": Explicit project request, high intent, immediate need, budget mentioned, requests call/pricing, or high-value business opportunity.
- "Warm": General exploration, questions about services/pricing without immediate project, request for brochure, or interest in connecting/networking.
- "Cold": Spam, unsubscribe requests, simple greetings ("hello", "hi") without any context, or generic irrelevant messages.

Reply drafting guidelines:
- Draft a 1-2 sentence personalized, professional reply.
- For Hot leads, be proactive, express enthusiasm, and suggest booking a call or offering case studies.
- For Warm leads, be helpful, answer their question briefly, or offer to send information (like a brochure).
- For Cold leads:
  - If it is a simple greeting (like "hello", "hi"), write a polite greeting (e.g., "Hello! How can we assist you today?").
  - If it is spam, an unsubscribe request, or an irrelevant message where no reply should be sent, return an empty string "" for the suggested reply.

You MUST respond in JSON format with the following keys:
{
  "classification": "Hot" | "Warm" | "Cold",
  "suggested_reply": "drafted response or empty string"
}
Do not include any other text, markdown blocks, or commentary in your response. Output raw JSON only."""

def extract_json(text: str) -> dict:
    """Safely extracts and parses JSON from a string that might contain markdown blocks or preambles."""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            data = json.loads(json_str)
            if "classification" in data and "suggested_reply" in data:
                return data
    except Exception as e:
        logger.warning(f"Failed to parse extracted JSON: {e}. Raw text was: {text}")
    return {}

def classify_lead_gemini(message: str, api_key: str) -> dict:
    """Calls Gemini API using google-genai package with structured JSON request, retrying on 429 rate limits."""
    import time
    for attempt in range(5):
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            
            prompt = f"{SYSTEM_INSTRUCTION}\n\nLead Message: {message}"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            result = extract_json(response.text)
            if result:
                return result
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                # Calculate sleep with exponential backoff: 6s, 10s, 18s, 34s, etc.
                sleep_time = (2 ** attempt) * 4 + 2
                logger.warning(f"Gemini API rate limited (429). Retrying in {sleep_time}s... (Attempt {attempt+1}/5)")
                time.sleep(sleep_time)
            else:
                logger.error(f"Gemini API call failed: {e}")
                break
    return {}

def get_lead_analysis(message: str) -> dict:
    """Classifies a lead message entirely using the Gemini API."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        logger.error("GEMINI_API_KEY environment variable is not set.")
        raise ValueError("GEMINI_API_KEY environment variable is required. Please set it in your environment or .env file.")
        
    logger.info("Calling Gemini API for lead classification...")
    result = classify_lead_gemini(message, gemini_key)
    
    if not result or "classification" not in result or "suggested_reply" not in result:
        # Default fallback in case the API call failed entirely to prevent database constraint errors,
        # but logging it as an API failure.
        logger.error(f"Failed to get classification from Gemini for message: {message[:50]}...")
        return {
            "classification": "Cold",
            "suggested_reply": ""
        }
        
    return result
