"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context, require_permission
from ...schemas.purchase import (
    PurchaseConfigJurisdictionRequest,
    PurchaseJurisdictionConfigCreate,
    PurchaseOrderAmendRequest,
    PurchaseOrderCancelRequest,
    PurchaseOrderCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderResponse,
    PurchaseReceiptCreate,
    PurchaseReceiptItemResponse,
    PurchaseReceiptResponse,
    PurchaseReorderConvertRequest,
    SupplierCreate,
    SupplierResponse,
    SupplierUpdate,
)
from ...services.purchase import PurchaseService

router = APIRouter()

# ─────────────────────────── Suppliers ───────────────────────────

@router.post(
    "/suppliers/",
    response_model=SupplierResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SUPPLIER.MANAGE"))],
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
    response_model=list[SupplierResponse],
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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

@router.get(
    "/orders/",
    response_model=list[PurchaseOrderResponse],
    summary="List Purchase Orders (Contract URL)",
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
)
async def list_purchase_orders_contract(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List purchase orders — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).list_purchase_orders()


@router.post(
    "/orders/",
    response_model=PurchaseOrderResponse,
    status_code=201,
    summary="Create Purchase Order (Contract URL)",
    dependencies=[Depends(require_permission("PURCHASE.CREATE"))],
)
async def create_purchase_order_contract(
    order_in: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a purchase order — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).create_purchase_order(order_in)


@router.get(
    "/orders/{order_id}",
    response_model=PurchaseOrderResponse,
    summary="Get Purchase Order (Contract URL)",
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
)
async def get_purchase_order_contract(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a purchase order by ID — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).get_purchase_order(order_id)


@router.post(
    "/orders/{order_id}/cancel",
    response_model=dict,
    status_code=200,
    summary="Cancel Purchase Order (Contract URL)",
    dependencies=[Depends(require_permission("PURCHASE.APPROVE"))],
)
async def cancel_purchase_order_contract(
    order_id: str,
    req: PurchaseOrderCancelRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Cancel a purchase order — canonical contract URL."""
    return await PurchaseService(db, tenant_ctx).cancel_purchase_order(order_id, req.reason)


@router.post(
    "/orders/{order_id}/amend",
    response_model=PurchaseOrderResponse,
    status_code=201,
    summary="Amend Purchase Order (Contract URL)",
    dependencies=[Depends(require_permission("PURCHASE.APPROVE"))],
)
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
    dependencies=[Depends(require_permission("PURCHASE.CREATE"))],
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
    response_model=list[PurchaseReceiptResponse],
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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
    dependencies=[Depends(require_permission("SUPPLIER.MANAGE"))],
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
    dependencies=[Depends(require_permission("SUPPLIER.MANAGE"))],
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
    dependencies=[Depends(require_permission("PURCHASE.APPROVE"))],
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
    dependencies=[Depends(require_permission("PURCHASE.APPROVE"))],
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
    response_model=list[dict],
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
)
async def list_reorder_suggestions(
    supplier_id: str | None = Query(None),
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
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
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

@router.get(
    "/settings",
    summary="Purchase Settings — company jurisdiction (AD-1)",
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
)
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
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
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


# ─────────────────────────── Legacy Purchase Config Aliases ─────────────────────────

@router.get(
    "/config",
    summary="Purchase Config Legacy Alias",
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
)
async def get_purchase_config(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Legacy purchase configuration compatibility alias."""
    service = PurchaseService(db, tenant_ctx)
    state = await service.get_jurisdiction()
    return {"companyState": state}


@router.post(
    "/config/jurisdiction",
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
    summary="Legacy Purchase Config Jurisdiction Alias",
)
async def update_purchase_config_jurisdiction(
    req: PurchaseConfigJurisdictionRequest,
    db: AsyncSession = Depends(get_db),
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
    dependencies=[Depends(require_permission("PURCHASE.CREATE"))],
    summary="Legacy Purchase Reorder Suggestions Convert Alias",
)
async def convert_reorder_suggestions(
    req: PurchaseReorderConvertRequest,
    db: AsyncSession = Depends(get_db),
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
    dependencies=[Depends(require_permission("PURCHASE.APPROVE"))],
)
async def submit_purchase_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Submit a DRAFT purchase order for fulfilment (sets status to CONFIRMED)."""
    return await PurchaseService(db, tenant_ctx).submit_purchase_order(order_id)


# ─────────────────────────── Phase 4B: Reports ────────────────────────────────

@router.get(
    "/reports/outstanding",
    summary="Supplier Outstanding Report",
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
async def get_outstanding_report(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List suppliers with open (DRAFT/CONFIRMED) POs and total outstanding values."""
    return await PurchaseService(db, tenant_ctx).get_outstanding_suppliers()


@router.get(
    "/reports/pending-delivery",
    summary="Pending Delivery Report",
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
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
    dependencies=[Depends(require_permission("PURCHASE.VIEW"))],
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

