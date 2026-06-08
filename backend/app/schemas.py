from pydantic import BaseModel, Field
from typing import Literal


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
    classification: str
    suggested_reply: str
    signals: list[str] = []


class LeadResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    source: str
    message: str
    classification: str
    suggested_reply: str
    signals: list[str] = []
    status: str
    created_at: str


class EmailSendRequest(BaseModel):
    to_email: str = Field(..., description="Recipient email address")
    to_name: str = Field(..., description="Recipient name for personalisation")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Plain-text email body")


class EmailSendResponse(BaseModel):
    success: bool
    message: str
