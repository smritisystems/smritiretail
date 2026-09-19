"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.20.0
Created      : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical 2026 E-Way Bill Compliance Verification Suite
"""

import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import select, delete

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import TenantContext, get_db, get_tenant_context, get_current_user
from app.compliance.models.compliance import ComplianceAuditLog
from app.compliance.schemas.compliance import (
    EWayBillGenerationRequest,
    CancelComplianceDocRequest,
)
from app.compliance.services.ewaybill_service import EWayBillService
from app.models.distribution import EWayBill
from app.models.tenant import Company, Branch

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _make_tenant(db_session, suffix: str):
    unique_suffix = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(
        id=f"comp-sgip-{unique_suffix}",
        name=f"SGIP Co {unique_suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True
    )
    br = Branch(
        id=f"br-sgip-{unique_suffix}",
        company_id=comp.id,
        name=f"SGIP Br {unique_suffix}",
        code=f"BRSGIP-{unique_suffix[:6]}",
        is_active=True
    )
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def test_ewaybill_statutory_threshold():
    """
    Statutory threshold test:
    - Intra-state >= ₹50,000 mandates E-Way Bill.
    - Intra-state < ₹50,000 is exempt.
    - Interstate with any commercial value mandates E-Way Bill.
    """
    assert EWayBillService.requires_eway_bill(50000.00, is_interstate=False) is True
    assert EWayBillService.requires_eway_bill(49999.99, is_interstate=False) is False
    assert EWayBillService.requires_eway_bill(100.00, is_interstate=True) is True
    assert EWayBillService.requires_eway_bill(0.00, is_interstate=True) is False


async def test_canonical_ewaybill_generation_and_persistence(db_session):
    """
    Verifies full lifecycle of 2026 canonical E-Way Bill:
    1. Generation with 4-party combination movement (trans_type=4).
    2. Physical origin (dispatch_from) and physical delivery (ship_to) capture.
    3. 200 km/day statutory validity computation.
    4. Exact SQLAlchemy ORM persistence into eway_bills table.
    5. Statutory cancellation within 24-hour window.
    """
    comp, br = await _make_tenant(db_session, "ewb")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    service = EWayBillService(db=db_session, tenant_ctx=tenant_ctx)

    inv_id = f"inv-test-{uuid.uuid4().hex[:8]}"
    doc_no = f"TT2026-2027/{uuid.uuid4().hex[:4].upper()}"

    request = EWayBillGenerationRequest(
        invoice_id=inv_id,
        doc_no=doc_no,
        doc_type="INV",
        from_gstin="27AAXFT2508H1ZR",
        to_gstin="19AABCR1718E1ZM",
        from_pincode="440029",
        to_pincode="711310",
        trans_distance_km=1020,
        trans_type=4,  # Interstate 4-party combination
        dispatch_from_gstin="27AAXFT2508H1ZR",
        dispatch_from_trade_name="Tattly Threads (Nagpur Depot)",
        dispatch_from_place="Nagpur",
        dispatch_from_pincode="440029",
        dispatch_from_state_code=27,
        dispatch_from_addr1="Om Sai Nagar, Kalamana",
        dispatch_from_addr2="Tattly Threads Nagpur Depot",
        ship_to_gstin="19AABCR1718E1ZM",
        ship_to_trade_name="Reliance Retail Limited (RRL Trends Footwear Panchla DC)",
        ship_to_place="Sankrail",
        ship_to_pincode="711310",
        ship_to_state_code=19,
        ship_to_addr1="Distribution Center RRL DAG NO 248 249 250",
        ship_to_addr2="MOUZA SURAKAHALLI PS ULUBERIA SANKRAIL",
        total_taxable_amount=322041.60,
        cgst_amount=0.00,
        sgst_amount=0.00,
        igst_amount=16102.09,
        total_invoice_value=338144.00,
        main_hsn_code="64041990",
        vehicle_no="MH31FC1234",
        transporter_id="27AABCT1234F1Z1",
        transporter_name="SafeX Logistics",
    )

    # 1. Generate E-Way Bill
    response = await service.generate_ewaybill(request)
    assert response.status == "SUCCESS"
    assert response.eway_bill_no is not None
    assert len(response.eway_bill_no) == 12
    assert response.trans_distance_km == 1020
    assert response.vehicle_no == "MH31FC1234"

    # 2. Query ORM Entity directly from eway_bills table
    stmt = select(EWayBill).where(EWayBill.eway_bill_no == response.eway_bill_no)
    res = await db_session.execute(stmt)
    ewb = res.scalar_one_or_none()

    assert ewb is not None
    assert ewb.document_no == doc_no
    assert ewb.invoice_id == inv_id
    assert ewb.trans_type == 4
    assert ewb.dispatch_from_trade_name == "Tattly Threads (Nagpur Depot)"
    assert ewb.dispatch_from_pincode == "440029"
    assert ewb.dispatch_from_state_code == 27
    assert ewb.ship_to_trade_name == "Reliance Retail Limited (RRL Trends Footwear Panchla DC)"
    assert ewb.ship_to_pincode == "711310"
    assert ewb.ship_to_state_code == 19
    assert float(ewb.total_taxable_amount) == 322041.60
    assert float(ewb.igst_amount) == 16102.09
    assert float(ewb.consignment_value) == 338144.00
    assert ewb.main_hsn_code == "64041990"
    assert float(ewb.distance_km) == 1020.00
    assert ewb.part_b_status == "UPDATED"
    assert ewb.status == "GENERATED"

    # 3. Statutory Validity Check: 1020 km at 200 km/day = ceil(1020/200) = 6 days = 144 hours
    validity_delta = ewb.valid_until - ewb.valid_from
    validity_hours = int(validity_delta.total_seconds() / 3600)
    assert validity_hours == 144, f"Expected 144 hours (6 days), got {validity_hours} hours"

    # 4. Cancel E-Way Bill
    cancel_req = CancelComplianceDocRequest(
        document_type="EWAYBILL",
        document_no=response.eway_bill_no,
        reason="Order amended by buyer",
        remarks="Cancelling test bill"
    )
    cancel_res = await service.cancel_ewaybill(cancel_req)
    assert cancel_res.get("status") == "CANCELLED"

    # 5. Verify database status transition
    await db_session.refresh(ewb)
    assert ewb.status == "CANCELLED"
    assert ewb.cancel_date is not None
    assert ewb.cancel_remarks == "Order amended by buyer"

    # Clean up test rows
    await db_session.execute(delete(EWayBill).where(EWayBill.eway_bill_no == response.eway_bill_no))
    await db_session.execute(delete(ComplianceAuditLog).where(ComplianceAuditLog.company_id == comp.id))
    await db_session.execute(delete(Branch).where(Branch.company_id == comp.id))
    await db_session.execute(delete(Company).where(Company.id == comp.id))
    await db_session.commit()


async def test_get_ewaybill_api_endpoint(db_session):
    """
    Tests GET /api/v1/compliance/ewaybill/{document_no_or_id} retrieval endpoint.
    """
    comp, br = await _make_tenant(db_session, "api_ewb")
    test_ewb_no = f"2609{uuid.uuid4().hex[:8]}"
    test_inv_no = f"INV-GET-{uuid.uuid4().hex[:4].upper()}"

    from app.models.auth import User, UserRole

    async def _mock_tenant():
        return TenantContext(company_id=comp.id, branch_id=br.id)

    async def _mock_user():
        return User(id="usr-test-ewb", username="test_ewb_user", role=UserRole.SYSADMIN)

    app.dependency_overrides[get_tenant_context] = _mock_tenant
    app.dependency_overrides[get_current_user] = _mock_user

    ewb = EWayBill(
        id=f"EWB-{uuid.uuid4().hex[:8]}",
        eway_bill_no=test_ewb_no,
        document_no=test_inv_no,
        invoice_id=f"inv-{uuid.uuid4().hex[:6]}",
        document_type="INVOICE",
        trans_type=4,
        gstin_from="27AAXFT2508H1ZR",
        gstin_to="19AABCR1718E1ZM",
        dispatch_from_trade_name="Tattly Threads (Nagpur Depot)",
        dispatch_from_pincode="440029",
        ship_to_trade_name="Reliance Retail Limited",
        ship_to_pincode="711310",
        consignment_value=338144.00,
        total_taxable_amount=322041.60,
        igst_amount=16102.09,
        distance_km=1020,
        status="GENERATED",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(ewb)
    await db_session.commit()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Fetch by E-Way Bill Number
            res1 = await client.get(f"/api/v1/compliance/ewaybill/{test_ewb_no}")
            assert res1.status_code == 200
            data1 = res1.json()
            assert data1["eway_bill_no"] == test_ewb_no
            assert data1["trans_type"] == 4
            assert data1["dispatch_from"]["pincode"] == "440029"
            assert data1["ship_to"]["pincode"] == "711310"
            assert data1["consignment_value"] == 338144.00

            # 2. Fetch by Document Number
            res2 = await client.get(f"/api/v1/compliance/ewaybill/{test_inv_no}")
            assert res2.status_code == 200
            assert res2.json()["eway_bill_no"] == test_ewb_no

            # 3. Not Found check
            res3 = await client.get("/api/v1/compliance/ewaybill/NON-EXISTENT-EWB-999")
            assert res3.status_code == 404
    finally:
        app.dependency_overrides.pop(get_tenant_context, None)
        app.dependency_overrides.pop(get_current_user, None)
        # Cleanup
        await db_session.execute(delete(EWayBill).where(EWayBill.id == ewb.id))
        await db_session.execute(delete(Branch).where(Branch.company_id == comp.id))
        await db_session.execute(delete(Company).where(Company.id == comp.id))
        await db_session.commit()


