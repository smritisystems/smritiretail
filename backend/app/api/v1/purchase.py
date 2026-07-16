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

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole
from ...schemas.purchase import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderItemResponse,
    PurchaseOrderCancelRequest, PurchaseOrderAmendRequest,
    PurchaseReceiptCreate, PurchaseReceiptResponse, PurchaseReceiptItemResponse,
    PurchaseJurisdictionConfigCreate, PurchaseJurisdictionConfigResponse,
)
from ...services.purchase import PurchaseService

router = APIRouter()

# ─────────────────────────── Suppliers ───────────────────────────

@router.post(
    "/suppliers/",
    response_model=SupplierResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_supplier(
    req: SupplierCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Create a new supplier. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    return await service.create_supplier(req)


@router.get(
    "/suppliers/",
    response_model=List[SupplierResponse],
)
async def list_suppliers(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
):
    """Get a supplier by ID."""
    service = PurchaseService(db, tenant)
    return await service.get_supplier(supplier_id)



# ─────────────────────────── Purchase Orders — Contract URL Aliases (Phase 4A) ─────────────────────────
# Contract URLs: when mounted at /api/v1/purchase, /orders/ resolves to /api/v1/purchase/orders/
# Legacy /purchase-orders/ routes remain for backward compatibility (deprecated at v3.20.0).

@router.get("/orders/", response_model=List[PurchaseOrderResponse], summary="List Purchase Orders (Contract URL)")
async def list_purchase_orders_contract(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List purchase orders — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).list_purchase_orders()


@router.post("/orders/", response_model=PurchaseOrderResponse, status_code=201,
             summary="Create Purchase Order (Contract URL)",
             dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def create_purchase_order_contract(
    order_in: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a purchase order — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).create_purchase_order(order_in)


@router.get("/orders/{order_id}", response_model=PurchaseOrderResponse, summary="Get Purchase Order (Contract URL)")
async def get_purchase_order_contract(
    order_id: str,
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Amend a purchase order — canonical contract URL."""
    new_order = await PurchaseService(db, tenant_ctx).amend_purchase_order(order_id, req)
    return new_order


# ─────────────────────────── Purchase Receipts (GRN) ───────────────────────────

@router.post(
    "/purchase-receipts/",
    response_model=PurchaseReceiptResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_purchase_receipt(
    req: PurchaseReceiptCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Post a Goods Receipt Note (GRN).
    MANAGER or SYSADMIN only.
    """
    service = PurchaseService(db, tenant)
    receipt = await service.create_purchase_receipt(req)
    _, items = await service.get_purchase_receipt(receipt.id)
    resp = PurchaseReceiptResponse.model_validate(receipt)
    resp.items = [PurchaseReceiptItemResponse.model_validate(i) for i in items]
    return resp


@router.get(
    "/purchase-receipts/",
    response_model=List[PurchaseReceiptResponse],
)
async def list_purchase_receipts(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """List all purchase receipts (GRNs) for the current tenant."""
    service = PurchaseService(db, tenant)
    return await service.list_purchase_receipts()


@router.get(
    "/purchase-receipts/{receipt_id}",
    response_model=PurchaseReceiptResponse,
)
async def get_purchase_receipt(
    receipt_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Get a purchase receipt with its line items."""
    service = PurchaseService(db, tenant)
    receipt, items = await service.get_purchase_receipt(receipt_id)
    resp = PurchaseReceiptResponse.model_validate(receipt)
    resp.items = [PurchaseReceiptItemResponse.model_validate(i) for i in items]
    return resp



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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
):
    """Set state jurisdiction. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant)
    return await service.set_jurisdiction(req.company_state)


# ─────────────────────────── Phase 4B: Settings Alias (AD-1 resolved) ─────────
# /purchase/settings is an alias for /purchase/jurisdiction (already implemented).

@router.get("/settings", summary="Purchase Settings — company jurisdiction (AD-1)")
async def get_purchase_settings(
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update company_state tax jurisdiction. MANAGER or SYSADMIN only."""
    service = PurchaseService(db, tenant_ctx)
    state = await service.set_jurisdiction(req.company_state)
    return {"company_state": state, "message": "Tax jurisdiction updated."}


# ─────────────────────────── Phase 4B: Submit PO ──────────────────────────────

@router.post(
    "/orders/{order_id}/submit",
    response_model=dict,
    summary="Submit Purchase Order (DRAFT → CONFIRMED)",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def submit_purchase_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Submit a DRAFT purchase order for fulfilment (sets status to CONFIRMED)."""
    return await PurchaseService(db, tenant_ctx).submit_purchase_order(order_id)


# ─────────────────────────── Phase 4B: Reports ────────────────────────────────

@router.get("/reports/outstanding", summary="Supplier Outstanding Report")
async def get_outstanding_report(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List suppliers with open (DRAFT/CONFIRMED) POs and total outstanding values."""
    return await PurchaseService(db, tenant_ctx).get_outstanding_suppliers()


@router.get("/reports/pending-delivery", summary="Pending Delivery Report")
async def get_pending_delivery_report(
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Return the last GRN unit cost for this supplier+product combination.
    Falls back to last PO unit cost if no GRN exists.
    """
    return await PurchaseService(db, tenant_ctx).get_supplier_default_rate(supplier_id, product_id)

