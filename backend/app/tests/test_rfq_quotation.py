"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.9.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product
from app.models.purchase import (
    Supplier, ProcurementRFQ, ProcurementRFQItem, ProcurementRFQVendor,
    VendorQuotation, VendorQuotationItem, QuotationEvaluation, PurchaseOrder, VendorContract
)
from app.services.inventory import InventoryService
from app.procurement.engine.matrix_builder import MatrixBuilder
from app.procurement.engine.evaluation_engine import EvaluationEngine
from app.procurement.engine.ranking_engine import RankingEngine
from app.procurement.engine.award_engine import AwardEngine
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.inventory import ProductCreate


async def _setup_rfq_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test RFQ Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:8]}", is_active=True)
    db_session.add_all([comp, branch])
    await db_session.commit()

    ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(ctx)
    return ctx


async def _create_test_supplier(db_session: AsyncSession, tenant_ctx: TenantContext, code: str, name: str, rating: float = 80.0) -> Supplier:
    sup = Supplier(
        id=f"sup-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        code=code,
        name=name,
        mobile=f"98{uuid.uuid4().int % 100000000:08d}",
        workflow_status="Approved",
        custom_attributes={"rating": rating}
    )
    db_session.add(sup)
    await db_session.commit()
    return sup


async def _create_test_product(db_session: AsyncSession, tenant_ctx: TenantContext, code: str, name: str) -> Product:
    inv_service = InventoryService(db_session, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"{code}-{uuid.uuid4().hex[:4]}",
        name=name,
        category="Footwear",
        brand="Generic",
        color="Black",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("1000.00")
    )
    return await inv_service.create_product(p_in)


@pytest.mark.asyncio
async def test_rfq_creation_and_invitation(db_session):
    tenant_ctx = await _setup_rfq_tenant(db_session)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-RFQ-1", "Vendor A")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-RFQ-1", "RFQ Product")

    rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"
    rfq = ProcurementRFQ(
        id=rfq_id,
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_code="RFQ-2026-01",
        title="Nike Footwear RFQ",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Draft"
    )
    db_session.add(rfq)

    rfq_item = ProcurementRFQItem(
        id=f"rfqi-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_id=rfq_id,
        product_id=prod.id,
        required_quantity=Decimal("100.00")
    )
    db_session.add(rfq_item)

    rfq_vendor = ProcurementRFQVendor(
        id=f"rfqv-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_id=rfq_id,
        supplier_id=sup.id
    )
    db_session.add(rfq_vendor)
    await db_session.commit()

    # Verify RFQ and child relations
    stmt = select(ProcurementRFQ).where(ProcurementRFQ.id == rfq_id)
    rfq_db = (await db_session.execute(stmt)).scalars().first()
    assert rfq_db is not None
    assert rfq_db.rfq_code == "RFQ-2026-01"
    assert rfq_db.status == "Draft"


@pytest.mark.asyncio
async def test_vendor_quotation_submission_and_revision(db_session):
    tenant_ctx = await _setup_rfq_tenant(db_session)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-RFQ-2", "Vendor B")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-RFQ-2", "RFQ Product 2")

    # Create RFQ
    rfq = ProcurementRFQ(
        id=f"rfq-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_code="RFQ-2026-02",
        title="Nike Footwear RFQ 2",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Bidding Open"
    )
    db_session.add(rfq)
    await db_session.commit()

    # Submit Quotation Version 1
    vq_id_1 = f"vq-{uuid.uuid4().hex[:12]}"
    vq1 = VendorQuotation(
        id=vq_id_1,
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id,
        supplier_id=sup.id,
        quotation_code="QT-NIKE-001",
        version_number=1,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("8000.00"),
        status="Submitted"
    )
    db_session.add(vq1)
    await db_session.commit()

    # Revise Quotation (amends to version 2)
    vq1.status = "Revised"
    db_session.add(vq1)

    vq_id_2 = f"vq-{uuid.uuid4().hex[:12]}"
    vq2 = VendorQuotation(
        id=vq_id_2,
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id,
        supplier_id=sup.id,
        quotation_code="QT-NIKE-001",
        version_number=2,
        parent_quotation_id=vq1.id,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("7500.00"),
        status="Submitted"
    )
    db_session.add(vq2)
    await db_session.commit()

    # Verify versioning
    stmt = select(VendorQuotation).where(VendorQuotation.id == vq_id_2)
    vq_db = (await db_session.execute(stmt)).scalars().first()
    assert vq_db.version_number == 2
    assert vq_db.parent_quotation_id == vq1.id
    assert float(vq_db.total_quote_value) == 7500.0


