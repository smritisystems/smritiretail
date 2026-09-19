"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.25.0
* Created    : 2026-07-11
* Modified   : 2026-08-20
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole
from ...schemas.purchase import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderItemResponse,
    PurchaseOrderCancelRequest, PurchaseOrderAmendRequest,
    PurchaseReceiptCreate, PurchaseReceiptResponse, PurchaseReceiptItemResponse,
    PurchaseJurisdictionConfigCreate, PurchaseJurisdictionConfigResponse,
    PurchaseConfigJurisdictionRequest, PurchaseReorderConvertRequest,
    DebitNoteCreate, DebitNoteResponse, PurchaseBillCreate, PurchaseBillResponse,
)
from ...services.purchase import PurchaseService

router = APIRouter()

# ─────────────────────────── Suppliers ───────────────────────────

@router.post(
    "/suppliers",
    response_model=SupplierResponse,
    status_code=201,
    include_in_schema=False,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
@router.post(
    "/suppliers/",
    response_model=SupplierResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_supplier(
    req: SupplierCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Create a new supplier. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    return await service.create_supplier(req)


@router.get(
    "/suppliers",
    response_model=List[SupplierResponse],
    include_in_schema=False,
)
@router.get(
    "/suppliers/",
    response_model=List[SupplierResponse],
)
async def list_suppliers(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List all suppliers for the current tenant."""
    service = PurchaseService(db, tenant)
    return await service.list_suppliers()


@router.get(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
)
async def get_supplier(
    supplier_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get a supplier by ID."""
    service = PurchaseService(db, tenant)
    return await service.get_supplier(supplier_id)



# ─────────────────────────── Purchase Orders — Contract URL Aliases (Phase 4A) ─────────────────────────
# Contract URLs: when mounted at /api/v1/purchase, /orders/ resolves to /api/v1/purchase/orders/
# Legacy /purchase-orders/ routes remain for backward compatibility (deprecated at v3.20.0).

@router.get("/orders", response_model=List[PurchaseOrderResponse], include_in_schema=False)
@router.get("/orders/", response_model=List[PurchaseOrderResponse], summary="List Purchase Orders (Contract URL)")
async def list_purchase_orders_contract(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List purchase orders — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).list_purchase_orders()


@router.get(
    "/orders/next-number",
    summary="Get Next Available Purchase Order Number",
    response_model=dict,
)
async def get_next_order_number(
    prefix: Optional[str] = Query(default=None, description="Order number prefix, e.g. PO13"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Return the next available sequential order number for the given prefix.
    Response: {"prefix": "PO13", "next_number": 47, "next_order_no": "PO13-47"}
    """
    return await PurchaseService(db, tenant_ctx).get_next_order_number(prefix)



@router.post("/orders", response_model=PurchaseOrderResponse, status_code=201,
             include_in_schema=False,
             dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
@router.post("/orders/", response_model=PurchaseOrderResponse, status_code=201,
             summary="Create Purchase Order (Contract URL)",
             dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def create_purchase_order_contract(
    order_in: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a purchase order — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).create_purchase_order(order_in)


@router.get("/orders/{order_id}", response_model=PurchaseOrderResponse, summary="Get Purchase Order (Contract URL)")
async def get_purchase_order_contract(
    order_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a purchase order by ID — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).get_purchase_order(order_id)


@router.post("/orders/{order_id}/cancel", response_model=dict, status_code=200,
             summary="Cancel Purchase Order (Contract URL)",
             dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def cancel_purchase_order_contract(
    order_id: str,
    req: PurchaseOrderCancelRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Cancel a purchase order — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).cancel_purchase_order(order_id, req.reason)


@router.post("/orders/{order_id}/amend", response_model=PurchaseOrderResponse, status_code=201,
             summary="Amend Purchase Order (Contract URL)",
             dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def amend_purchase_order_contract(
    order_id: str,
    req: PurchaseOrderAmendRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Amend a purchase order — canonical contract URL."""
    new_order = await PurchaseService(db, tenant_ctx).amend_purchase_order(order_id, req)
    return new_order


# ─────────────────────────── Purchase Receipts (GRN) ───────────────────────────

@router.post(
    "/receipts",
    response_model=PurchaseReceiptResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
@router.post(
    "/receipts/",
    response_model=PurchaseReceiptResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
@router.post(
    "/purchase-receipts/",
    response_model=PurchaseReceiptResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_purchase_receipt(
    req: PurchaseReceiptCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Post a Goods Receipt Note (GRN).
    MANAGER or SYSADMIN only.
    """
    service = PurchaseService(db, tenant)
    receipt = await service.create_purchase_receipt(req)
    _, items = await service.get_purchase_receipt(receipt.id)
    return PurchaseReceiptResponse(
        id=receipt.id,
        receipt_no=receipt.receipt_no,
        supplier_id=receipt.supplier_id,
        warehouse_id=receipt.warehouse_id,
        order_id=receipt.order_id,
        status=receipt.status,
        notes=receipt.notes,
        subtotal=receipt.subtotal,
        tax_total=receipt.tax_total,
        grand_total=receipt.grand_total,
        company_id=receipt.company_id,
        branch_id=receipt.branch_id,
        items=[PurchaseReceiptItemResponse.model_validate(i) for i in items],
    )


@router.get(
    "/receipts",
    response_model=List[PurchaseReceiptResponse],
)
@router.get(
    "/receipts/",
    response_model=List[PurchaseReceiptResponse],
)
@router.get(
    "/purchase-receipts/",
    response_model=List[PurchaseReceiptResponse],
)
async def list_purchase_receipts(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List all purchase receipts (GRNs) for the current tenant."""
    service = PurchaseService(db, tenant)
    return await service.list_purchase_receipts()


@router.get(
    "/receipts/{receipt_id}",
    response_model=PurchaseReceiptResponse,
)
@router.get(
    "/purchase-receipts/{receipt_id}",
    response_model=PurchaseReceiptResponse,
)
async def get_purchase_receipt(
    receipt_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get a purchase receipt with its line items."""
    service = PurchaseService(db, tenant)
    receipt, items = await service.get_purchase_receipt(receipt_id)
    return PurchaseReceiptResponse(
        id=receipt.id,
        receipt_no=receipt.receipt_no,
        supplier_id=receipt.supplier_id,
        warehouse_id=receipt.warehouse_id,
        order_id=receipt.order_id,
        status=receipt.status,
        notes=receipt.notes,
        subtotal=receipt.subtotal,
        tax_total=receipt.tax_total,
        grand_total=receipt.grand_total,
        company_id=receipt.company_id,
        branch_id=receipt.branch_id,
        items=[PurchaseReceiptItemResponse.model_validate(i) for i in items],
    )



# ─────────────────────────── Supplier UPDATE / DELETE ───────────────────────────

@router.put(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_supplier(
    supplier_id: str,
    req: SupplierUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Partially update a supplier. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    return await service.update_supplier(supplier_id, req)


@router.delete(
    "/suppliers/{supplier_id}",
    status_code=204,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_supplier(
    supplier_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Soft-delete a supplier. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    await service.delete_supplier(supplier_id)
    return Response(status_code=204)


# ─────────────────────────── Purchase Order CANCEL / AMEND ───────────────────────────

@router.post(
    "/purchase-orders/{order_id}/cancel",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def cancel_purchase_order(
    order_id: str,
    req: PurchaseOrderCancelRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Cancel a purchase order (sets status=CANCELLED, soft-deletes).
    Only Confirmed/Draft orders can be cancelled.
    MANAGER or SYSADMIN only.
    """
    service = PurchaseService(db, tenant)
    return await service.cancel_purchase_order(order_id, req.reason)


@router.post(
    "/purchase-orders/{order_id}/amend",
    response_model=PurchaseOrderResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def amend_purchase_order(
    order_id: str,
    req: PurchaseOrderAmendRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Amend a Confirmed purchase order.
    Cancels the original and creates a new Confirmed PO with the supplied items.
    MANAGER or SYSADMIN only.
    """
    service = PurchaseService(db, tenant)
    new_order = await service.amend_purchase_order(order_id, req)
    _, items = await service.get_purchase_order(new_order.id)
    resp = PurchaseOrderResponse.model_validate(new_order)
    resp.items = [PurchaseOrderItemResponse.model_validate(i) for i in items]
    return resp


# ─────────────────────────── Reorder Suggestions ───────────────────────────

@router.get(
    "/reorder-suggestions",
    response_model=List[dict],
)
async def list_reorder_suggestions(
    supplier_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get inventory reorder suggestions."""
    service = PurchaseService(db, tenant)
    return await service.list_reorder_suggestions(supplier_id)


# ─────────────────────────── Jurisdiction Config ───────────────────────────

@router.get(
    "/jurisdiction",
    response_model=str,
)
async def get_jurisdiction(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Get state jurisdiction."""
    service = PurchaseService(db, tenant)
    return await service.get_jurisdiction()


@router.post(
    "/jurisdiction",
    response_model=str,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def set_jurisdiction(
    req: PurchaseJurisdictionConfigCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Set state jurisdiction. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    return await service.set_jurisdiction(req.company_state)


# ─────────────────────────── Phase 4B: Settings Alias (AD-1 resolved) ─────────
# /purchase/settings is an alias for /purchase/jurisdiction (already implemented).

@router.get("/settings", summary="Purchase Settings — company jurisdiction (AD-1)")
async def get_purchase_settings(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Return the company's current tax jurisdiction state. Alias for GET /jurisdiction."""
    service = PurchaseService(db, tenant_ctx)
    state = await service.get_jurisdiction()
    return {"company_state": state, "source": "purchase_jurisdiction_config"}


@router.post(
    "/settings/jurisdiction",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Update company jurisdiction (AD-1)",
)
async def update_purchase_jurisdiction(
    req: PurchaseJurisdictionConfigCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update company_state tax jurisdiction. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant_ctx)
    state = await service.set_jurisdiction(req.company_state)
    return {"company_state": state, "message": "Tax jurisdiction updated."}


# ─────────────────────────── Legacy Purchase Config Aliases ─────────────────────────

@router.get("/config", summary="Purchase Config Legacy Alias")
async def get_purchase_config(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Legacy purchase configuration compatibility alias."""
    service = PurchaseService(db, tenant_ctx)
    state = await service.get_jurisdiction()
    return {"companyState": state}


@router.post(
    "/config/jurisdiction",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Legacy Purchase Config Jurisdiction Alias",
)
async def update_purchase_config_jurisdiction(
    req: PurchaseConfigJurisdictionRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Legacy purchase jurisdiction alias for Express frontend compatibility."""
    if req.state is None:
        return {"companyState": None}

    service = PurchaseService(db, tenant_ctx)
    state = await service.set_jurisdiction(req.state)
    return {"companyState": state}


@router.post(
    "/reorder-suggestions/convert",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Legacy Purchase Reorder Suggestions Convert Alias",
)
async def convert_reorder_suggestions(
    req: PurchaseReorderConvertRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Convert selected low-stock suggestions into a draft purchase order."""
    order = await PurchaseService(db, tenant_ctx).convert_reorder_suggestions_to_draft(
        req.supplierId, req.selectedProductIds
    )
    order_data = PurchaseOrderResponse.model_validate(order).model_dump()
    return {"order": order_data}


# ─────────────────────────── Phase 4B: Submit PO ──────────────────────────────

@router.post(
    "/orders/{order_id}/submit",
    response_model=dict,
    summary="Submit Purchase Order (DRAFT → CONFIRMED)",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def submit_purchase_order(
    order_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Submit a DRAFT purchase order for fulfilment (sets status to CONFIRMED)."""
    return await PurchaseService(db, tenant_ctx).submit_purchase_order(order_id)


# ─────────────────────────── Phase 4B: Reports ────────────────────────────────

@router.get("/reports/outstanding", summary="Supplier Outstanding Report")
async def get_outstanding_report(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List suppliers with open (DRAFT/CONFIRMED) POs and total outstanding values."""
    return await PurchaseService(db, tenant_ctx).get_outstanding_suppliers()


@router.get("/reports/pending-delivery", summary="Pending Delivery Report")
async def get_pending_delivery_report(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List CONFIRMED POs that have not yet received a GRN (purchase receipt)."""
    return await PurchaseService(db, tenant_ctx).get_pending_delivery_pos()


# ─────────────────────────── Phase 4B: Supplier Default Rate (AD-2) ──────────

@router.get(
    "/suppliers/{supplier_id}/default-rate",
    summary="Supplier Default Cost Rate for a Product (AD-2)",
)
async def get_supplier_default_rate(
    supplier_id: str,
    product_id: str = Query(..., description="Product ID to look up cost for"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Return the last GRN unit cost for this supplier+product combination.
    Falls back to last PO unit cost if no GRN exists.
    """
    return await PurchaseService(db, tenant_ctx).get_supplier_default_rate(supplier_id, product_id)


# ───────────────────────────────────────── Purchase Debit Notes ─────────────────────────────────────────

@router.post(
    "/debit-notes",
    response_model=DebitNoteResponse,
    status_code=201,
)
@router.post(
    "/debit-notes/",
    response_model=DebitNoteResponse,
    status_code=201,
)
async def create_debit_note(
    req: DebitNoteCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Post a purchase debit note against a supplier/GRN."""
    service = PurchaseService(db, tenant)
    res = await service.create_debit_note(req)
    return DebitNoteResponse.model_validate(res)


# ───────────────────────────────────────── Purchase Bills / Invoices ─────────────────────────────────────────

@router.post(
    "/bills",
    response_model=PurchaseBillResponse,
    status_code=201,
)
@router.post(
    "/bills/",
    response_model=PurchaseBillResponse,
    status_code=201,
)
@router.post(
    "/invoices",
    response_model=PurchaseBillResponse,
    status_code=201,
)
@router.post(
    "/invoices/",
    response_model=PurchaseBillResponse,
    status_code=201,
)
async def create_purchase_bill(
    req: PurchaseBillCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Post a supplier purchase bill/invoice linked to a GRN."""
    service = PurchaseService(db, tenant)
    res = await service.create_purchase_bill(req)
    return PurchaseBillResponse.model_validate(res)


# ═══════════════════════════════════════════════════════════════════════════════
# PO Vendor Product Control — v6.42.0 (Execution Command Rule 32 Phase 4–7)
# ═══════════════════════════════════════════════════════════════════════════════

from datetime import date as _date
from ...schemas.vendor_product_assignment import (
    VendorProductAssignmentCreate,
    VendorProductAssignmentUpdate,
    VendorProductAssignmentOut,
    VendorProductAssignmentListOut,
    POProductEvaluateRequest,
    POProductBatchEvaluateRequest,
    POProductDecision,
    POProductBatchDecision,
    POProductDiagnosticRequest,
    POProductDiagnosticOut,
    POPolicyConfigOut,
    POPolicyTemplateOut,
    POPolicyApplyRequest,
    POSubmitValidationRequest,
    POSubmitValidationResult,
    POSubmitLineResult,
    POVendorChangeRequest,
    POVendorChangeResult,
    POVendorChangeSummary,
    POVendorChangeLineResult,
    PODuplicateCheckRequest,
    PODuplicateCheckResult,
    POApprovalReasonOut,
)
from ...services.vendor_product_assignment import VendorProductAssignmentService
from ...services.po_product_policy_engine import POProductPolicyEngine
from ...services.po_policy_config_service import POPolicyConfigService

# ────────────────────────── Vendor Product Assignments ──────────────────────────

@router.post(
    "/vendor-product-assignments/",
    response_model=VendorProductAssignmentOut,
    status_code=201,
    tags=["PO Vendor Control"],
    summary="Create a vendor-product assignment",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_vpa(
    req: VendorProductAssignmentCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Assign a product (at any catalog level) to a vendor with priority and effective dates.
    Requires MANAGER or SYSADMIN role.
    """
    svc = VendorProductAssignmentService(db, tenant)
    return await svc.create_assignment(req)


@router.get(
    "/vendor-product-assignments/",
    response_model=VendorProductAssignmentListOut,
    tags=["PO Vendor Control"],
    summary="List vendor-product assignments for a vendor",
)
async def list_vpa(
    vendor_id: str = Query(..., description="Vendor party ID or legacy supplier ID."),
    level: Optional[str] = Query(None, description="Filter by assignment level (BRAND/STYLE/ARTICLE/SKU/BARCODE etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE/INACTIVE/RESTRICTED)."),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List all vendor-product assignments for a given vendor."""
    svc = VendorProductAssignmentService(db, tenant)
    items, total = await svc.list_assignments_for_vendor(
        vendor_id=vendor_id, level=level, status_filter=status, limit=limit, offset=offset
    )
    return VendorProductAssignmentListOut(items=items, total=total)


@router.get(
    "/vendor-product-assignments/{assignment_id}",
    response_model=VendorProductAssignmentOut,
    tags=["PO Vendor Control"],
)
async def get_vpa(
    assignment_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    svc = VendorProductAssignmentService(db, tenant)
    return await svc.get_assignment(assignment_id)


@router.put(
    "/vendor-product-assignments/{assignment_id}",
    response_model=VendorProductAssignmentOut,
    tags=["PO Vendor Control"],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_vpa(
    assignment_id: str,
    req: VendorProductAssignmentUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    svc = VendorProductAssignmentService(db, tenant)
    return await svc.update_assignment(assignment_id, req)


@router.delete(
    "/vendor-product-assignments/{assignment_id}",
    tags=["PO Vendor Control"],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_vpa(
    assignment_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    svc = VendorProductAssignmentService(db, tenant)
    return await svc.soft_delete_assignment(assignment_id)


# ────────────────────────── PO Product Evaluation ──────────────────────────────

@router.post(
    "/evaluate-product",
    response_model=POProductDecision,
    tags=["PO Vendor Control"],
    summary="Evaluate a single product for a vendor in a PO context",
)
async def evaluate_product(
    req: POProductEvaluateRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Authoritative backend decision: can this vendor include this product in a PO?
    Returns status (ASSIGNED/CROSS_VENDOR/UNASSIGNED/RESTRICTED) and
    action (ALLOW/READ_ONLY/APPROVAL_REQUIRED/BLOCK) with full explanation.
    The frontend must never independently calculate authorization.
    """
    vendor_party_id = await VendorProductAssignmentService(db, tenant).resolve_vendor_party_id(
        req.vendor_id
    )
    engine = POProductPolicyEngine(db)
    decision = await engine.evaluate_product_for_vendor(
        company_id=tenant.company_id,
        branch_id=getattr(tenant, "branch_id", None),
        vendor_party_id=vendor_party_id,
        product_ref=req.product_ref,
        transaction_date=req.transaction_date or _date.today(),
        user_id=getattr(tenant, "user_id", None),
        purchase_order_id=req.purchase_order_id,
    )
    # Commit so the decision log written via flush() is persisted (SC10 audit trail)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
    return decision



@router.post(
    "/evaluate-products",
    response_model=POProductBatchDecision,
    tags=["PO Vendor Control"],
    summary="Batch-evaluate multiple products for the PO browse dialog",
)
async def evaluate_products_batch(
    req: POProductBatchEvaluateRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Batch-evaluate up to 200 products in one request for the browse dialog
    pre-evaluation. More efficient than calling evaluate-product in a loop.
    """
    from datetime import datetime, timezone
    vendor_party_id = await VendorProductAssignmentService(db, tenant).resolve_vendor_party_id(
        req.vendor_id
    )
    engine = POProductPolicyEngine(db)
    tx_date = req.transaction_date or _date.today()
    decisions = await engine.evaluate_batch(
        company_id=tenant.company_id,
        branch_id=getattr(tenant, "branch_id", None),
        vendor_party_id=vendor_party_id,
        product_refs=req.product_refs,
        transaction_date=tx_date,
        user_id=getattr(tenant, "user_id", None),
        purchase_order_id=req.purchase_order_id,
    )
    return POProductBatchDecision(
        vendor_id=req.vendor_id,
        transaction_date=tx_date,
        decisions=decisions,
        evaluated_at=datetime.now(timezone.utc),
    )


@router.post(
    "/product-diagnostic",
    response_model=POProductDiagnosticOut,
    tags=["PO Vendor Control"],
    summary="Admin diagnostic: full resolution chain for vendor + product",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def product_diagnostic(
    req: POProductDiagnosticRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Admin-only diagnostic. Returns the full assignment resolution chain,
    winning assignment, active policy, and final decision for support and audit.
    """
    from datetime import datetime, timezone
    vendor_party_id = await VendorProductAssignmentService(db, tenant).resolve_vendor_party_id(
        req.vendor_id
    )
    engine = POProductPolicyEngine(db)
    diag = await engine.build_diagnostic(
        company_id=tenant.company_id,
        branch_id=getattr(tenant, "branch_id", None),
        vendor_party_id=vendor_party_id,
        product_ref=req.product_ref,
        transaction_date=req.transaction_date or _date.today(),
    )
    return diag


# ────────────────────────── PO Policy Configuration ────────────────────────────

@router.get(
    "/purchasing-policy",
    response_model=POPolicyConfigOut,
    tags=["PO Vendor Control"],
    summary="Get the current PO purchasing policy (business-language view)",
)
async def get_purchasing_policy(
    advanced: bool = Query(False, description="If true, include canonical parameter keys (SYSADMIN only)."),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Returns the active PO purchasing policy in business language.
    Technical canonical keys are only included when advanced=True (SYSADMIN only).
    """
    svc = POPolicyConfigService(db, tenant)
    return await svc.get_policy(include_canonical=advanced)


@router.get(
    "/purchasing-policy/templates",
    response_model=List[POPolicyTemplateOut],
    tags=["PO Vendor Control"],
    summary="List available business policy templates",
)
async def list_policy_templates(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    List all available business templates (e.g. GENERAL_RETAIL, FOOTWEAR, ENTERPRISE).
    Used by the Guided and Custom configuration modes.
    """
    svc = POPolicyConfigService(db, tenant)
    return await svc.list_templates()


@router.post(
    "/purchasing-policy/apply",
    response_model=POPolicyConfigOut,
    tags=["PO Vendor Control"],
    summary="Apply a policy template or custom configuration",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def apply_purchasing_policy(
    req: POPolicyApplyRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Apply a policy template or custom values.
    Client MUST set confirmed=True after showing the diff to the user (Rule 18 — never silent overwrite).
    """
    if not req.confirmed:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(
            status_code=400,
            detail=(
                "Policy changes require user confirmation. "
                "Please show the user the diff between current and proposed settings, "
                "then re-submit with confirmed=True."
            ),
        )
    svc = POPolicyConfigService(db, tenant)
    return await svc.apply_policy(req)


# ────────────────────────── PO Submit Validation ───────────────────────────────

@router.post(
    "/validate-po-submit",
    response_model=POSubmitValidationResult,
    tags=["PO Vendor Control"],
    summary="Authoritative revalidation of all PO lines before submission (§16, §37)",
)
async def validate_po_submit(
    req: POSubmitValidationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Must be called on every PO submission.
    Detects stale decisions (policy changed since browse-time).
    Returns can_submit=False if ANY line has action=BLOCK.
    All 4 evaluation paths (browse/add/save/submit) call the same POProductPolicyEngine.
    """
    from datetime import date as _date_type, datetime as _dt, timezone as _tz
    vendor_party_id = await VendorProductAssignmentService(db, tenant).resolve_vendor_party_id(
        req.vendor_id
    )
    engine = POProductPolicyEngine(db)
    tx_date = _date_type.fromisoformat(req.transaction_date) if req.transaction_date else _date_type.today()

    line_results: list[POSubmitLineResult] = []
    blocked_lines: list[int] = []
    stale_lines: list[int] = []
    allowed = approval_req = blocked = stale_count = 0

    for line in req.lines:
        decision = await engine.evaluate_product_for_vendor(
            company_id=tenant.company_id,
            branch_id=getattr(tenant, "branch_id", None),
            vendor_party_id=vendor_party_id,
            product_ref=line.product_ref,
            transaction_date=tx_date,
            user_id=getattr(tenant, "user_id", None),
            purchase_order_id=req.purchase_order_id,
        )

        # Stale detection: compare current action to browse-time action via decision_log_id
        is_stale = False
        previous_action = None
        if line.decision_log_id:
            from ...models.vendor_product_assignment import POProductDecisionLog
            from sqlalchemy import select
            log_stmt = select(POProductDecisionLog).where(
                POProductDecisionLog.id == line.decision_log_id
            )
            log_row = (await db.execute(log_stmt)).scalars().first()
            if log_row and log_row.decision_action != decision.action:
                is_stale = True
                previous_action = log_row.decision_action

        result = POSubmitLineResult(
            line_index=line.line_index,
            product_ref=line.product_ref,
            status=decision.status,
            action=decision.action,
            approval_required=decision.approval_required,
            explanation=decision.explanation,
            stale=is_stale,
            previous_action=previous_action,
        )
        line_results.append(result)

        if decision.action == "BLOCK":
            blocked += 1
            blocked_lines.append(line.line_index)
        elif decision.action == "APPROVAL_REQUIRED":
            approval_req += 1
        else:
            allowed += 1
        if is_stale:
            stale_count += 1
            stale_lines.append(line.line_index)

    from ...services.po_product_policy_engine import _PolicySnapshot
    snap = _PolicySnapshot()
    return POSubmitValidationResult(
        can_submit=blocked == 0,
        allowed_count=allowed,
        approval_required_count=approval_req,
        blocked_count=blocked,
        stale_count=stale_count,
        line_results=line_results,
        blocked_lines=blocked_lines,
        stale_lines=stale_lines,
        policy_version=snap.version_hash(),
        validated_at=_dt.now(_tz.utc),
    )


# ────────────────────────── Vendor Change Re-evaluation ────────────────────────

@router.post(
    "/evaluate-vendor-change",
    response_model=POVendorChangeResult,
    tags=["PO Vendor Control"],
    summary="Re-evaluate all PO lines for a new vendor (§4, §22)",
)
async def evaluate_vendor_change(
    req: POVendorChangeRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Called when the buyer changes vendor on a PO that already has product lines.
    Returns per-line decisions under the new vendor, plus a summary count.
    The frontend uses this for the POVendorChangeDialog results phase.
    """
    from datetime import date as _date_type, datetime as _dt, timezone as _tz
    new_vendor_party_id = await VendorProductAssignmentService(db, tenant).resolve_vendor_party_id(
        req.new_vendor_id
    )
    engine = POProductPolicyEngine(db)
    tx_date = _date_type.fromisoformat(req.transaction_date) if req.transaction_date else _date_type.today()
    line_indices = req.line_indices or list(range(len(req.product_refs)))

    summary = POVendorChangeSummary()
    decisions: list[POVendorChangeLineResult] = []

    for idx, (product_ref, line_idx) in enumerate(zip(req.product_refs, line_indices)):
        decision = await engine.evaluate_product_for_vendor(
            company_id=tenant.company_id,
            branch_id=getattr(tenant, "branch_id", None),
            vendor_party_id=new_vendor_party_id,
            product_ref=product_ref,
            transaction_date=tx_date,
            user_id=getattr(tenant, "user_id", None),
            purchase_order_id=req.purchase_order_id,
        )
        decisions.append(POVendorChangeLineResult(
            line_index=line_idx,
            product_ref=product_ref,
            status=decision.status,
            action=decision.action,
            approval_required=decision.approval_required,
            explanation=decision.explanation,
        ))
        s = decision.status.lower()
        if s == "assigned":         summary.assigned += 1
        elif s == "cross_vendor":   summary.cross_vendor += 1
        elif s == "unassigned":     summary.unassigned += 1
        elif s == "restricted":     summary.restricted += 1
        if decision.action == "BLOCK":              summary.blocked += 1
        elif decision.action == "APPROVAL_REQUIRED": summary.approval_required += 1

    return POVendorChangeResult(
        new_vendor_id=req.new_vendor_id,
        summary=summary,
        decisions=decisions,
        evaluated_at=_dt.now(_tz.utc),
    )


# ────────────────────────── Duplicate Product Check ────────────────────────────

@router.post(
    "/check-duplicate-product",
    response_model=PODuplicateCheckResult,
    tags=["PO Vendor Control"],
    summary="Check if a product already exists on the PO (§24)",
)
async def check_duplicate_product(
    req: PODuplicateCheckRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Checks the list of existing product refs against the new product ref.
    Returns is_duplicate=True with the matching line index if found.
    Frontend uses this to show: Increase Quantity / Add Separate Line / Cancel.
    """
    ref = req.new_product_ref.strip().lower()
    for idx, existing in enumerate(req.existing_product_refs):
        if existing.strip().lower() == ref:
            return PODuplicateCheckResult(
                is_duplicate=True,
                existing_line_index=idx,
                existing_product_ref=req.existing_product_refs[idx],
                existing_qty=None,  # qty is managed client-side
            )
    return PODuplicateCheckResult(is_duplicate=False)


# ────────────────────────── Approval Reasons ───────────────────────────────────

@router.get(
    "/approval-reasons",
    response_model=List[POApprovalReasonOut],
    tags=["PO Vendor Control"],
    summary="List PO cross-vendor approval reasons for the reason dropdown (§12)",
)
async def list_approval_reasons(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Returns the 10 seeded approval reasons from the v1477 master.
    Used by POApprovalReasonDialog to populate the reason dropdown.
    Reasons are always shown in business language — no technical codes visible to buyer.
    """
    from sqlalchemy import select
    from ...models.master_lookup import MasterValue, MasterType

    try:
        # Join master_values → master_types WHERE master_types.code = 'PO_CROSS_VENDOR_REASON'
        stmt = (
            select(MasterValue)
            .join(MasterType, MasterValue.master_type_id == MasterType.id)
            .where(
                MasterType.code == "PO_CROSS_VENDOR_REASON",
                MasterValue.active == True,
                MasterValue.is_deleted.is_(False) | MasterValue.is_deleted.is_(None),
            )
            .order_by(MasterValue.sort_order)
        )
        rows = (await db.execute(stmt)).scalars().all()
        return [
            POApprovalReasonOut(
                code=r.code,
                label=r.name,
                sort_order=r.sort_order or 0,
                requires_note=(r.code == "OTHER"),
                is_active=r.active,
            )
            for r in rows
        ]
    except Exception:
        # Graceful fallback — return the 10 static reasons if DB query fails
        return [
            POApprovalReasonOut(code="BETTER_PRICE",            label="Better Price Available",                 sort_order=1),
            POApprovalReasonOut(code="STOCK_AVAILABILITY",      label="Stock Not Available from Registered Vendor", sort_order=2),
            POApprovalReasonOut(code="REGISTERED_VENDOR_OOS",   label="Registered Vendor is Out of Stock",      sort_order=3),
            POApprovalReasonOut(code="URGENT_REQUIREMENT",      label="Urgent Requirement",                     sort_order=4),
            POApprovalReasonOut(code="BETTER_CREDIT_TERMS",     label="Better Credit Terms Offered",            sort_order=5),
            POApprovalReasonOut(code="DELIVERY_REQUIREMENT",    label="Delivery Timeline Requirement",          sort_order=6),
            POApprovalReasonOut(code="TERRITORY_REQUIREMENT",   label="Territory or Location Requirement",      sort_order=7),
            POApprovalReasonOut(code="NEW_VENDOR_TRIAL",        label="New Vendor Trial / Evaluation",          sort_order=8),
            POApprovalReasonOut(code="MANAGEMENT_INSTRUCTION",  label="Management Instruction",                 sort_order=9),
            POApprovalReasonOut(code="OTHER",                   label="Other (please specify)",                 sort_order=10, requires_note=True),
        ]

