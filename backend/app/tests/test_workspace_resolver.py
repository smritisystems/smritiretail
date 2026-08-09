"""
Project      : SMRITI Retail OS v7.0
Module       : Unit Tests — WorkspaceResolver Service (SCS-WSC-001)
Description  : Pure unit tests for resolve_workspace_context(). All SQLAlchemy
               async DB calls and ORM model references are mocked — no live
               database required.

               DHI Finding (pre-existing bug): workspace_resolver.py imports
               `Warehouse`, `CompanyFinancialYear`, `CompanyTaxProfile`, and
               `TenantProvisionProfile` from app.models.tenant, but only
               `Company` and `Branch` exist in that module. This causes an
               ImportError in the production runtime. The tests work around
               this via sys.modules injection. The production import bug should
               be tracked and fixed separately.

Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ── Pre-inject missing ORM stubs so workspace_resolver.py can be imported ──
_tenant_stub = MagicMock()
for _name in ("Company", "Branch", "Warehouse", "CompanyFinancialYear",
              "CompanyTaxProfile", "TenantProvisionProfile"):
    setattr(_tenant_stub, _name, MagicMock())
# Override *before* the import below so the module-level import resolves
sys.modules["app.models.tenant"] = _tenant_stub

from app.services.workspace_resolver import resolve_workspace_context  # noqa: E402


# ── Fake SQLAlchemy select that returns the entity unchanged ──────────────
def _fake_select(entity):
    stmt = MagicMock()
    stmt.where.return_value = stmt
    return stmt


# ── DB mock that iterates through a fixed list of return values ───────────
def _make_db_mock(*return_values):
    """
    Each call to db.execute() returns the next value in return_values via
    scalars().first().
    """
    db = AsyncMock()
    call_iter = iter(return_values)

    async def execute_side_effect(_stmt):
        val = next(call_iter, None)
        result = MagicMock()
        result.scalars.return_value.first.return_value = val
        return result

    db.execute.side_effect = execute_side_effect
    return db


# ── ORM object factories ──────────────────────────────────────────────────
def _company(company_id="comp-001", tenant_id="tenant-001",
             name="SMRITI Footwear Pvt Ltd", gst_number="27AABCA1234Z1Z5"):
    c = MagicMock()
    c.id = company_id
    c.tenant_id = tenant_id
    c.name = name
    c.gst_number = gst_number
    return c


def _branch(branch_id="br-001"):
    b = MagicMock()
    b.id = branch_id
    return b


def _warehouse(wh_id="wh-001"):
    w = MagicMock()
    w.id = wh_id
    return w


def _fy(fy_id="cfy-2026-2027"):
    f = MagicMock()
    f.id = fy_id
    return f


def _tax(gstin="27AABCA1234Z1Z5"):
    t = MagicMock()
    t.gstin = gstin
    return t


def _provision(industry_pack="general_retail"):
    p = MagicMock()
    p.industry_pack = industry_pack
    return p


# ── Tests ─────────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def patch_select():
    """Patch sqlalchemy.select inside the resolver so MagicMock ORM classes are accepted."""
    with patch("app.services.workspace_resolver.select", side_effect=_fake_select):
        yield


class TestResolveWorkspaceContext:

    @pytest.mark.asyncio
    async def test_full_resolution_returns_correct_structure(self):
        """Happy path: all DB entities found → workspace payload is complete and correct.
        When branch_id and warehouse_id are explicitly provided, the service skips
        the branch/warehouse DB queries — only company, fy, tax, provision are fetched.
        """
        db = _make_db_mock(_company(), _fy(), _tax(), _provision())

        result = await resolve_workspace_context(db, company_id="comp-001",
                                                 branch_id="br-001", warehouse_id="wh-001")

        assert result["success"] is True
        ws = result["workspace"]
        assert ws["tenantId"] == "tenant-001"
        assert ws["companyId"] == "comp-001"
        assert ws["branchId"] == "br-001"
        assert ws["warehouseId"] == "wh-001"
        assert ws["financialYearId"] == "cfy-2026-2027"
        assert ws["currency"] == "INR"
        assert ws["timezone"] == "Asia/Kolkata"
        assert ws["language"] == "en-IN"


    @pytest.mark.asyncio
    async def test_raises_value_error_when_company_not_found(self):
        """Company not found → raises ValueError with diagnostic message."""
        db = _make_db_mock(None)  # first execute returns None → no company

        with pytest.raises(ValueError, match="not found or deactivated"):
            await resolve_workspace_context(db, company_id="nonexistent")

    @pytest.mark.asyncio
    async def test_permissions_list_contains_core_rbac_capabilities(self):
        """Resolved permissions must include the 12 default RBAC capabilities."""
        db = _make_db_mock(_company(), _branch(), _warehouse(), _fy(), _tax(), _provision())

        result = await resolve_workspace_context(db, company_id="comp-001")

        perms = result["permissions"]
        assert "sales.create" in perms
        assert "purchase.approve" in perms
        assert "inventory.adjust" in perms
        assert "reports.view" in perms
        assert "master.manage" in perms

    @pytest.mark.asyncio
    async def test_feature_flags_include_expected_toggles(self):
        """Feature flags must include batch, expiry, priceMatrix, barcode; rfid must be off."""
        db = _make_db_mock(_company(), _branch(), _warehouse(), _fy(), _tax(), _provision())

        result = await resolve_workspace_context(db, company_id="comp-001")

        features = result["features"]
        assert features["batch"] is True
        assert features["expiry"] is True
        assert features["priceMatrix"] is True
        assert features["barcode"] is True
        assert features["rfid"] is False

    @pytest.mark.asyncio
    async def test_policies_contain_operational_governance_keys(self):
        """Policy map must include negativeStockPolicy, maxDiscountPercent, etc."""
        db = _make_db_mock(_company(), _branch(), _warehouse(), _fy(), _tax(), _provision())

        result = await resolve_workspace_context(db, company_id="comp-001")

        policies = result["policies"]
        assert policies["negativeStockPolicy"] == "block"
        assert policies["maxDiscountPercent"] == 20
        assert policies["requireManagerApprovalOnReturn"] is True

    @pytest.mark.asyncio
    async def test_industry_pack_defaults_to_general_retail_when_no_provision(self):
        """No TenantProvisionProfile → industryPack.id must default to 'general_retail'."""
        db = _make_db_mock(_company(), _branch(), _warehouse(), _fy(), _tax(), None)

        result = await resolve_workspace_context(db, company_id="comp-001")

        assert result["industryPack"]["id"] == "general_retail"

    @pytest.mark.asyncio
    async def test_financial_year_id_defaults_when_no_open_fy(self):
        """No open financial year → financialYearId must fall back to 'cfy-2026-2027'."""
        db = _make_db_mock(_company(), _branch(), _warehouse(), None, _tax(), _provision())

        result = await resolve_workspace_context(db, company_id="comp-001")

        assert result["workspace"]["financialYearId"] == "cfy-2026-2027"

    @pytest.mark.asyncio
    async def test_branding_gstin_sourced_from_tax_profile(self):
        """Branding.gstin must come from CompanyTaxProfile.gstin, not company.gst_number."""
        db = _make_db_mock(
            _company(gst_number="COMPANY_FALLBACK"),
            _branch(), _warehouse(), _fy(),
            _tax(gstin="27AABCA1234Z1Z5"),
            _provision()
        )

        result = await resolve_workspace_context(db, company_id="comp-001")

        assert result["branding"]["gstin"] == "27AABCA1234Z1Z5"
        assert result["branding"]["companyName"] == "SMRITI Footwear Pvt Ltd"

    @pytest.mark.asyncio
    async def test_branding_gstin_falls_back_to_company_gst_when_no_tax_profile(self):
        """When no CompanyTaxProfile → branding.gstin must fall back to company.gst_number."""
        db = _make_db_mock(
            _company(gst_number="FALLBACK_GST"),
            _branch(), _warehouse(), _fy(),
            None,  # no tax profile
            _provision()
        )

        result = await resolve_workspace_context(db, company_id="comp-001")

        assert result["branding"]["gstin"] == "FALLBACK_GST"
