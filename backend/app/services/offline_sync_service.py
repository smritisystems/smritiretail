"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sales import SalesInvoice
from ..models.payment_ledger import PaymentTransaction
from ..models.crm import Customer
from .unified_sales_ledger_service import UnifiedSalesLedgerService
from .unified_pricing_payment_service import UnifiedPricingPaymentService
from .outbox_service import OutboxService


class OfflineSyncService:
    """
    SMRITI Offline-First Synchronization Engine (Section 10).
    Processes durable offline terminal transaction queues, guarantees idempotent
    deduplication across intermittent network partitions, and commits atomic ledger entries.
    """

    @classmethod
    async def process_sync_batch(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        batch_id: str,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Atomically ingests a batch of offline-generated transactions from a POS terminal.
        """
        processed_count = 0
        deduplicated_count = 0
        results = []

        for txn in transactions:
            txn_type = txn.get("type", "SALES_INVOICE")
            client_id = txn.get("client_id") or txn.get("invoice_no") or txn.get("id")

            if txn_type == "SALES_INVOICE":
                invoice_no = txn.get("invoice_no") or f"INV-OFF-{uuid.uuid4().hex[:8].upper()}"
                
                # Check for idempotent deduplication
                stmt = select(SalesInvoice).where(
                    SalesInvoice.company_id == company_id,
                    SalesInvoice.invoice_no == invoice_no,
                    SalesInvoice.is_deleted == False
                )
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if existing:
                    deduplicated_count += 1
                    results.append({
                        "client_id": client_id,
                        "status": "ALREADY_PROCESSED",
                        "server_id": existing.id,
                        "invoice_no": existing.invoice_no
                    })
                    continue

                # Process new offline sales invoice
                customer_id = txn.get("customer_id") or "CUST-WALKIN"
                cust_stmt = select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
                cust = (await session.execute(cust_stmt)).scalar_one_or_none()
                if not cust:
                    cust = Customer(
                        id=customer_id,
                        company_id=company_id,
                        branch_id=None,
                        name="Walk-in Customer",
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(cust)
                    await session.flush()

                items_data = txn.get("items", [])
                is_interstate = bool(txn.get("is_interstate", False))
                payment_mode = txn.get("payment_mode", "CASH")

                created_inv = await UnifiedSalesLedgerService.post_sales_invoice(
                    session=session,
                    company_id=company_id,
                    invoice_no=invoice_no,
                    customer_id=customer_id,
                    items_data=items_data,
                    branch_id=branch_id,
                    is_interstate=is_interstate,
                    payment_mode=payment_mode
                )
                processed_count += 1
                results.append({
                    "client_id": client_id,
                    "status": "COMMITTED",
                    "server_id": created_inv.id,
                    "invoice_no": created_inv.invoice_no,
                    "grand_total": float(created_inv.grand_total)
                })

        return {
            "batch_id": batch_id,
            "company_id": company_id,
            "branch_id": branch_id,
            "total_received": len(transactions),
            "processed_count": processed_count,
            "deduplicated_count": deduplicated_count,
            "results": results
        }
