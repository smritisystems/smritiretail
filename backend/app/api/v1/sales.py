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
from ...repositories.sales import SalesInvoiceRepository
from ...schemas.sales import (
    SalesInvoiceCreate,
    SalesInvoiceResponse,
    SalesInvoiceUpdate,
    SalesOrderCreate,
    SalesOrderItemResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
    SalesQuotationCreate,
    SalesQuotationItemResponse,
    SalesQuotationResponse,
    SalesQuotationUpdate,
    SalesReturnCreate,
    SalesReturnItemResponse,
    SalesReturnResponse,
    SalesReturnUpdate,
)
from ...services.sales import SalesService

router = APIRouter()



# ─────────────────────────── Sales Invoice — Contract URL Aliases (Phase 4A) ───────────────────────────
# Contract URLs per frontend PAL: mounted at /api/v1/sales, these resolve to /api/v1/sales/invoices
# The legacy GET / and POST / at /api/v1/sales-invoices are deprecated.

@router.post(
    "/invoices",
    response_model=SalesInvoiceResponse,
    status_code=201,
    summary="Create Sales Invoice (Contract URL)",
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
async def create_sales_invoice_contract(
    invoice_in: SalesInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a sales invoice — canonical contract URL."""
    updates = {}
    if not invoice_in.id:
        import uuid
        updates["id"] = f"inv-{uuid.uuid4().hex[:8]}"
    if not invoice_in.invoice_no:
        import uuid
        from datetime import datetime
        updates["invoice_no"] = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    if updates:
        invoice_in = invoice_in.model_copy(update=updates)
    return await SalesService(db, tenant_ctx).create_sales_invoice(invoice_in)


@router.get(
    "/invoices",
    response_model=list[SalesInvoiceResponse],
    summary="List Sales Invoices (Contract URL)",
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def list_sales_invoices_contract(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List sales invoices — canonical contract URL."""
    repo = SalesInvoiceRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get(
    "/invoices/{invoice_id}",
    response_model=SalesInvoiceResponse,
    summary="Get Sales Invoice (Contract URL)",
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def get_sales_invoice_contract(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a single sales invoice by ID."""
    service = SalesService(db, tenant_ctx)
    invoice, _ = await service.get_sales_invoice(invoice_id)
    return invoice


# ─────────────────────────── Sales Quotation ───────────────────────────

@router.post(
    "/quotations",
    response_model=SalesQuotationResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
@router.post(
    "/quotations/",
    response_model=SalesQuotationResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
async def create_sales_quotation(
    q_in: SalesQuotationCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_quotation(q_in)


@router.get(
    "/quotations",
    response_model=list[SalesQuotationResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
@router.get(
    "/quotations/",
    response_model=list[SalesQuotationResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def list_sales_quotations(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).list_sales_quotations()


@router.get(
    "/quotations/{quotation_id}",
    response_model=SalesQuotationResponse,
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def get_sales_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    service = SalesService(db, tenant_ctx)
    q, items = await service.get_sales_quotation(quotation_id)
    resp = SalesQuotationResponse.model_validate(q)
    resp.items = [SalesQuotationItemResponse.model_validate(i) for i in items]
    return resp


@router.put(
    "/quotations/{quotation_id}",
    response_model=SalesQuotationResponse,
    dependencies=[Depends(require_permission("SALES.UPDATE"))],
)
async def update_sales_quotation(
    quotation_id: str,
    update_in: SalesQuotationUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales quotation. MANAGER / SYSADMIN only."""
    return await SalesService(db, tenant_ctx).update_sales_quotation(quotation_id, update_in)


@router.delete(
    "/quotations/{quotation_id}",
    status_code=204,
    dependencies=[Depends(require_permission("SALES.DELETE"))],
)
async def delete_sales_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales quotation. MANAGER / SYSADMIN only."""
    await SalesService(db, tenant_ctx).delete_sales_quotation(quotation_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Order ───────────────────────────

@router.post(
    "/orders",
    response_model=SalesOrderResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
@router.post(
    "/orders/",
    response_model=SalesOrderResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
async def create_sales_order(
    so_in: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_order(so_in)


@router.get(
    "/orders",
    response_model=list[SalesOrderResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
@router.get(
    "/orders/",
    response_model=list[SalesOrderResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def list_sales_orders(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).list_sales_orders()


@router.get(
    "/orders/{order_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def get_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    service = SalesService(db, tenant_ctx)
    so, items = await service.get_sales_order(order_id)
    resp = SalesOrderResponse.model_validate(so)
    resp.items = [SalesOrderItemResponse.model_validate(i) for i in items]
    return resp


@router.put(
    "/orders/{order_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require_permission("SALES.UPDATE"))],
)
async def update_sales_order(
    order_id: str,
    update_in: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales order. MANAGER / SYSADMIN only."""
    return await SalesService(db, tenant_ctx).update_sales_order(order_id, update_in)


@router.delete(
    "/orders/{order_id}",
    status_code=204,
    dependencies=[Depends(require_permission("SALES.DELETE"))],
)
async def delete_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales order. MANAGER / SYSADMIN only."""
    await SalesService(db, tenant_ctx).delete_sales_order(order_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Return ───────────────────────────

@router.post(
    "/returns",
    response_model=SalesReturnResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
@router.post(
    "/returns/",
    response_model=SalesReturnResponse,
    status_code=201,
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
async def create_sales_return(
    sr_in: SalesReturnCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_return(sr_in)


@router.get(
    "/returns",
    response_model=list[SalesReturnResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
@router.get(
    "/returns/",
    response_model=list[SalesReturnResponse],
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def list_sales_returns(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).list_sales_returns()


@router.get(
    "/returns/{return_id}",
    response_model=SalesReturnResponse,
    dependencies=[Depends(require_permission("SALES.VIEW"))],
)
async def get_sales_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    service = SalesService(db, tenant_ctx)
    sr, items = await service.get_sales_return(return_id)
    resp = SalesReturnResponse.model_validate(sr)
    resp.items = [SalesReturnItemResponse.model_validate(i) for i in items]
    return resp


@router.put(
    "/returns/{return_id}",
    response_model=SalesReturnResponse,
    dependencies=[Depends(require_permission("SALES.UPDATE"))],
)
async def update_sales_return(
    return_id: str,
    update_in: SalesReturnUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales return. MANAGER / SYSADMIN only."""
    return await SalesService(db, tenant_ctx).update_sales_return(return_id, update_in)


@router.delete(
    "/returns/{return_id}",
    status_code=204,
    dependencies=[Depends(require_permission("SALES.DELETE"))],
)
async def delete_sales_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales return. MANAGER / SYSADMIN only."""
    await SalesService(db, tenant_ctx).delete_sales_return(return_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Invoice UPDATE / CANCEL ───────────────────────────

@router.put(
    "/{invoice_id}",
    response_model=SalesInvoiceResponse,
    dependencies=[Depends(require_permission("SALES.UPDATE"))],
)
async def update_sales_invoice(
    invoice_id: str,
    update_in: SalesInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Partial-update a sales invoice.
    If 'items' is included, old line items are replaced and totals re-computed server-side.
    Stock is NOT adjusted on update; use Sales Returns for stock reversal.
    MANAGER / SYSADMIN only.
    """
    return await SalesService(db, tenant_ctx).update_sales_invoice(invoice_id, update_in)


@router.delete(
    "/{invoice_id}",
    status_code=200,
    dependencies=[Depends(require_permission("SALES.DELETE"))],
)
async def cancel_sales_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Cancel a sales invoice (status → 'Cancelled', soft-delete).
    Mirrors Express DELETE /api/sales/invoices/:id.
    MANAGER / SYSADMIN only.
    """
    invoice = await SalesService(db, tenant_ctx).cancel_sales_invoice(invoice_id)
    return {"success": True, "message": f"Invoice {invoice.invoice_no} cancelled successfully."}


# ─────────────────────────── Phase 4B: Convert Quotation ─────────────────────

@router.post(
    "/quotations/convert/{quotation_id}",
    status_code=201,
    summary="Convert Quotation to Invoice",
    dependencies=[Depends(require_permission("SALES.CREATE"))],
)
async def convert_quotation_to_invoice(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Convert a sales quotation to a sales invoice.
    Quotation status must be Draft, Submitted, or Approved.
    Sets quotation status to Converted and creates a new Draft invoice.
    """
    return await SalesService(db, tenant_ctx).convert_quotation_to_invoice(quotation_id)