@pytest.mark.asyncio
async def test_structured_comparison_matrix_builder(db_session):
    tenant_ctx = await _setup_rfq_tenant(db_session)
    sup_a = await _create_test_supplier(db_session, tenant_ctx, "SUP-MAT-A", "Vendor A")
    sup_b = await _create_test_supplier(db_session, tenant_ctx, "SUP-MAT-B", "Vendor B")

    # Create RFQ
    rfq = ProcurementRFQ(
        id=f"rfq-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_code="RFQ-MATRIX",
        title="Matrix Compare RFQ",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Bidding Open"
    )
    db_session.add(rfq)
    await db_session.commit()

    # Vendor A Quote: ₹8,000, 5 days lead time
    vq_a = VendorQuotation(
        id=f"vq-{uuid.uuid4().hex[:12]}", uuid=str(uuid.uuid4()), tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id, branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id, supplier_id=sup_a.id, quotation_code="QT-A", version_number=1,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("8000.00"), offered_lead_time_days=5, status="Submitted"
    )
    # Vendor B Quote: ₹7,000, 10 days lead time
    vq_b = VendorQuotation(
        id=f"vq-{uuid.uuid4().hex[:12]}", uuid=str(uuid.uuid4()), tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id, branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id, supplier_id=sup_b.id, quotation_code="QT-B", version_number=1,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("7000.00"), offered_lead_time_days=10, status="Submitted"
    )
    db_session.add_all([vq_a, vq_b])
    await db_session.commit()

    builder = MatrixBuilder(db_session, tenant_ctx)
    matrix = await builder.build_matrix(rfq.id)

    assert matrix["rfq_code"] == "RFQ-MATRIX"
    assert len(matrix["vendor_quotes"]) == 2
    total_values = [vq["total_value"] for vq in matrix["vendor_quotes"]]
    assert 8000.0 in total_values
    assert 7000.0 in total_values


@pytest.mark.asyncio
async def test_weighted_multi_factor_evaluation(db_session):
    # Setup quotes
    quotes_data = [
        {"quote_id": "q1", "total_value": 10000.0, "lead_time_days": 5, "vendor_rating": 90.0},
        {"quote_id": "q2", "total_value": 8000.0, "lead_time_days": 10, "vendor_rating": 80.0}
    ]

    # Test under RETAIL_DEFAULT: 50% price, 25% lead time, 25% rating
    evaluated_quotes = EvaluationEngine.evaluate_quotes(quotes_data, "RETAIL_DEFAULT")
    
    # Lowest price is 8000.0. Lowest lead time is 5 days.
    # q1 score: 0.5 * (8000/10000 * 100) + 0.25 * (5/5 * 100) + 0.25 * 90 = 40.0 + 25.0 + 22.5 = 87.5
    # q2 score: 0.5 * (8000/8000 * 100) + 0.25 * (5/10 * 100) + 0.25 * 80 = 50.0 + 12.5 + 20.0 = 82.5
    q1_eval = [q for q in evaluated_quotes if q["quote_id"] == "q1"][0]
    q2_eval = [q for q in evaluated_quotes if q["quote_id"] == "q2"][0]
    assert q1_eval["score"] == 87.5
    assert q2_eval["score"] == 82.5


