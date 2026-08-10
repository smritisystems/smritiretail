"""
Project      : SMRITI Retail OS
Module       : WorkspaceResolver Service (SCS-WSC-001 Standard)
Description  : Backend resolution engine for calculating full workspace context,
               RBAC permissions, feature flags, operational policies, industry pack,
               and branding for a target workspace context (company_id, branch_id, warehouse_id).
Standard     : SCS-WSC-001 — SMRITI Workspace Context & Resolver
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
"""

from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Company, Branch, TenantProvisionProfile
from app.models.inventory import Warehouse
from app.models.company_master import CompanyFinancialYear, CompanyTaxProfile


async def resolve_workspace_context(
    db: AsyncSession,
    company_id: str,
    branch_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    user_role: str = "SYSADMIN"
) -> Dict[str, Any]:
    """
    Computes single atomic Workspace Switch payload returning:
    - workspace: tenantId, companyId, branchId, warehouseId, financialYearId, currency, timezone, language
    - permissions: RBAC permission list
    - features: Company feature flags (batch, expiry, rfid, priceMatrix, etc.)
    - policies: Operational policies (negativeStockPolicy, maxDiscountPercent, autoPrint)
    - industryPack: Active Industry Plugin Metadata
    - branding: Company Name, Trade Name, GSTIN
    """
    # 1. Fetch Company
    comp_res = await db.execute(select(Company).where(Company.id == company_id, Company.is_deleted == False))
    company = comp_res.scalars().first()

    if not company:
        raise ValueError(f"Company '{company_id}' not found or deactivated.")

    tenant_id = company.tenant_id

    # 2. Fetch or default Branch
    resolved_branch_id = branch_id
    if not resolved_branch_id:
        br_res = await db.execute(select(Branch).where(Branch.company_id == company_id, Branch.is_deleted == False))
        br = br_res.scalars().first()
        resolved_branch_id = br.id if br else f"br-{company_id}-01"

    # 3. Fetch or default Warehouse
    resolved_wh_id = warehouse_id
    if not resolved_wh_id:
        wh_res = await db.execute(select(Warehouse).where(Warehouse.company_id == company_id, Warehouse.is_deleted == False))
        wh = wh_res.scalars().first()
        resolved_wh_id = wh.id if wh else f"wh-{company_id}-01"

    # 4. Fetch Financial Year
    fy_res = await db.execute(select(CompanyFinancialYear).where(CompanyFinancialYear.company_id == company_id, CompanyFinancialYear.status == "OPEN"))
    fy = fy_res.scalars().first()
    fy_id = fy.id if fy else "cfy-2026-2027"

    # 5. Fetch Tax Profile & Industry Pack
    tax_res = await db.execute(select(CompanyTaxProfile).where(CompanyTaxProfile.company_id == company_id))
    tax_profile = tax_res.scalars().first()

    prof_res = await db.execute(select(TenantProvisionProfile).where(TenantProvisionProfile.tenant_id == tenant_id))
    provision_profile = prof_res.scalars().first()
    ind_pack_id = provision_profile.industry_pack if provision_profile else "general_retail"

    # 6. Default Permissions, Features, and Policies
    permissions = [
        "sales.create", "sales.read", "sales.cancel",
        "purchase.create", "purchase.read", "purchase.approve",
        "inventory.read", "inventory.adjust", "inventory.transfer",
        "accounting.read", "reports.view", "master.manage"
    ]

    features = {
        "batch": True,
        "expiry": True,
        "serial": True,
        "rfid": False,
        "priceMatrix": True,
        "promotions": True,
        "barcode": True,
        "thermal": True,
    }

    policies = {
        "negativeStockPolicy": "block",
        "maxDiscountPercent": 20,
        "priceOverrideAllowed": False,
        "requireManagerApprovalOnReturn": True,
        "allowCreditSales": True,
        "autoPrintReceipt": True,
        "cashDrawerPulseOnCheckout": True,
    }

    return {
        "success": True,
        "workspace": {
            "tenantId": tenant_id,
            "companyId": company.id,
            "branchId": resolved_branch_id,
            "warehouseId": resolved_wh_id,
            "financialYearId": fy_id,
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "language": "en-IN",
        },
        "permissions": permissions,
        "features": features,
        "policies": policies,
        "industryPack": {
            "id": ind_pack_id,
            "name": ind_pack_id.replace("_", " ").title(),
        },
        "branding": {
            "companyName": company.name,
            "gstin": tax_profile.gstin if tax_profile else company.gst_number,
        }
    }
