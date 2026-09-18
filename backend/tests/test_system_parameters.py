"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.41.0
Created      : 2026-09-14
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Pytest Suite for SMRITI System Parameters Subsystem & 5-Tier Governance Engine
"""

import sys
import json
import pytest
from pathlib import Path
from fastapi import HTTPException

# Ensure backend and workspace are on path
workspace_root = Path(__file__).resolve().parents[2]
backend_dir = workspace_root / "backend"
for p in [str(workspace_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.db.session import async_session
from app.services.system_parameter import SystemParameterService
from app.models.system_parameter import SystemParameter


@pytest.mark.asyncio
async def test_01_blueprint_integrity():
    """Verify parameters.json contains exactly 828 parameters and 26 profile variances."""
    blueprint_path = workspace_root / "docs" / "legacy_blueprints" / "shoper9" / "parameters.json"
    assert blueprint_path.exists(), f"Blueprint not found at {blueprint_path}"

    with open(blueprint_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["totalParameters"] == 828
    assert data["profileVariancesCount"] == 26
    assert len(data["parameters"]) == 828


@pytest.mark.asyncio
async def test_02_seed_retail_profile():
    """Verify seeding retail profile establishes parameters with retail profile defaults."""
    async with async_session() as db:
        seeded = await SystemParameterService.seed_default_parameters(
            db=db,
            profile="RETAIL",
            company_id="COMP-001",
            overwrite_existing=True,
        )
        # On re-seed with overwrite, 821 mutable parameters are updated, 7 Fixed are preserved
        assert seeded >= 821

        # Verify retail specific values
        res_map = await SystemParameterService.resolve_parameters_map(db, company_id="COMP-001")
        assert res_map["count"] >= 828

        values = res_map["values"]
        # In Retail profile: SHOPEREnv is 'R'
        assert values.get("SHOPEREnv") == "R"
        # In Retail profile: CustClass1Cap is 'Religion'
        assert values.get("CustClass1Cap") == "Religion"


@pytest.mark.asyncio
async def test_03_profile_variance_distributor():
    """Verify distributor profile adopts distributor defaults for the 26 variances."""
    async with async_session() as db:
        # Seed on existing company COMP-002 to isolate
        test_comp = "COMP-002"
        seeded = await SystemParameterService.seed_default_parameters(
            db=db,
            profile="DISTRIBUTOR",
            company_id=test_comp,
            overwrite_existing=True,
        )
        assert seeded >= 821

        res_map = await SystemParameterService.resolve_parameters_map(db, company_id=test_comp)
        values = res_map["values"]

        # In Distributor profile: SHOPEREnv is 'D'
        assert values.get("SHOPEREnv") == "D"
        # In Distributor profile: AllowCreditBilling is True (1)
        assert values.get("AllowCreditBilling") is True
        # In Distributor profile: CustClass1Cap is 'Zone'
        assert values.get("CustClass1Cap") == "Zone"


@pytest.mark.asyncio
async def test_04_fixed_mutability_enforcement():
    """Verify Fixed parameters cannot be altered by anyone and raise SMRITI-PARAM-001."""
    async with async_session() as db:
        with pytest.raises(HTTPException) as excinfo:
            await SystemParameterService.update_parameter(
                db=db,
                param_code="CompanyCode",
                value="ILLEGAL_MODIFICATION",
                company_id="COMP-001",
                updated_by="admin",
            )
        err = excinfo.value
        assert err.status_code == 400
        assert err.detail["code"] == "SMRITI-PARAM-001"
        assert "Fixed" in err.detail["explanation"]


@pytest.mark.asyncio
async def test_05_variable_parameter_update():
    """Verify Variable parameters can be freely modified and updated in the database."""
    async with async_session() as db:
        updated = await SystemParameterService.update_parameter(
            db=db,
            param_code="AllowCreditBilling",
            value=True,
            company_id="COMP-001",
            updated_by="test_user",
        )
        assert updated.val_boolean is True
        assert updated.effective_value is True

        # Re-resolve to verify persisted state
        resolved = await SystemParameterService.resolve_parameter(
            db=db,
            param_code="AllowCreditBilling",
            company_id="COMP-001",
        )
        assert resolved is not None
        assert resolved.effective_value is True


@pytest.mark.asyncio
async def test_06_hierarchical_resolution():
    """Verify 4-tier hierarchical resolution: Terminal > Branch > Company > Global."""
    async with async_session() as db:
        # Create a terminal-specific override
        terminal_param = await SystemParameterService.update_parameter(
            db=db,
            param_code="AllowCreditBilling",
            value=False,
            company_id="COMP-001",
            terminal_id="POS-TERM-02",
            scope_level="TERMINAL",
            updated_by="admin",
        )
        assert terminal_param.effective_value is False

        # Terminal resolution should get the override (False)
        resolved_term = await SystemParameterService.resolve_parameter(
            db=db,
            param_code="AllowCreditBilling",
            company_id="COMP-001",
            terminal_id="POS-TERM-02",
        )
        assert resolved_term is not None
        assert resolved_term.effective_value is False

        # Company-level resolution should still see the company value (True)
        resolved_comp = await SystemParameterService.resolve_parameter(
            db=db,
            param_code="AllowCreditBilling",
            company_id="COMP-001",
            terminal_id="COMMON",
        )
        assert resolved_comp is not None
        assert resolved_comp.effective_value is True


@pytest.mark.asyncio
async def test_07_canonical_code_populated():
    """Verify canonical_code is populated for all system_parameters rows (ADR-042)."""
    async with async_session() as db:
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT count(*) FROM system_parameters WHERE canonical_code IS NULL")
        )
        null_count = result.scalar()
        assert null_count == 0, (
            f"Found {null_count} rows with canonical_code = NULL after backfill migration."
        )

        # Verify specific high-priority mappings
        result = await db.execute(
            text(
                "SELECT param_code, canonical_code FROM system_parameters "
                "WHERE param_code IN ('AllowCreditBilling', 'SHOPEREnv', 'GIRWithoutPORef', "
                "'CompanyCode', 'InBillingCustSelectionCompulsary', 'StockOutActionInBill') "
                "AND company_id IS NULL"
            )
        )
        rows = result.fetchall()
        mapping = {r[0]: r[1] for r in rows}

        assert mapping.get("AllowCreditBilling") == "SMRITI.BILLING.ALLOW_CREDIT_BILLING"
        assert mapping.get("SHOPEREnv") == "SMRITI.SETUP.SHOPER_ENV"
        assert mapping.get("GIRWithoutPORef") == "SMRITI.STOCK.INWARDS.GIR_WITHOUT_PO_REF"
        assert mapping.get("CompanyCode") == "SMRITI.SETUP.COMPANY_CODE"
        assert mapping.get("InBillingCustSelectionCompulsary") == "SMRITI.BILLING.IN_BILLING_CUST_SELECTION_COMPULSARY"
        assert mapping.get("StockOutActionInBill") == "SMRITI.BILLING.STOCK_OUT_ACTION_IN_BILL"


@pytest.mark.asyncio
async def test_08_dual_key_resolution():
    """Verify dual-key resolution: canonical SMRITI.* key resolves the same parameter
    as the legacy Shoper 9 param_code key (ADR-042)."""
    async with async_session() as db:
        # Resolve via legacy key
        by_legacy = await SystemParameterService.resolve_parameter(
            db=db,
            param_code="AllowCreditBilling",
            company_id="COMP-001",
        )
        # Resolve via canonical key
        by_canonical = await SystemParameterService.resolve_parameter(
            db=db,
            param_code="SMRITI.BILLING.ALLOW_CREDIT_BILLING",
            company_id="COMP-001",
        )

        assert by_legacy is not None, "Legacy key resolution failed"
        assert by_canonical is not None, "Canonical key resolution failed"

        # Both must resolve to the same database row
        assert by_legacy.id == by_canonical.id, (
            f"Legacy ({by_legacy.id}) and canonical ({by_canonical.id}) resolve to different rows."
        )
        assert by_legacy.param_code == by_canonical.param_code
        assert by_canonical.canonical_code == "SMRITI.BILLING.ALLOW_CREDIT_BILLING"
        assert by_legacy.effective_value == by_canonical.effective_value
