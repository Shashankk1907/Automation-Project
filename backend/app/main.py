from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging

from app.database import init_db, insert_lead, get_all_leads, update_lead_status, get_lead_by_email_and_message
from app.llm import get_lead_analysis
from app.schemas import LeadCreate, LeadUpdate, ClassifyRequest, ClassifyResponse, LeadResponse, EmailSendRequest, EmailSendResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure leads.json exists on startup
    init_db()
    yield


app = FastAPI(
    title="Lead Automation & Classification API",
    description="Automated lead processing backend for classifying leads and drafting personalised replies using LLMs.",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend and local workflows
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "LeadFlow AI API is running (JSON storage)!"}


@app.post("/lead", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(lead: LeadCreate):
    try:
        # 0. Check if lead already exists to avoid redundant LLM calls
        existing = get_lead_by_email_and_message(lead.email, lead.message)
        if existing:
            return existing

        # 1. Classify via LLM
        analysis = get_lead_analysis(lead.message)

        # 2. Persist lead in JSON store
        db_lead = insert_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            source=lead.source,
            message=lead.message,
            classification=analysis.get("classification", "Warm"),
            suggested_reply=analysis.get("suggested_reply", ""),
            signals=analysis.get("signals", []),
        )

        if not db_lead:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store the lead.",
            )

        return db_lead
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}",
        )


@app.get("/leads", response_model=list[LeadResponse])
def get_leads():
    try:
        return get_all_leads()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leads: {str(e)}",
        )


@app.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, lead_update: LeadUpdate):
    try:
        updated_lead = update_lead_status(lead_id, lead_update.status)
        if not updated_lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead with id {lead_id} not found.",
            )
        return updated_lead
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead: {str(e)}",
        )


@app.post("/classify", response_model=ClassifyResponse)
def classify_message(request: ClassifyRequest):
    try:
        analysis = get_lead_analysis(request.message)
        return ClassifyResponse(
            classification=analysis.get("classification", "Warm"),
            suggested_reply=analysis.get("suggested_reply", ""),
            signals=analysis.get("signals", []),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}",
        )


@app.post("/send-email", response_model=EmailSendResponse)
def send_email(request: EmailSendRequest):
    """
    Send a real email from the configured Gmail account to the lead's email address.
    Requires GMAIL_ADDRESS and GMAIL_APP_PASSWORD to be set in .env.
    """
    gmail_address = os.getenv("GMAIL_ADDRESS")
    gmail_app_password = os.getenv("GMAIL_APP_PASSWORD")

    if not gmail_address or not gmail_app_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GMAIL_ADDRESS or GMAIL_APP_PASSWORD is not configured in the backend .env file.",
        )

    try:
        # Build MIME message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = request.subject
        msg["From"] = f"LeadFlow AI <{gmail_address}>"
        msg["To"] = request.to_email

        # Plain-text part
        text_part = MIMEText(request.body, "plain", "utf-8")

        # HTML part — wraps the plain text in a clean email card
        html_body = f"""
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
          <p style="color:#111827;font-size:14px;line-height:1.7;white-space:pre-wrap;">{request.body}</p>
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0;">
          <p style="color:#9ca3af;font-size:11px;">Sent via LeadFlow AI &mdash; automated lead management.</p>
        </div>
        """
        html_part = MIMEText(html_body, "html", "utf-8")

        msg.attach(text_part)
        msg.attach(html_part)

        # Send via Gmail SMTP with STARTTLS
        context = ssl.create_default_context()
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(gmail_address, gmail_app_password)
            server.sendmail(gmail_address, request.to_email, msg.as_string())

        logger.info(f"Email sent to {request.to_email} re: '{request.subject}'")
        return EmailSendResponse(success=True, message=f"Email sent to {request.to_email}")

    except smtplib.SMTPAuthenticationError:
        logger.error("Gmail SMTP authentication failed — check GMAIL_APP_PASSWORD in .env")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Gmail authentication failed. Check your GMAIL_APP_PASSWORD in backend/.env.",
        )
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )
