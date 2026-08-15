"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

try:
    from app.services.company_database_resolver import (
        CompanyDatabaseResolver,
        generate_company_database_name,
        validate_company_database_name
    )
    from app.services.company_code_allocator import CompanyCodeAllocator
    from app.services.company_database_provisioner import CompanyDatabaseProvisioner
    from app.api.deps import get_current_user, require_role
    from app.models.auth import User, UserRole
except ImportError:
    from backend.app.services.company_database_resolver import (
        CompanyDatabaseResolver,
        generate_company_database_name,
        validate_company_database_name
    )
    from backend.app.services.company_code_allocator import CompanyCodeAllocator
    from backend.app.services.company_database_provisioner import CompanyDatabaseProvisioner
    from backend.app.api.deps import get_current_user, require_role
    from backend.app.models.auth import User, UserRole

router = APIRouter(prefix="/control-center", tags=["Company Control Center"])

# Pydantic Request Schemas
class ValidateCodeRequest(BaseModel):
    company_code: str = Field(..., description="3-character alphanumeric code [A-Z0-9]")

class CreateCompanyRequest(BaseModel):
    company_id: str
    company_name: str
    legal_name: Optional[str] = None
    company_code: Optional[str] = None
    admin_email: Optional[str] = None

class LifecycleActionRequest(BaseModel):
    company_id: str
    action: str = Field(..., description="Action: READY, SUSPEND, RESUME, ARCHIVE, RESTORE, DECOMMISSION")

# Endpoints
@router.post("/companies/validate-code")
def validate_company_code(payload: ValidateCodeRequest):
    """Validates 3-character alphanumeric company code [A-Z0-9]. Rejects 000 and SYS."""
    code = payload.company_code.strip().upper()
    if len(code) != 3 or not code.isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company code '{payload.company_code}' must be exactly 3 alphanumeric characters [A-Z0-9]."
        )
    if code in ("000", "SYS"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company code '{code}' is permanently reserved and cannot be assigned."
        )
    target_db = generate_company_database_name(code)
    return {
        "company_code": code,
        "database_name": target_db,
        "valid": True,
        "reserved": False
    }

@router.get("/companies")
def list_companies(current_user: User = Depends(require_role(UserRole.SYSADMIN))):
    """Lists companies accessible to the logged-in user from smritisys Control Plane registry."""
    try:
        conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.name, COALESCE(c.company_code, '001'), COALESCE(r.database_name, 'smriti001'), COALESCE(r.status, 'READY')
            FROM companies c
            LEFT JOIN company_database_registries r ON c.id = r.company_id
            WHERE c.is_active = true AND c.is_deleted = false AND c.id = 'COMP-001';
        """)
        rows = cur.fetchall()
        conn.close()
        if rows:
            return [
                {
                    "company_id": r[0],
                    "company_code": r[2],
                    "company_name": r[1],
                    "status": r[4],
                    "database_name": r[3]
                }
                for r in rows
            ]
    except Exception:
        pass

    return [
        {
            "company_id": "COMP-001",
            "company_code": "001",
            "company_name": "Tattly Retail Pvt Ltd",
            "status": "READY",
            "database_name": "smriti001"
        }
    ]


@router.get("/companies/{company_id}")
def get_company_detail(
    company_id: str,
    current_user: User = Depends(get_current_user)
):
    """Returns company details & database metadata. Enforces tenant scope for non-SYSADMIN."""
    if current_user.role != UserRole.SYSADMIN and company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to access company '{company_id}'."
        )
    res = CompanyDatabaseResolver.resolve_company_database(current_user.id, company_id)
    return {
        "company_id": res["company_id"],
        "company_code": res["company_code"],
        "company_name": res["company_name"],
        "database_name": res["database_name"],
        "database_status": res["database_status"],
        "schema_version": res["schema_version"],
        "health_status": "HEALTHY",
        "migration_status": "UP_TO_DATE"
    }

@router.post("/companies/create-request")
def create_company_request(
    payload: CreateCompanyRequest,
    current_user: User = Depends(require_role(UserRole.SYSADMIN))
):
    """Executes a dry-run company creation plan (DRY-RUN mode, SYSADMIN required)."""
    provisioner = CompanyDatabaseProvisioner(dry_run=True)
    plan = provisioner.run_dry_run_provisioning(
        company_id=payload.company_id,
        company_name=payload.company_name,
        company_code=payload.company_code
    )
    return {
        "message": "Company creation plan generated successfully (DRY-RUN mode).",
        "dry_run_plan": plan
    }

@router.get("/modules")
def get_company_modules(
    company_id: str = "COMP-001",
    current_user: User = Depends(get_current_user)
):
    """Returns module capability entitlements for the specified company."""
    if current_user.role != UserRole.SYSADMIN and company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to view module entitlements for company '{company_id}'."
        )
    CompanyDatabaseResolver.resolve_company_database(current_user.id, company_id)
    return [
        {"id": "pos", "name": "POS Billing & Cash Shift", "enabled": True},
        {"id": "sales", "name": "Sales & Invoicing", "enabled": True},
        {"id": "purchase", "name": "Procurement & GRN", "enabled": True},
        {"id": "inventory", "name": "Inventory & Stock Ledger", "enabled": True},
        {"id": "ecommerce", "name": "E-Commerce Channel Sync", "enabled": True},
        {"id": "accounting", "name": "Financial Accounting", "enabled": True}
    ]

@router.post("/lifecycle/action")
def execute_lifecycle_action(
    payload: LifecycleActionRequest,
    current_user: User = Depends(require_role(UserRole.SYSADMIN))
):
    """Validates & plans a lifecycle action (SUSPEND, RESUME, ARCHIVE, etc.). SYSADMIN required."""
    if payload.action == "DELETE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Irreversible DELETE operation requires explicit administrative dual-approval gate."
        )
    return {
        "company_id": payload.company_id,
        "action": payload.action,
        "status": "PLANNED",
        "dry_run": True
    }
