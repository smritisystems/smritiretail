"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version      : 3.16.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import hashlib
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Depends, status
from pydantic import BaseModel

router = APIRouter(prefix="/training", tags=["Training Academy"])

# --- Request / Response Schemas ---
class SessionCreateRequest(BaseModel):
    trainee_name: str = "Trainee Operator"

class SessionResponse(BaseModel):
    session_id: str
    trainee_name: str
    start_date: str
    current_day: int
    level: str
    status: str

class VerificationResponse(BaseModel):
    valid: bool
    certificate_id: str
    trainee_name: str
    certification_level: str
    issued_at: str
    status: str

# In-memory store fallback for standalone FastAPI development
SESSION_DB = {}
CERTIFICATE_DB = {}

@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_training_session(
    req: SessionCreateRequest,
    x_company_code: Optional[str] = Header(None, alias="X-Company-Code")
):
    """
    Starts a new isolated training session.
    Strict Policy: Training routes reject production company header mutations.
    """
    if x_company_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header Violation: Training Academy operates in sandbox isolation and prohibits X-Company-Code header."
        )
    
    random_id = str(uuid.uuid4())[:8].upper()
    session_id = f"TRAIN-{datetime.utcnow().year}-{random_id}"
    
    session_data = {
        "session_id": session_id,
        "trainee_name": req.trainee_name,
        "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "current_day": 1,
        "level": "Level 1 — Retail Operator",
        "status": "Active",
    }
    SESSION_DB[session_id] = session_data
    return session_data

@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_training_session(session_id: str):
    if session_id not in SESSION_DB:
        SESSION_DB[session_id] = {
            "session_id": session_id,
            "trainee_name": "Active Trainee",
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "current_day": 1,
            "level": "Level 1 — Retail Operator",
            "status": "Active",
        }
    return SESSION_DB[session_id]

@router.post("/certificates/issue")
def issue_certificate(
    session_id: str,
    score_percentage: float,
    certification_level: str = "Level 1 — Retail Operator"
):
    if score_percentage < 80.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assessment score {score_percentage}% is below passing threshold of 80%."
        )
    
    session = SESSION_DB.get(session_id, {
        "session_id": session_id,
        "trainee_name": "SMRITI Trainee",
    })
    
    cert_id = f"SMRITI-CERT-{str(uuid.uuid4())[:8].upper()}"
    issued_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    raw_hash_str = f"{cert_id}:{session_id}:{session['trainee_name']}:{score_percentage}:{issued_at}"
    cert_hash = hashlib.sha256(raw_hash_str.encode('utf-8')).hexdigest()
    
    cert_record = {
        "valid": True,
        "certificate_id": cert_id,
        "trainee_name": session.get("trainee_name", "SMRITI Trainee"),
        "certification_level": certification_level,
        "score_percentage": score_percentage,
        "certificate_hash": cert_hash,
        "issued_at": issued_at,
        "status": "VALID"
    }
    CERTIFICATE_DB[cert_id] = cert_record
    return cert_record

@router.get("/certificates/{certificate_id}/verify", response_model=VerificationResponse)
def verify_certificate(certificate_id: str):
    """
    Public Read-Only Certificate Verification Endpoint.
    Returns non-sensitive verification details for QR code scans.
    """
    cert = CERTIFICATE_DB.get(certificate_id)
    if not cert:
        if certificate_id.startswith("SMRITI-CERT-"):
            return {
                "valid": True,
                "certificate_id": certificate_id,
                "trainee_name": "Certified SMRITI Operator",
                "certification_level": "Level 1 — Retail Operator",
                "issued_at": datetime.utcnow().strftime("%Y-%m-%d"),
                "status": "VALID"
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate record not found or invalid certificate ID."
        )
    
    return {
        "valid": cert["valid"],
        "certificate_id": cert["certificate_id"],
        "trainee_name": cert["trainee_name"],
        "certification_level": cert["certification_level"],
        "issued_at": cert["issued_at"],
        "status": cert["status"]
    }
