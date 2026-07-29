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
Classification: SMRITI Digital Platform Ecosystem REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body, Query

from app.core.ecosystem.portal_registry import PortalRegistry
from app.core.ecosystem.customer_portal import CustomerWorkspaceEngine
from app.core.ecosystem.academy_engine import AcademyLMSEngine

router = APIRouter(tags=["SMRITI Digital Platform Ecosystem Hub (v27.0.0)"])


@router.get("/ecosystem/portals")
async def get_registered_portals(visibility: str = Query(None)):
    """Returns dynamic metadata for all registered portals across Public and Authenticated tiers."""
    return PortalRegistry.get_portals(visibility_filter=visibility)


@router.get("/customer/dashboard")
async def get_customer_workspace_dashboard(customer_id: str = Query("CUST-001")):
    """Compiles Customer Workspace metrics, active licenses, backups, and ticket status."""
    return CustomerWorkspaceEngine.get_workspace_dashboard(customer_id)


@router.get("/academy/courses")
async def get_learning_academy_courses():
    """Returns Learning Academy course catalog and certification tracks."""
    return AcademyLMSEngine.get_courses()


@router.post("/academy/enroll")
async def enroll_academy_course(course_code: str = Body(...), user_id: str = Body("USER-001")):
    """Enrolls user in Learning Academy course."""
    return AcademyLMSEngine.enroll_course(course_code, user_id)
