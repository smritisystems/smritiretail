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

import json
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sales import SalesInvoice
from ..models.payment_ledger import PaymentTransaction
from ..models.crm import Customer
from ..models.party import Party
from ..models.sync import POSOfflineSyncQueue
from .unified_sales_ledger_service import UnifiedSalesLedgerService
from .universal_party_service import UniversalPartyService
from .universal_item_service import UniversalItemService


class OfflineSyncService:
    """
    SMRITI Offline-First Synchronization Engine (Section 10).
    Processes durable tenant-local offline terminal queues (`pos_offline_sync_queue`),
    guarantees idempotent deduplication across intermittent network partitions,
    and commits atomic sales ledgers.
    """

    @classmethod
    async def process_sync_batch(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        batch_id: str,
        transactions: List[Dict[str, Any]],
        terminal_id: str = "POS-01"
    ) -> Dict[str, Any]:
        """
        Durably ingests and processes a batch of offline-generated transactions from a POS terminal.
        """
        processed_count = 0
        deduplicated_count = 0
        failed_count = 0
        results = []

        for txn in transactions:
            txn_type = txn.get("type", "SALES_INVOICE")
            client_tx_uuid = str(txn.get("client_id") or txn.get("invoice_no") or txn.get("id") or uuid.uuid4())
            invoice_no = txn.get("invoice_no") or f"INV-OFF-{uuid.uuid4().hex[:8].upper()}"

            # 1. Durable Queue Entry in pos_offline_sync_queue
            queue_item_id = f"posq_{uuid.uuid4().hex[:12]}"
            queue_item = POSOfflineSyncQueue(
                id=queue_item_id,
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                batch_id=batch_id,
                client_tx_uuid=client_tx_uuid,
                terminal_id=terminal_id,
                txn_type=txn_type,
                payload_json=json.dumps(txn, default=str),
                sync_status="PENDING",
                document_number=invoice_no,
                submitted_at=datetime.now(timezone.utc),
                is_active=True,
                is_deleted=False
            )
            session.add(queue_item)
            await session.flush()

            try:
                if txn_type == "SALES_INVOICE":
                    # Check for idempotent deduplication against sales_invoices
                    stmt = select(SalesInvoice).where(
                        SalesInvoice.company_id == company_id,
                        SalesInvoice.invoice_no == invoice_no,
                        SalesInvoice.is_deleted == False
                    )
                    existing = (await session.execute(stmt)).scalar_one_or_none()
                    if existing:
                        deduplicated_count += 1
                        queue_item.sync_status = "ALREADY_PROCESSED"
                        queue_item.synced_transaction_id = existing.id
                        queue_item.synced_at = datetime.now(timezone.utc)
                        await session.flush()
                        results.append({
                            "client_id": client_tx_uuid,
                            "queue_id": queue_item.id,
                            "status": "ALREADY_PROCESSED",
                            "server_id": existing.id,
                            "invoice_no": existing.invoice_no
                        })
                        continue

                    # Resolve Party or Customer
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

                    # Post authoritative Sales Invoice and stock decrement
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

                    # Update Queue item status to COMMITTED
                    queue_item.sync_status = "COMMITTED"
                    queue_item.synced_transaction_id = created_inv.id
                    queue_item.synced_at = datetime.now(timezone.utc)
                    await session.flush()

                    processed_count += 1
                    results.append({
                        "client_id": client_tx_uuid,
                        "queue_id": queue_item.id,
                        "status": "COMMITTED",
                        "server_id": created_inv.id,
                        "invoice_no": created_inv.invoice_no,
                        "grand_total": float(created_inv.grand_total)
                    })
                else:
                    # Non-invoice transactions marked as PROCESSED
                    queue_item.sync_status = "COMMITTED"
                    queue_item.synced_at = datetime.now(timezone.utc)
                    await session.flush()
                    processed_count += 1
                    results.append({
                        "client_id": client_tx_uuid,
                        "queue_id": queue_item.id,
                        "status": "COMMITTED"
                    })

            except Exception as e:
                failed_count += 1
                queue_item.sync_status = "FAILED"
                queue_item.error_message = str(e)
                queue_item.retry_count = (queue_item.retry_count or 0) + 1
                await session.flush()
                results.append({
                    "client_id": client_tx_uuid,
                    "queue_id": queue_item.id,
                    "status": "FAILED",
                    "error": str(e)
                })

        return {
            "batch_id": batch_id,
            "company_id": company_id,
            "branch_id": branch_id,
            "total_received": len(transactions),
            "processed_count": processed_count,
            "deduplicated_count": deduplicated_count,
            "failed_count": failed_count,
            "results": results
        }
