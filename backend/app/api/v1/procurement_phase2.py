"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Version      : 1.0.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""
# smriti_capability(entity="PURCHASE", capability="PURCHASE_REQUISITION_AND_RFQ", role="API", canonicalOwner="backend/app/api/v1/procurement_phase2.py")

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_company_db, get_tenant_context, TenantContext
from ...schemas.procurement_phase2 import (
    RequisitionCreate, RequisitionApprovalAction, RequisitionRejectAction,
    RequisitionConvertToPORequest, RequisitionResponse,
    RfqCreate, RfqResponse,
    QuotationCreate, QuotationResponse, QuotationSelectAction,
    QuotationConvertToPORequest, QuotationComparisonMatrixResponse,
)
from ...schemas.purchase import PurchaseOrderResponse
from ...services.procurement_phase2 import ProcurementPhase2Service

router = APIRouter(prefix="/purchase", tags=["Procurement Phase 2 — PR & RFQ"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Purchase Requisitions (Store / Department Indents)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/requisitions/", response_model=RequisitionResponse, status_code=status.HTTP_201_CREATED)
async def create_requisition(
    payload: RequisitionCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Create a new Purchase Requisition indent."""
    return await ProcurementPhase2Service(db, tenant).create_requisition(payload)


@router.get("/requisitions/", response_model=List[RequisitionResponse])
async def list_requisitions(
    status: Optional[str] = Query(None, description="Filter by status (DRAFT, SUBMITTED, APPROVED, etc.)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List purchase requisitions for the active company/branch."""
    return await ProcurementPhase2Service(db, tenant).list_requisitions(status)


@router.get("/requisitions/{requisition_id}", response_model=RequisitionResponse)
async def get_requisition(
    requisition_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Fetch single purchase requisition by ID or requisition number."""
    return await ProcurementPhase2Service(db, tenant).get_requisition(requisition_id)


@router.post("/requisitions/{requisition_id}/submit", response_model=RequisitionResponse)
async def submit_requisition(
    requisition_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Submit a draft requisition for management approval."""
    return await ProcurementPhase2Service(db, tenant).submit_requisition(requisition_id)


@router.post("/requisitions/{requisition_id}/approve", response_model=RequisitionResponse)
async def approve_requisition(
    requisition_id: str,
    payload: RequisitionApprovalAction,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Approve a submitted requisition with per-line approved quantities."""
    return await ProcurementPhase2Service(db, tenant).approve_requisition(requisition_id, payload)


@router.post("/requisitions/{requisition_id}/reject", response_model=RequisitionResponse)
async def reject_requisition(
    requisition_id: str,
    payload: RequisitionRejectAction,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Reject a submitted requisition with reason."""
    return await ProcurementPhase2Service(db, tenant).reject_requisition(requisition_id, payload)


@router.post("/requisitions/{requisition_id}/cancel", response_model=RequisitionResponse)
async def cancel_requisition(
    requisition_id: str,
    payload: RequisitionRejectAction,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Cancel a requisition."""
    return await ProcurementPhase2Service(db, tenant).cancel_requisition(requisition_id, payload.reason)


@router.post("/requisitions/{requisition_id}/convert-to-po", response_model=PurchaseOrderResponse)
async def convert_requisition_to_po(
    requisition_id: str,
    payload: RequisitionConvertToPORequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Convert an approved purchase requisition into a draft Purchase Order."""
    return await ProcurementPhase2Service(db, tenant).convert_requisition_to_po(requisition_id, payload)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Supplier RFQs
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/rfqs/", response_model=RfqResponse, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    payload: RfqCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Create a new Supplier Request for Quotation."""
    return await ProcurementPhase2Service(db, tenant).create_rfq(payload)


@router.get("/rfqs/", response_model=List[RfqResponse])
async def list_rfqs(
    status: Optional[str] = Query(None, description="Filter by status (DRAFT, ISSUED, EVALUATED, etc.)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List RFQs for the active company/branch."""
    rfqs = await ProcurementPhase2Service(db, tenant).list_rfqs(status)
    results = []
    for r in rfqs:
        item = RfqResponse.model_validate(r)
        item.quotations_count = len(r.quotations) if r.quotations else 0
        results.append(item)
    return results


@router.get("/rfqs/{rfq_id}", response_model=RfqResponse)
async def get_rfq(
    rfq_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get single RFQ details with items."""
    r = await ProcurementPhase2Service(db, tenant).get_rfq(rfq_id)
    item = RfqResponse.model_validate(r)
    item.quotations_count = len(r.quotations) if r.quotations else 0
    return item


@router.post("/rfqs/{rfq_id}/issue", response_model=RfqResponse)
async def issue_rfq(
    rfq_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Issue RFQ to participating suppliers."""
    return await ProcurementPhase2Service(db, tenant).issue_rfq(rfq_id)


@router.post("/rfqs/{rfq_id}/close", response_model=RfqResponse)
async def close_rfq(
    rfq_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Close an RFQ."""
    return await ProcurementPhase2Service(db, tenant).close_rfq(rfq_id)


@router.get("/rfqs/{rfq_id}/comparison", response_model=QuotationComparisonMatrixResponse)
async def get_rfq_comparison_matrix(
    rfq_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Generate side-by-side landed cost quotation comparison matrix for an RFQ."""
    return await ProcurementPhase2Service(db, tenant).get_rfq_comparison_matrix(rfq_id)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Supplier Quotations
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/quotations/", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation(
    payload: QuotationCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Record an incoming supplier quotation with landed cost calculation."""
    q = await ProcurementPhase2Service(db, tenant).create_quotation(payload)
    resp = QuotationResponse.model_validate(q)
    resp.supplier_name = q.supplier.name if q.supplier else q.supplier_id
    return resp


@router.get("/quotations/", response_model=List[QuotationResponse])
async def list_quotations(
    rfq_id: Optional[str] = Query(None, description="Filter by RFQ"),
    supplier_id: Optional[str] = Query(None, description="Filter by Supplier"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List supplier quotations."""
    quotes = await ProcurementPhase2Service(db, tenant).list_quotations(rfq_id, supplier_id)
    results = []
    for q in quotes:
        resp = QuotationResponse.model_validate(q)
        resp.supplier_name = q.supplier.name if q.supplier else q.supplier_id
        results.append(resp)
    return results


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
async def get_quotation(
    quotation_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get single quotation details."""
    q = await ProcurementPhase2Service(db, tenant).get_quotation(quotation_id)
    resp = QuotationResponse.model_validate(q)
    resp.supplier_name = q.supplier.name if q.supplier else q.supplier_id
    return resp


@router.post("/quotations/{quotation_id}/select", response_model=QuotationResponse)
async def select_quotation(
    quotation_id: str,
    payload: QuotationSelectAction,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Formally select and document award justification for a supplier quotation."""
    q = await ProcurementPhase2Service(db, tenant).select_quotation(quotation_id, payload)
    resp = QuotationResponse.model_validate(q)
    resp.supplier_name = q.supplier.name if q.supplier else q.supplier_id
    return resp


@router.post("/quotations/{quotation_id}/convert-to-po", response_model=PurchaseOrderResponse)
async def convert_quotation_to_po(
    quotation_id: str,
    payload: QuotationConvertToPORequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Convert a selected supplier quotation into a binding Purchase Order."""
    return await ProcurementPhase2Service(db, tenant).convert_quotation_to_po(quotation_id, payload)
