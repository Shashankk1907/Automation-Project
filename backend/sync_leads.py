import os
import csv
import sys

# Import database and LLM helpers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import init_db, insert_lead
from app.llm import get_lead_analysis

SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/1JgIybKZbZivBrwwadILRo4px6LQLfbVIre7fireHFQ4/export?format=csv"


def clear_leads():
    """Overwrite leads.json with an empty list."""
    import json
    from app.database import LEADS_FILE
    print("Clearing all leads from leads.json...")
    with open(LEADS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)
    print("Cleared successfully.")


def main():
    # 1. Clear existing JSON store
    clear_leads()

    # Ensure file structure exists
    init_db()

    # 2. Fetch CSV from Google Sheet
    import requests
    print(f"Fetching Google Sheet CSV from: {SHEETS_CSV_URL}")
    try:
        response = requests.get(SHEETS_CSV_URL)
        if response.status_code != 200:
            print(f"Error: Failed to fetch CSV (HTTP {response.status_code})")
            sys.exit(1)
        response.encoding = "utf-8"   # Force UTF-8 — Google Sheets returns UTF-8 but requests may auto-detect as Latin-1
        csv_data = response.text
    except Exception as e:
        print(f"Error connecting to Google Sheets: {e}")
        sys.exit(1)

    # 3. Parse and insert leads
    lines = csv_data.strip().splitlines()
    reader = csv.DictReader(lines)

    leads_processed = 0
    leads_failed = 0

    for row in reader:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip()
        phone = row.get("phone", "").strip()
        source = row.get("source", "").strip()
        message = row.get("message", "").strip()

        if not name or not message:
            print(f"Skipping invalid/empty row: {row}")
            continue

        print(f"Processing lead: {name}...")
        try:
            analysis = get_lead_analysis(message)
            classification = analysis.get("classification", "Warm")
            suggested_reply = analysis.get("suggested_reply", "")
            signals = analysis.get("signals", [])

            db_lead = insert_lead(
                name=name,
                email=email,
                phone=phone,
                source=source,
                message=message,
                classification=classification,
                suggested_reply=suggested_reply,
                signals=signals,
            )
            if db_lead:
                print(f"  -> SUCCESS: Classified as '{classification}', signals: {signals}")
                leads_processed += 1
            else:
                print("  -> FAILED: Could not save to store")
                leads_failed += 1
        except Exception as e:
            print(f"  -> ERROR processing lead: {e}")
            leads_failed += 1

    print(f"\nSync finished! Processed: {leads_processed}, Failed: {leads_failed}")


if __name__ == "__main__":
    main()
