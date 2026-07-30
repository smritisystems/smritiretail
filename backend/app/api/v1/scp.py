"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-30
Modified     : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard (SCP-001)

scp.py — REST API router for SMRITI Compliance Platform (SCP v1.0 Kernel).
Endpoints for Pre-flight statutory validation, Exception Workbench data, Rule evaluation, and Sandbox simulation.
"""

from datetime import date
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import get_current_tenant, TenantContext, require_permission
from app.core.scp.validator import StatutoryValidator, ComplianceIssueDTO
from app.core.scp.rule_evaluator import TemporalRuleEvaluator, TemporalStatutoryRule
from app.core.scp.connectors.nic_gst_connector import NICGSTConnector


router = APIRouter(prefix="/scp", tags=["SMRITI Compliance Platform (SCP v1.0 Kernel)"])


class PreFlightValidateReq(BaseModel):
    is_b2b: bool = True
    customer_gstin: Optional[str] = None
    total_amount: float = 0.0
    items: List[Dict[str, Any]] = []
    eway_bill_no: Optional[str] = None


class ValidationResponse(BaseModel):
    valid: bool
    issues: List[ComplianceIssueDTO]
    period: str


@router.post("/validate/sales-invoice", response_model=ValidationResponse, dependencies=[Depends(require_permission("TAX.VIEW"))])
async def preflight_validate_sales_invoice(
    payload: PreFlightValidateReq,
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Executes real-time pre-flight statutory validation for GSTIN, HSN, and E-Way Bill threshold.
    """
    issues = StatutoryValidator.validate_sales_invoice(payload.dict())
    has_errors = any(i.severity == "ERROR" for i in issues)
    return ValidationResponse(
        valid=not has_errors,
        issues=issues,
        period=date.today().strftime("%Y-%m")
    )


@router.get("/connectors/nic/status", dependencies=[Depends(require_permission("TAX.VIEW"))])
async def get_nic_connector_status(
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Checks connection status with Government NIC GSTN portal gateway.
    """
    connector = NICGSTConnector()
    authenticated = await connector.authenticate("dummy_key", "dummy_secret")
    return {
        "connector": connector.connector_name,
        "base_url": connector.base_url,
        "status": "ONLINE" if authenticated else "OFFLINE",
        "auth_token": connector.auth_token
    }
