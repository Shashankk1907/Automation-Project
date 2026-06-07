from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from contextlib import asynccontextmanager
import os

from app.database import init_db, insert_lead, get_all_leads, update_lead_status
from app.llm import get_lead_analysis
from app.schemas import LeadCreate, LeadUpdate, ClassifyRequest, ClassifyResponse, LeadResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the SQLite database table on startup
    init_db()
    yield

app = FastAPI(
    title="Lead Automation & Classification API",
    description="Automated lead processing backend for classifying leads and drafting personalized replies using LLMs.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend and local workflows
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Lead Automation API is running locally!"}

@app.post("/lead", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(lead: LeadCreate):
    try:
        # 1. Analyze lead message using LLM or local fallback rules
        analysis = get_lead_analysis(lead.message)
        
        # 2. Store lead and analysis details in the database
        db_lead = insert_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            source=lead.source,
            message=lead.message,
            classification=analysis.get("classification", "Warm"),
            suggested_reply=analysis.get("suggested_reply", "")
        )
        
        if not db_lead:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store the lead in database."
            )
            
        return db_lead
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

@app.get("/leads", response_model=List[LeadResponse])
def get_leads():
    try:
        return get_all_leads()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leads: {str(e)}"
        )

@app.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, lead_update: LeadUpdate):
    try:
        updated_lead = update_lead_status(lead_id, lead_update.status)
        if not updated_lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead with id {lead_id} not found."
            )
        return updated_lead
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead: {str(e)}"
        )

@app.post("/classify", response_model=ClassifyResponse)
def classify_message(request: ClassifyRequest):
    try:
        analysis = get_lead_analysis(request.message)
        return ClassifyResponse(
            classification=analysis.get("classification", "Warm"),
            suggested_reply=analysis.get("suggested_reply", "")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}"
        )
