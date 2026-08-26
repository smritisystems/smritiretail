"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-11
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from ...api.deps import get_company_db, get_tenant_context, TenantContext, require_role, require_permission
from ...models.auth import UserRole
from ...schemas.sales import (
    SalesInvoiceCreate, SalesInvoiceUpdate, SalesInvoiceResponse,
    SalesQuotationCreate, SalesQuotationUpdate, SalesQuotationResponse, SalesQuotationItemResponse,
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderItemResponse, SalesOrderInvoiceAllocationResponse,
    SalesReturnCreate, SalesReturnUpdate, SalesReturnResponse, SalesReturnItemResponse,
)
from ...repositories.sales import SalesInvoiceRepository
from ...services.sales import SalesService
from ...services.eway_bill_service import EWayBillService

router = APIRouter()



# ─────────────────────────── Sales Invoice — Contract URL Aliases (Phase 4A) ───────────────────────────
# Contract URLs per frontend PAL: mounted at /api/v1/sales, these resolve to /api/v1/sales/invoices
# The legacy GET / and POST / at /api/v1/sales-invoices are deprecated.

@router.post(
    "/invoices",
    response_model=SalesInvoiceResponse,
    status_code=201,
    summary="Create Sales Invoice (Contract URL)",
    dependencies=[Depends(require_permission("sales_billing", "NEW"))],
)
async def create_sales_invoice_contract(
    invoice_in: SalesInvoiceCreate,
    request: Request,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a sales invoice — canonical contract URL with Idempotency-Key support."""
    idempotency_key = request.headers.get("idempotency-key") or request.headers.get("Idempotency-Key")
    return await SalesService(db, tenant_ctx).create_sales_invoice(invoice_in, idempotency_key=idempotency_key)


@router.get("/invoices", response_model=List[SalesInvoiceResponse], summary="List Sales Invoices (Contract URL)")
async def list_sales_invoices_contract(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=5000),
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List sales invoices with optional status/customer filter — canonical contract URL."""
    repo = SalesInvoiceRepository(db, tenant_ctx)
    if status or customer_id or q:
        return await repo.search(invoice_no=q, customer_id=customer_id, status=status, skip=skip, limit=limit)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/invoices/suspended", response_model=List[SalesInvoiceResponse], summary="List Suspended Invoices")
async def list_suspended_sales_invoices(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all currently suspended/held sales invoices for active tenant."""
    repo = SalesInvoiceRepository(db, tenant_ctx)
    return await repo.search(status="Suspended", limit=100)


@router.get(
    "/invoices/by-number/{invoice_no:path}",
    response_model=SalesInvoiceResponse,
    summary="Get Sales Invoice Detail by Invoice Number",
)
async def get_sales_invoice_by_number_contract(
    invoice_no: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get single sales invoice detail by invoice number supporting slashes under active tenant context."""
    repo = SalesInvoiceRepository(db, tenant_ctx)
    inv = await repo.get(invoice_no)
    if not inv:
        raise HTTPException(status_code=404, detail="Sales invoice not found")
    return inv


@router.get(
    "/invoices/{invoice_id}",
    response_model=SalesInvoiceResponse,
    summary="Get Sales Invoice Detail",
)
async def get_sales_invoice_contract(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get single sales invoice detail by ID under active tenant context."""
    repo = SalesInvoiceRepository(db, tenant_ctx)
    inv = await repo.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Sales invoice not found")
    return inv


@router.get(
    "/invoices/{invoice_id}/html",
    response_class=Response,
    summary="Render Sales Invoice HTML Print Preview",
)
@router.get(
    "/invoices/{invoice_id}/preview",
    response_class=Response,
    summary="Render Canonical Sales Invoice Preview",
)
async def get_sales_invoice_preview_contract(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Render authoritative GST Tax Invoice HTML from single Canonical TaxInvoiceRenderer."""
    from ...services.invoice_pdf_service import InvoicePdfService
    html_content = await InvoicePdfService.generate_invoice_html(
        session=db,
        invoice_id=invoice_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    return Response(content=html_content, media_type="text/html")


@router.get(
    "/invoices/{invoice_id}/print",
    response_class=Response,
    summary="Render Canonical Sales Invoice for Browser Print",
)
async def get_sales_invoice_print_contract(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Render canonical HTML invoice configured for automatic browser print."""
    from ...services.invoice_pdf_service import InvoicePdfService
    html_content = await InvoicePdfService.generate_invoice_html(
        session=db,
        invoice_id=invoice_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    auto_print_html = html_content + "\n<script>window.addEventListener('load', function() { window.print(); });</script>"
    return Response(content=auto_print_html, media_type="text/html")


@router.get(
    "/invoices/{invoice_id}/reprint",
    response_class=Response,
    summary="Render Canonical Sales Invoice Reprint Document",
)
async def get_sales_invoice_reprint_contract(
    invoice_id: str,
    format: Optional[str] = "pdf",
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieve immutable historical invoice document artifact by SHA256 integrity for reprinting."""
    from ...services.invoice_pdf_service import InvoicePdfService
    if format == "html":
        html_content = await InvoicePdfService.generate_invoice_html(
            session=db,
            invoice_id=invoice_id,
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id
        )
        return Response(content=html_content, media_type="text/html")
    
    pdf_bytes, meta = await InvoicePdfService.get_or_render_pdf_artifact(
        session=db,
        invoice_id=invoice_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    safe_no = meta.get("invoice_no", invoice_id).replace("/", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="TaxInvoice_{safe_no}_REPRINT.pdf"'}
    )


@router.get(
    "/invoices/{invoice_id}/pdf",
    response_class=Response,
    summary="Stream Sales Invoice PDF Document",
)
async def get_sales_invoice_pdf_stream(
    invoice_id: str,
    format: Optional[str] = None,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Stream rendered Tax Invoice PDF document from single Canonical TaxInvoiceRenderer."""
    from ...services.invoice_pdf_service import InvoicePdfService
    if format == "binary":
        pdf_bytes, meta = await InvoicePdfService.get_or_render_pdf_artifact(
            session=db,
            invoice_id=invoice_id,
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id
        )
        safe_no = meta.get("invoice_no", invoice_id).replace("/", "_")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="TaxInvoice_{safe_no}.pdf"'}
        )
    html_content = await InvoicePdfService.generate_invoice_html(
        session=db,
        invoice_id=invoice_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    return Response(content=html_content, media_type="text/html")


@router.get(
    "/invoices/{invoice_id}/download",
    response_class=Response,
    summary="Download Sales Invoice PDF Attachment",
)
async def get_sales_invoice_download_attachment(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Download Tax Invoice PDF document as an attachment from single Canonical TaxInvoiceRenderer."""
    from ...services.invoice_pdf_service import InvoicePdfService
    pdf_bytes, meta = await InvoicePdfService.get_or_render_pdf_artifact(
        session=db,
        invoice_id=invoice_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    safe_no = meta.get("invoice_no", invoice_id).replace("/", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="TaxInvoice_{safe_no}.pdf"'}
    )


# ─────────────────────────── Sales Quotation ───────────────────────────

@router.post(
    "/quotations",
    response_model=SalesQuotationResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "NEW"))],
)
@router.post(
    "/quotations/",
    response_model=SalesQuotationResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "NEW"))],
)
async def create_sales_quotation(
    q_in: SalesQuotationCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_quotation(q_in)


@router.get("/quotations", response_model=List[SalesQuotationResponse])
@router.get("/quotations/", response_model=List[SalesQuotationResponse])
async def list_sales_quotations(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).list_sales_quotations()


@router.get("/quotations/{quotation_id}", response_model=SalesQuotationResponse)
async def get_sales_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_permission("sales_billing", "EDIT"))],
)
async def update_sales_quotation(
    quotation_id: str,
    update_in: SalesQuotationUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales quotation."""
    return await SalesService(db, tenant_ctx).update_sales_quotation(quotation_id, update_in)


@router.delete(
    "/quotations/{quotation_id}",
    status_code=204,
    dependencies=[Depends(require_permission("sales_billing", "DELETE"))],
)
async def delete_sales_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales quotation."""
    await SalesService(db, tenant_ctx).delete_sales_quotation(quotation_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Order ───────────────────────────

@router.post(
    "/orders",
    response_model=SalesOrderResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "NEW"))],
)
@router.post(
    "/orders/",
    response_model=SalesOrderResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "NEW"))],
)
async def create_sales_order(
    order_in: SalesOrderCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_order(order_in)


@router.get("/orders", response_model=List[SalesOrderResponse])
@router.get("/orders/", response_model=List[SalesOrderResponse])
async def list_sales_orders(
    customer: Optional[str] = Query(default=None, description="Filter by customer ID or name"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    fulfillment_status: Optional[str] = Query(default=None, description="Filter by fulfillment status"),
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date: Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List sales orders with query parameter filters and tenant isolation."""
    return await SalesService(db, tenant_ctx).list_sales_orders(
        customer_id=customer,
        status=status,
        fulfillment_status=fulfillment_status,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit,
    )


@router.get("/orders/{order_id}", response_model=SalesOrderResponse)
async def get_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get single sales order with explicit item and allocation serialization."""
    service = SalesService(db, tenant_ctx)
    order, items, allocations = await service.get_sales_order(order_id)
    resp = SalesOrderResponse.model_validate(order)
    resp.items = [SalesOrderItemResponse.model_validate(i) for i in items]
    resp.allocations = [SalesOrderInvoiceAllocationResponse.model_validate(a) for a in allocations]
    return resp


@router.put(
    "/orders/{order_id}",
    response_model=SalesOrderResponse,
    dependencies=[Depends(require_permission("sales_billing", "EDIT"))],
)
async def update_sales_order(
    order_id: str,
    update_in: SalesOrderUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales order."""
    return await SalesService(db, tenant_ctx).update_sales_order(order_id, update_in)


@router.delete(
    "/orders/{order_id}",
    status_code=204,
    dependencies=[Depends(require_permission("sales_billing", "DELETE"))],
)
async def delete_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales order."""
    await SalesService(db, tenant_ctx).delete_sales_order(order_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Return ───────────────────────────

@router.post(
    "/returns",
    response_model=SalesReturnResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "RETURN"))],
)
@router.post(
    "/returns/",
    response_model=SalesReturnResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales_billing", "RETURN"))],
)
async def create_sales_return(
    sr_in: SalesReturnCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).create_sales_return(sr_in)


@router.get("/returns", response_model=List[SalesReturnResponse])
@router.get("/returns/", response_model=List[SalesReturnResponse])
async def list_sales_returns(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    return await SalesService(db, tenant_ctx).list_sales_returns()


@router.get("/returns/{return_id}", response_model=SalesReturnResponse)
async def get_sales_return(
    return_id: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_permission("sales_billing", "EDIT"))],
)
async def update_sales_return(
    return_id: str,
    update_in: SalesReturnUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Partial-update a sales return."""
    return await SalesService(db, tenant_ctx).update_sales_return(return_id, update_in)


@router.delete(
    "/returns/{return_id}",
    status_code=204,
    dependencies=[Depends(require_permission("sales_billing", "DELETE"))],
)
async def delete_sales_return(
    return_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a sales return."""
    await SalesService(db, tenant_ctx).delete_sales_return(return_id)
    return Response(status_code=204)


# ─────────────────────────── Sales Invoice UPDATE / CANCEL / VOID ───────────────────────────

@router.put("/{invoice_id}", response_model=SalesInvoiceResponse)
@router.patch("/{invoice_id}", response_model=SalesInvoiceResponse)
@router.put("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
@router.patch("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
async def update_sales_invoice(
    invoice_id: str,
    update_in: SalesInvoiceUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Partial-update a sales invoice.
    If 'items' is included, old line items are replaced and totals re-computed server-side.
    Stock is NOT adjusted on update; use Sales Returns for stock reversal.
    """
    return await SalesService(db, tenant_ctx).update_sales_invoice(invoice_id, update_in)


@router.delete(
    "/{invoice_id}",
    status_code=200,
    dependencies=[Depends(require_permission("sales_billing", "VOID"))],
)
@router.delete(
    "/invoices/{invoice_id}",
    status_code=200,
    dependencies=[Depends(require_permission("sales_billing", "VOID"))],
)
@router.post(
    "/invoices/{invoice_id}/void",
    status_code=200,
    dependencies=[Depends(require_permission("sales_billing", "VOID"))],
)
async def cancel_sales_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def convert_quotation_to_invoice(
    quotation_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Convert a sales quotation to a sales invoice.
    Quotation status must be Draft, Submitted, or Approved.
    Sets quotation status to Converted and creates a new Draft invoice.
    """
    return await SalesService(db, tenant_ctx).convert_quotation_to_invoice(quotation_id)


# ─────────────────────────── E-Way Bill Generation ───────────────────────────

@router.get(
    "/invoices/{invoice_id}/eway-bill-payload",
    dependencies=[Depends(require_permission("sales_billing", "VIEW"))],
)
@router.get(
    "/{invoice_id}/eway-bill-payload",
    dependencies=[Depends(require_permission("sales_billing", "VIEW"))],
)
async def get_invoice_eway_bill_payload(
    invoice_id: str,
    transporter_name: Optional[str] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    lr_number: Optional[str] = Query(None),
    distance_km: int = Query(50, ge=1, le=4000),
    trans_mode: str = Query("1"),
    strict_validation: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate official GST NIC E-Way Bill JSON payload for B2B Sales Invoice."""
    service = EWayBillService(db, tenant_ctx)
    return await service.generate_invoice_eway_bill_payload(
        invoice_id=invoice_id,
        transporter_name=transporter_name,
        vehicle_no=vehicle_no,
        lr_number=lr_number,
        trans_distance_km=distance_km,
        trans_mode=trans_mode,
        strict_validation=strict_validation
    )

