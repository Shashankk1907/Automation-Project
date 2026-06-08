import os
import json
import logging
import time
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")  # switch to "claude" if you have API key

SYSTEM_INSTRUCTION = """You are an AI lead categorization assistant. Analyze inbound lead messages and classify them.

Classification criteria:
- "Hot": Explicit project request, high intent, immediate need, budget mentioned, requests call/pricing, or high-value business opportunity.
- "Warm": General exploration, questions about services/pricing without immediate project, request for brochure, or interest in connecting/networking.
- "Cold": Spam, unsubscribe requests, simple greetings without context, or generic irrelevant messages.

Reply drafting guidelines:
- Draft a 1-2 sentence personalized, professional reply.
- For Hot leads: be proactive, express enthusiasm, suggest booking a call.
- For Warm leads: be helpful, answer briefly, offer to send more information.
- For Cold leads:
  - Simple greeting (e.g. "hi", "hello"): write a polite greeting back.
  - Spam / unsubscribe / irrelevant: return empty string "" for suggested_reply.

Also extract 2-3 short intent signals from the message (e.g. "pricing inquiry", "urgency mentioned", "demo request", "budget confirmed").

Respond ONLY in raw JSON — no markdown, no preamble:
{
  "classification": "Hot" | "Warm" | "Cold",
  "suggested_reply": "string or empty string",
  "signals": ["signal1", "signal2"]
}"""


def extract_json(text: str) -> dict:
    """Safely extract and parse JSON from a string that may contain markdown or preamble."""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(text[start:end + 1])
            if "classification" in data and "suggested_reply" in data:
                return data
    except Exception as e:
        logger.warning(f"JSON parse failed: {e} | Raw: {text[:100]}")
    return {}


def classify_lead_gemini(message: str, api_key: str) -> dict:
    """Call Gemini API with exponential backoff on rate limits."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    for attempt in range(5):
        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=f"{SYSTEM_INSTRUCTION}\n\nLead Message: {message}",
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            result = extract_json(response.text)
            if result:
                return result
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err or "503" in err or "UNAVAILABLE" in err:
                sleep_time = (2 ** attempt) * 4 + 2
                logger.warning(f"Gemini API busy or rate limited. Retrying in {sleep_time}s (attempt {attempt + 1}/5)")
                time.sleep(sleep_time)
            else:
                logger.error(f"Gemini API error: {e}")
                break
    return {}


def classify_lead_claude(message: str, api_key: str) -> dict:
    """Call Claude API (Anthropic). Drop-in swap for Gemini."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=SYSTEM_INSTRUCTION,
            messages=[{"role": "user", "content": f"Lead Message: {message}"}],
        )
        return extract_json(response.content[0].text)
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return {}


def get_lead_analysis(message: str) -> dict:
    """
    Classify a lead message using the configured LLM provider.
    Set LLM_PROVIDER=claude in .env to switch from Gemini to Claude.
    """
    if LLM_PROVIDER == "claude":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set in your environment.")
        logger.info("Classifying lead via Claude...")
        result = classify_lead_claude(message, api_key)
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in your environment.")
        logger.info("Classifying lead via Gemini...")
        result = classify_lead_gemini(message, api_key)

    if not result or "classification" not in result:
        # Return Unclassified so a human can review — don't silently drop to Cold
        logger.error(f"Classification failed for message: {message[:60]}...")
        return {
            "classification": "Unclassified",
            "suggested_reply": "",
            "signals": [],
            "error": True,
        }

    # Ensure signals key always exists even if LLM omits it
    result.setdefault("signals", [])
    return result