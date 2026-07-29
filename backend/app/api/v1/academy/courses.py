"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Academy LMS REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body

from app.core.ecosystem.academy_engine import AcademyLMSEngine

router = APIRouter(prefix="/academy", tags=["SMRITI Academy LMS & Certifications"])


@router.get("/courses")
async def get_learning_academy_courses():
    """Returns SMRITI Academy course catalog and certification tracks."""
    return AcademyLMSEngine.get_courses()


@router.post("/enroll")
async def enroll_academy_course(course_code: str = Body(...), user_id: str = Body("USER-001")):
    """Enrolls user in SMRITI Academy course."""
    return AcademyLMSEngine.enroll_course(course_code, user_id)