@pytest.mark.asyncio
async def test_rfq_award_and_conversion_to_po(db_session):
    tenant_ctx = await _setup_rfq_tenant(db_session)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-AWARD-PO", "Winner Supplier")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-AWARD-PO", "RFQ Product to PO")

    rfq = ProcurementRFQ(
        id=f"rfq-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_code="RFQ-AW-PO",
        title="Award PO RFQ",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Under Evaluation"
    )
    db_session.add(rfq)
    await db_session.commit()

    vq = VendorQuotation(
        id=f"vq-{uuid.uuid4().hex[:12]}", uuid=str(uuid.uuid4()), tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id, branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id, supplier_id=sup.id, quotation_code="QT-AW-PO", version_number=1,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("5000.00"), status="Submitted", score=Decimal("95.00")
    )
    db_session.add(vq)

    vqi = VendorQuotationItem(
        id=f"vqi-{uuid.uuid4().hex[:12]}", quotation_id=vq.id, product_id=prod.id,
        offered_quantity=Decimal("10.00"), offered_unit_price=Decimal("500.00"), discount_percentage=Decimal("0.00"),
        net_unit_price=Decimal("500.00"), line_total=Decimal("5000.00")
    )
    db_session.add(vqi)
    await db_session.commit()

    award_engine = AwardEngine(db_session, tenant_ctx)
    evaluation = await award_engine.award_rfq(
        rfq_id=rfq.id, quotation_id=vq.id, awarded_by="Jawahar CEO", award_notes="Best offer received", convert_to="PURCHASE_ORDER"
    )

    assert evaluation is not None
    assert evaluation.converted_doc_type == "PURCHASE_ORDER"
    assert evaluation.converted_doc_id is not None

    # Check generated PO
    po_stmt = select(PurchaseOrder).where(PurchaseOrder.id == evaluation.converted_doc_id)
    po = (await db_session.execute(po_stmt)).scalars().first()
    assert po is not None
    assert po.status == "CONFIRMED"
    assert po.supplier_id == sup.id


@pytest.mark.asyncio
async def test_rfq_award_and_conversion_to_vendor_contract(db_session):
    tenant_ctx = await _setup_rfq_tenant(db_session)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-AWARD-VC", "Winner Supplier Contract")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-AWARD-VC", "RFQ Product to Contract")

    rfq = ProcurementRFQ(
        id=f"rfq-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        rfq_code="RFQ-AW-VC",
        title="Award Contract RFQ",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Under Evaluation"
    )
    db_session.add(rfq)
    await db_session.commit()

    vq = VendorQuotation(
        id=f"vq-{uuid.uuid4().hex[:12]}", uuid=str(uuid.uuid4()), tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id, branch_id=tenant_ctx.branch_id,
        rfq_id=rfq.id, supplier_id=sup.id, quotation_code="QT-AW-VC", version_number=1,
        quote_validity_date=datetime.now(timezone.utc) + timedelta(days=30),
        total_quote_value=Decimal("9000.00"), status="Submitted", score=Decimal("92.50")
    )
    db_session.add(vq)

    vqi = VendorQuotationItem(
        id=f"vqi-{uuid.uuid4().hex[:12]}", quotation_id=vq.id, product_id=prod.id,
        offered_quantity=Decimal("15.00"), offered_unit_price=Decimal("600.00"), discount_percentage=Decimal("0.00"),
        net_unit_price=Decimal("600.00"), line_total=Decimal("9000.00")
    )
    db_session.add(vqi)
    await db_session.commit()

    award_engine = AwardEngine(db_session, tenant_ctx)
    evaluation = await award_engine.award_rfq(
        rfq_id=rfq.id, quotation_id=vq.id, awarded_by="Jawahar CEO", award_notes="Approved long-term contract pricing", convert_to="VENDOR_CONTRACT"
    )

    assert evaluation is not None
    assert evaluation.converted_doc_type == "VENDOR_CONTRACT"
    assert evaluation.converted_doc_id is not None

    # Check generated Contract
    vc_stmt = select(VendorContract).where(VendorContract.id == evaluation.converted_doc_id)
    vc = (await db_session.execute(vc_stmt)).scalars().first()
    assert vc is not None
    assert vc.approval_status == "Approved"
    assert vc.lifecycle_stage == "Active"


@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_rfqs(db_session):
    tenant_a = await _setup_rfq_tenant(db_session)
    tenant_b = await _setup_rfq_tenant(db_session)

    # Create RFQ in Tenant A
    rfq_a = ProcurementRFQ(
        id=f"rfq-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_a.tenant_id,
        company_id=tenant_a.company_id,
        branch_id=tenant_a.branch_id,
        rfq_code="RFQ-TENA",
        title="Tenant A Private RFQ",
        submission_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        status="Draft"
    )
    db_session.add(rfq_a)
    await db_session.commit()

    # AwardEngine initialized with Tenant B context tries to award Tenant A's RFQ -> Should raise 404
    award_engine_b = AwardEngine(db_session, tenant_b)
    with pytest.raises(HTTPException) as excinfo:
        await award_engine_b.award_rfq(
            rfq_id=rfq_a.id, quotation_id="any-id", awarded_by="Malicious User", award_notes="Hack attempt", convert_to="PURCHASE_ORDER"
        )
    assert excinfo.value.status_code == 404
