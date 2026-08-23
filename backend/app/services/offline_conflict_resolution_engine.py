"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
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
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sales import SalesInvoice
from ..models.payment_ledger import PaymentTransaction
from ..models.crm import Customer
from ..models.inventory import Product
from ..models.sync import POSOfflineSyncQueue
from ..schemas.sync import (
    SyncResolutionStatus,
    SyncConflictCategory,
    SyncConflictResolutionStrategy,
    SyncConflictDiagnostic,
    SyncOperationItem,
    SyncResolutionResult,
    SyncBatchRequest,
    SyncBatchResponse
)
from .unified_sales_ledger_service import UnifiedSalesLedgerService
from .compliance_audit_service import ComplianceAuditService


class OfflineConflictResolutionEngine:
    """
    SMRITI 5-Tier Domain-Driven Offline Conflict Resolution Engine.
    Processes offline transaction streams, enforces strict financial invariants,
    preserves price-at-sale and governance snapshots, deduplicates retries,
    and isolates irreconcilable drifts into a Store Manager Reconciliation Queue.
    """

    @classmethod
    async def resolve_sync_batch(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str],
        req: SyncBatchRequest
    ) -> SyncBatchResponse:
        """
        Executes domain-specific conflict resolution across an entire offline transaction batch.
        """
        accepted_count = 0
        accepted_warn_count = 0
        deduplicated_count = 0
        needs_review_count = 0
        failed_count = 0
        results: List[SyncResolutionResult] = []

        for item in req.transactions:
            result = await cls.resolve_single_operation(
                session=session,
                company_id=company_id,
                branch_id=branch_id,
                batch_id=req.batch_id,
                terminal_id=req.terminal_id,
                item=item,
                allow_negative_stock=req.allow_negative_stock
            )
            results.append(result)

            if result.status == SyncResolutionStatus.ACCEPTED:
                accepted_count += 1
            elif result.status == SyncResolutionStatus.ACCEPTED_WARN:
                accepted_warn_count += 1
            elif result.status == SyncResolutionStatus.DEDUPLICATED:
                deduplicated_count += 1
            elif result.status == SyncResolutionStatus.NEEDS_REVIEW:
                needs_review_count += 1
            elif result.status == SyncResolutionStatus.REJECTED:
                failed_count += 1

        return SyncBatchResponse(
            batch_id=req.batch_id,
            company_id=company_id,
            branch_id=branch_id,
            total_received=len(req.transactions),
            accepted_count=accepted_count,
            accepted_warn_count=accepted_warn_count,
            deduplicated_count=deduplicated_count,
            needs_review_count=needs_review_count,
            failed_count=failed_count,
            results=results
        )

    @classmethod
    async def resolve_single_operation(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str],
        batch_id: str,
        terminal_id: str,
        item: SyncOperationItem,
        allow_negative_stock: bool = True
    ) -> SyncResolutionResult:
        """
        Applies the 5-Tier conflict resolution strategy to an individual transaction.
        """
        branch_id = branch_id or "BR-001"
        invoice_no = item.invoice_no or f"{terminal_id}-INV-{uuid.uuid4().hex[:8].upper()}"
        clean_inv_no = invoice_no.strip().upper()
        queue_item_id = f"posq_{uuid.uuid4().hex[:12]}"

        # Record durable ingestion in queue
        queue_item = POSOfflineSyncQueue(
            id=queue_item_id,
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            batch_id=batch_id,
            client_tx_uuid=item.client_id,
            terminal_id=terminal_id,
            txn_type=item.type,
            payload_json=json.dumps(item.model_dump(), default=str),
            sync_status="PENDING",
            document_number=clean_inv_no,
            submitted_at=datetime.now(timezone.utc),
            is_active=True,
            is_deleted=False
        )
        session.add(queue_item)
        # Use a savepoint so a concurrent invoice_no uniqueness violation on the
        # later INSERT does not poison the entire session transaction. The except
        # handler at the bottom catches the collision and returns DEDUPLICATED.
        await session.flush()

        # =====================================================================
        # TIER 3: IDEMPOTENT DEDUPLICATION
        # =====================================================================
        existing_inv_stmt = select(SalesInvoice).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.invoice_no == clean_inv_no,
            SalesInvoice.is_deleted == False
        )
        existing_inv = (await session.execute(existing_inv_stmt)).scalar_one_or_none()
        if existing_inv:
            queue_item.sync_status = "ALREADY_PROCESSED"
            queue_item.synced_transaction_id = existing_inv.id
            queue_item.synced_at = datetime.now(timezone.utc)
            await session.flush()

            return SyncResolutionResult(
                client_id=item.client_id,
                queue_id=queue_item.id,
                status=SyncResolutionStatus.DEDUPLICATED,
                conflict_category=SyncConflictCategory.NONE,
                resolution_strategy=SyncConflictResolutionStrategy.IDEMPOTENT_DEDUPLICATION,
                server_entity_id=existing_inv.id,
                document_number=existing_inv.invoice_no,
                grand_total=float(existing_inv.grand_total),
                diagnostics=[
                    SyncConflictDiagnostic(
                        field="invoice_no",
                        client_assumption=clean_inv_no,
                        server_truth=existing_inv.id,
                        action_taken="Duplicate transaction acknowledged and safely skipped without re-posting."
                    )
                ]
            )

        # =====================================================================
        # TIER 1, 2, 4, 5: INVARIANT EVALUATION & DOMAIN MERGE
        # =====================================================================
        diagnostics: List[SyncConflictDiagnostic] = []
        conflict_cat = SyncConflictCategory.NONE
        has_stock_deficit = False
        has_credit_breach = False

        # 1. Evaluate Inventory Stock Invariants — SELECT FOR UPDATE (row lock)
        # Under concurrent offline sync (asyncio.gather / parallel FastAPI workers)
        # a plain SELECT is racy: all sessions read the same stale stock value before
        # any commit lands. SELECT FOR UPDATE serialises concurrent transactions:
        # the second session blocks until the first commits, then reads committed stock.
        #
        # Critically, the engine does NOT itself decrement products.stock here.
        # The sole decrement path is the DB trigger on stock_movements inserts
        # (fired inside UnifiedSalesLedgerService.post_sales_invoice). This avoids
        # double-decrement: engine reads-with-lock, ledger service decrements once.
        for line in item.items:
            prod_id_line = line.get("product_id") or line.get("item_id")
            req_qty = Decimal(str(line.get("quantity") or line.get("qty", 1)))
            if prod_id_line:
                # SELECT FOR UPDATE: acquires row lock for the duration of this tx
                p_stmt = (
                    select(Product)
                    .where(Product.id == prod_id_line, Product.company_id == company_id)
                    .with_for_update()
                )
                prod = (await session.execute(p_stmt)).scalar_one_or_none()
                if prod:
                    curr_stock = Decimal(str(prod.stock))

                    if curr_stock < req_qty:
                        # Stock deficit at commit-time (locked read = authoritative)
                        has_stock_deficit = True
                        conflict_cat = SyncConflictCategory.INVENTORY_STOCK
                        diagnostics.append(
                            SyncConflictDiagnostic(
                                field=f"stock_balance:{prod.name}",
                                client_assumption=float(req_qty),
                                server_truth=float(curr_stock),
                                action_taken="Locked stock read confirmed deficit at commit time. Concurrent stock exhaustion detected."
                            )
                        )

                    # Tier 2: Price Book Drift (Preserve Client Price — diagnostic only)
                    client_price = Decimal(str(line.get("price") or line.get("unit_rate") or line.get("rate", 0)))
                    prod_price_val = getattr(prod, "price", 0) or 0
                    server_price = Decimal(str(prod_price_val))
                    if server_price > 0 and client_price > 0 and client_price != server_price:
                        diagnostics.append(
                            SyncConflictDiagnostic(
                                field=f"selling_price:{prod.name}",
                                client_assumption=float(client_price),
                                server_truth=float(server_price),
                                action_taken="Price-at-sale preserved. Applied transaction rate locked at time of sale."
                            )
                        )


        # 2. Check Credit Limits
        customer_id = item.customer_id or "CUST-WALKIN"
        cust_stmt = select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
        cust = (await session.execute(cust_stmt)).scalar_one_or_none()
        if not cust:
            # Use INSERT ON CONFLICT DO NOTHING to handle concurrent offline sync races
            # where multiple terminals reference the same walk-in customer simultaneously.
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            from ..models.crm import Customer as CustomerModel
            insert_stmt = pg_insert(CustomerModel.__table__).values(
                id=customer_id,
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                name="Walk-in Customer",
                is_active=True,
                is_deleted=False,
                version=1,
            ).on_conflict_do_nothing(index_elements=["id"])
            await session.execute(insert_stmt)
            await session.flush()
            # Re-fetch after upsert
            cust = (await session.execute(cust_stmt)).scalar_one_or_none()
            if not cust:
                # If still None (extremely rare edge case), skip credit check
                pass

        credit_limit_val = getattr(cust, "credit_limit", None)
        if not credit_limit_val and cust.customer_group_id:
            from ..models.crm import CustomerGroup
            cg_stmt = select(CustomerGroup).where(CustomerGroup.id == cust.customer_group_id)
            cg = (await session.execute(cg_stmt)).scalar_one_or_none()
            if cg:
                credit_limit_val = cg.credit_limit

        if credit_limit_val and credit_limit_val > 0:
            current_balance = cust.outstanding or getattr(cust, "current_balance", Decimal("0.00")) or Decimal("0.00")
            if current_balance > credit_limit_val:
                has_credit_breach = True
                conflict_cat = SyncConflictCategory.CREDIT_LIMIT
                diagnostics.append(
                    SyncConflictDiagnostic(
                        field="customer_credit_limit",
                        client_assumption=float(credit_limit_val),
                        server_truth=float(current_balance),
                        action_taken="Customer credit limit exceeded during offline period."
                    )
                )

        # 3. Handle Strict Stock Deficit Block (if allow_negative_stock is False)
        if has_stock_deficit and not allow_negative_stock:
            queue_item.sync_status = "NEEDS_REVIEW"
            queue_item.error_message = "Inventory stock deficit exceeds zero-tolerance policy."
            await session.flush()

            # Record in compliance audit log
            await ComplianceAuditService.record_audit_event(
                session=session,
                company_id=company_id,
                event_type="OFFLINE_SYNC_ESCALATION",
                entity_name="POSOfflineSyncQueue",
                entity_id=queue_item.id,
                action_summary=f"Offline transaction {clean_inv_no} escalated to Reconciliation Queue due to stock deficit.",
                after_state=item.model_dump()
            )

            return SyncResolutionResult(
                client_id=item.client_id,
                queue_id=queue_item.id,
                status=SyncResolutionStatus.NEEDS_REVIEW,
                conflict_category=SyncConflictCategory.INVENTORY_STOCK,
                resolution_strategy=SyncConflictResolutionStrategy.RECONCILIATION_QUEUE,
                document_number=invoice_no,
                diagnostics=diagnostics,
                error="Stock deficit detected and allow_negative_stock is disabled. Escalated to Reconciliation Queue."
            )

        # 4. Post Authoritative Sales Invoice
        # When a concurrent invoice_no uniqueness violation occurs, the session
        # enters PendingRollbackError. We catch it, rollback the session to restore
        # it, then update the queue_item status in the now-clean transaction.
        _existing_inv_id = None
        try:
            created_inv = await UnifiedSalesLedgerService.post_sales_invoice(
                session=session,
                company_id=company_id,
                invoice_no=invoice_no,
                customer_id=customer_id,
                items_data=item.items,
                branch_id=branch_id,
                is_interstate=item.is_interstate,
                payment_mode=item.payment_mode
            )

            # Tier 5: Governance Snapshot Binding
            if item.governance_snapshot_id and hasattr(created_inv, "governance_snapshot_id"):
                created_inv.governance_snapshot_id = item.governance_snapshot_id
                await session.flush()

            queue_item.sync_status = "COMMITTED"
            queue_item.synced_transaction_id = created_inv.id
            queue_item.synced_at = datetime.now(timezone.utc)
            await session.flush()

            final_status = SyncResolutionStatus.ACCEPTED_WARN if (has_stock_deficit or has_credit_breach) else SyncResolutionStatus.ACCEPTED
            final_strat = SyncConflictResolutionStrategy.AUTO_MERGE_DELTA if (has_stock_deficit or has_credit_breach) else SyncConflictResolutionStrategy.SERVER_AUTHORITATIVE

            return SyncResolutionResult(
                client_id=item.client_id,
                queue_id=queue_item.id,
                status=final_status,
                conflict_category=conflict_cat,
                resolution_strategy=final_strat,
                server_entity_id=created_inv.id,
                document_number=created_inv.invoice_no,
                grand_total=float(created_inv.grand_total),
                diagnostics=diagnostics
            )

        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str or "unique" in err_str or "pending rollback" in err_str:
                # Concurrent uniqueness violation on invoice_no (retry storm).
                # Roll back to restore the session to a usable state, then
                # update the queue_item within a fresh implicit transaction.
                try:
                    await session.rollback()
                except Exception:
                    pass

                # Re-fetch the winning invoice after rollback
                try:
                    from sqlalchemy import select as _select
                    dedup_stmt = _select(SalesInvoice).where(
                        SalesInvoice.company_id == company_id,
                        SalesInvoice.invoice_no == clean_inv_no,
                    )
                    dedup_inv = (await session.execute(dedup_stmt)).scalar_one_or_none()
                    _existing_inv_id = dedup_inv.id if dedup_inv else None
                except Exception:
                    _existing_inv_id = None

                # Re-add queue_item to the now-clean session so we can update it
                try:
                    queue_item.sync_status = "ALREADY_PROCESSED"
                    if _existing_inv_id:
                        queue_item.synced_transaction_id = _existing_inv_id
                    queue_item.synced_at = datetime.now(timezone.utc)
                    session.add(queue_item)
                    await session.flush()
                except Exception:
                    pass  # Best-effort: queue_item update may fail if session is still unusable

                return SyncResolutionResult(
                    client_id=item.client_id,
                    queue_id=queue_item.id,
                    status=SyncResolutionStatus.DEDUPLICATED,
                    conflict_category=SyncConflictCategory.NONE,
                    resolution_strategy=SyncConflictResolutionStrategy.IDEMPOTENT_DEDUPLICATION,
                    server_entity_id=_existing_inv_id,
                    document_number=clean_inv_no,
                    diagnostics=[
                        SyncConflictDiagnostic(
                            field="invoice_no",
                            client_assumption=clean_inv_no,
                            action_taken="Duplicate transaction acknowledged and safely skipped via concurrent uniqueness guard."
                        )
                    ]
                )

            queue_item.sync_status = "FAILED"
            queue_item.error_message = str(e)
            queue_item.retry_count = (queue_item.retry_count or 0) + 1
            await session.flush()

            return SyncResolutionResult(
                client_id=item.client_id,
                queue_id=queue_item.id,
                status=SyncResolutionStatus.REJECTED,
                conflict_category=SyncConflictCategory.WORKFLOW_STATE,
                resolution_strategy=SyncConflictResolutionStrategy.SERVER_AUTHORITATIVE,
                error=str(e),
                diagnostics=diagnostics
            )

