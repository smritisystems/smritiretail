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
Classification: Customer Workspace & Licensing REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Query

from app.core.ecosystem.customer_portal import CustomerWorkspaceEngine

router = APIRouter(prefix="/customer", tags=["Customer Portal Workspace & Licenses"])


@router.get("/dashboard")
async def get_customer_workspace_dashboard(customer_id: str = Query("CUST-001")):
    """Aggregates Customer Workspace metrics, active licenses, backups, and ticket status."""
    return CustomerWorkspaceEngine.get_workspace_dashboard(customer_id)


@router.get("/licenses")
async def get_customer_licenses(customer_id: str = Query("CUST-001")):
    """Returns active customer licenses and store allocations."""
    dashboard = CustomerWorkspaceEngine.get_workspace_dashboard(customer_id)
    return {"customer_id": customer_id, "licenses": dashboard["licenses"]}
