"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

sales_invoicing.py — REST API gateway for Outbound Sales Invoices & Customer Multi-Channel Payment Receipts.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.sales import SalesInvoice
from app.sales.engine.invoicing_engine import SalesInvoicingEngine
from app.schemas.sales_invoicing import (
    SalesInvoiceResponse, SalesPaymentCreate, SalesPaymentResponse, CustomerStatementResponse
)

router = APIRouter(prefix="/sales", tags=["Sales Invoicing & Payment Settlement"])


@router.post("/invoices/from-order/{order_id}", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def generate_invoice_from_order(
    order_id: str,
    is_interstate: bool = Query(False, description="Set True for interstate supply (IGST)"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Converts a confirmed/shipped SalesOrder into a tax-compliant SalesInvoice with GST breakdown.
    """
    engine = SalesInvoicingEngine(db, tenant)
    return await engine.generate_invoice_from_order(order_id, is_interstate=is_interstate)


@router.get("/invoices/{id}", response_model=SalesInvoiceResponse)
async def get_sales_invoice(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves sales invoice details by ID.
    """
    stmt = select(SalesInvoice).where(
        SalesInvoice.id == id,
        SalesInvoice.is_deleted == False,
        SalesInvoice.company_id == tenant.company_id
    )
    invoice = (await db.execute(stmt)).scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Sales invoice '{id}' not found.")
    return invoice


@router.post("/payments", response_model=SalesPaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_customer_payment(
    payload: SalesPaymentCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Records a customer payment receipt (CASH, CARD, UPI, CREDIT) and updates invoice balance and customer ledger.
    """
    engine = SalesInvoicingEngine(db, tenant)
    return await engine.record_payment(
        invoice_id=payload.invoice_id,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_no=payload.reference_no,
        notes=payload.notes
    )


@router.get("/customers/{customer_id}/statement", response_model=CustomerStatementResponse)
async def get_customer_statement(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves customer account ledger summary and outstanding balance statement.
    """
    engine = SalesInvoicingEngine(db, tenant)
    return await engine.get_customer_statement(customer_id)
