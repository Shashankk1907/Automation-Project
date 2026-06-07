import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leads.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except sqlite3.OperationalError:
        pass
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            source TEXT NOT NULL,
            message TEXT NOT NULL,
            classification TEXT NOT NULL,
            suggested_reply TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'New',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def insert_lead(name: str, email: str, phone: str, source: str, message: str, classification: str, suggested_reply: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if a lead with the same email and message already exists to prevent duplication
    cursor.execute("SELECT * FROM leads WHERE email = ? AND message = ?", (email, message))
    existing_row = cursor.fetchone()
    if existing_row:
        conn.close()
        return dict(existing_row)
        
    cursor.execute("""
        INSERT INTO leads (name, email, phone, source, message, classification, suggested_reply, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'New')
    """, (name, email, phone, source, message, classification, suggested_reply))
    lead_id = cursor.lastrowid
    conn.commit()
    
    # Fetch the inserted lead
    cursor.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}

def get_all_leads() -> list[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM leads ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_lead_status(lead_id: int, status: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE leads
        SET status = ?
        WHERE id = ?
    """, (status, lead_id))
    conn.commit()
    
    # Fetch updated lead
    cursor.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}
