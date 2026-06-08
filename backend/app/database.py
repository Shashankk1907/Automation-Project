import json
import os
import threading
from datetime import datetime, timezone

LEADS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leads.json"
)

_lock = threading.Lock()


def _load() -> list[dict]:
    """Read and return the full leads list from disk."""
    if not os.path.exists(LEADS_FILE):
        return []
    try:
        with open(LEADS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save(leads: list[dict]) -> None:
    """Atomically write the leads list to disk."""
    tmp_path = LEADS_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, LEADS_FILE)


def _next_id(leads: list[dict]) -> int:
    """Return the next auto-increment ID."""
    if not leads:
        return 1
    return max(lead["id"] for lead in leads) + 1


def init_db() -> None:
    """Ensure leads.json exists on startup."""
    with _lock:
        if not os.path.exists(LEADS_FILE):
            _save([])


def insert_lead(
    name: str,
    email: str,
    phone: str,
    source: str,
    message: str,
    classification: str,
    suggested_reply: str,
    signals: list | None = None,
) -> dict:
    """
    Insert a new lead or return an existing one if (email, message) already exists.
    Returns the stored lead dict.
    """
    if signals is None:
        signals = []

    with _lock:
        leads = _load()

        # Deduplication check
        for lead in leads:
            if lead.get("email") == email and lead.get("message") == message:
                return lead

        new_lead = {
            "id": _next_id(leads),
            "name": name,
            "email": email,
            "phone": phone,
            "source": source,
            "message": message,
            "classification": classification,
            "suggested_reply": suggested_reply,
            "signals": signals,
            "status": "New",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        leads.append(new_lead)
        _save(leads)
        return new_lead


def get_lead_by_email_and_message(email: str, message: str) -> dict | None:
    """
    Return a lead dict if email and message match, otherwise None.
    """
    with _lock:
        leads = _load()
        for lead in leads:
            if lead.get("email") == email and lead.get("message") == message:
                return lead
    return None


def get_all_leads() -> list[dict]:
    """Return all leads sorted newest-first."""
    with _lock:
        leads = _load()
    return sorted(leads, key=lambda l: l.get("created_at", ""), reverse=True)


def update_lead_status(lead_id: int, status: str) -> dict:
    """
    Update the status field of a lead by id.
    Returns the updated lead dict, or an empty dict if not found.
    """
    with _lock:
        leads = _load()
        for lead in leads:
            if lead.get("id") == lead_id:
                lead["status"] = status
                _save(leads)
                return lead
    return {}
