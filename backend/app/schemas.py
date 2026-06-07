from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal

class LeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(...)
    phone: str = Field(...)
    source: str = Field(...)
    message: str = Field(..., min_length=1)

class LeadUpdate(BaseModel):
    status: Literal["New", "Contacted"]

class ClassifyRequest(BaseModel):
    message: str = Field(..., min_length=1)

class ClassifyResponse(BaseModel):
    classification: Literal["Hot", "Warm", "Cold"]
    suggested_reply: str

class LeadResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    source: str
    message: str
    classification: str
    suggested_reply: str
    status: str
    created_at: str
