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
    return await engine.evaluate_product_for_vendor(
        company_id=tenant.company_id,
        branch_id=getattr(tenant, "branch_id", None),
        vendor_party_id=vendor_party_id,
        product_ref=req.product_ref,
        transaction_date=req.transaction_date or _date.today(),
        user_id=getattr(tenant, "user_id", None),
        purchase_order_id=req.purchase_order_id,
    )


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



