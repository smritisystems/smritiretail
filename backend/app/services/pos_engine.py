"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

pos_engine.py — Domain service for POS Cash Drawer Sessions, High-Speed Counter Checkout,
Cash Reconciliation, and Offline Sync Processing.
"""

import uuid
import json
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import Product
from app.models.pos import PosSession, PosTransaction, PosTransactionItem, PosOfflineSyncQueue


class PosEngine:
    """
    PosEngine — Domain engine managing cashier drawer sessions, counter sales checkout,
    cash variance reconciliation, and offline store transaction sync.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def open_session(
        self,
        cashier_id: str,
        terminal_id: str,
        opening_balance: Decimal = Decimal("0.00")
    ) -> PosSession:
        """
        Opens a new cash drawer session for a cashier and terminal.
        """
        # Check if active session already open for this terminal
        stmt = select(PosSession).where(
            PosSession.terminal_id == terminal_id,
            PosSession.status == "OPEN",
            PosSession.company_id == self.tenant.company_id,
            PosSession.is_deleted == False
        )
        existing = (await self.db.execute(stmt)).scalars().first()
        if existing:
            return existing

        session_id = f"pos-sess-{uuid.uuid4().hex[:12]}"
        session_no = f"SESS-{uuid.uuid4().hex[:8].upper()}"

        session = PosSession(
            id=session_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            session_no=session_no,
            cashier_id=cashier_id,
            terminal_id=terminal_id,
            opened_at=datetime.now(timezone.utc),
            opening_balance=opening_balance,
            expected_cash=opening_balance,
            status="OPEN"
        )
        self.db.add(session)
        await self.db.commit()
        return session

    async def process_checkout(
        self,
        session_id: str,
        items: List[Dict[str, Any]],
        payment_method: str = "CASH",
        tendered_amount: Decimal = Decimal("0.00"),
        customer_id: Optional[str] = None,
        client_tx_uuid: Optional[str] = None,
        discount_amount: Decimal = Decimal("0.00")
    ) -> PosTransaction:
        """
        Processes a high-speed counter sale checkout transaction.
        """
        stmt = select(PosSession).where(
            PosSession.id == session_id,
            PosSession.company_id == self.tenant.company_id,
            PosSession.is_deleted == False
        )
        session = (await self.db.execute(stmt)).scalars().first()

        if not session:
            raise HTTPException(status_code=404, detail=f"POS Session '{session_id}' not found.")

        if session.status != "OPEN":
            raise HTTPException(status_code=400, detail=f"Cannot process checkout on closed POS Session '{session_id}'.")

        if not items:
            raise HTTPException(status_code=400, detail="Checkout payload must contain at least one product item.")

        # Check client_tx_uuid deduplication
        if client_tx_uuid:
            dup_stmt = select(PosTransaction).where(PosTransaction.client_tx_uuid == client_tx_uuid)
            dup_tx = (await self.db.execute(dup_stmt)).scalars().first()
            if dup_tx:
                return dup_tx

        tx_id = f"pos-tx-{uuid.uuid4().hex[:12]}"
        receipt_no = f"RCPT-{uuid.uuid4().hex[:8].upper()}"

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        tx_items = []

        for line in items:
            p_id = line["product_id"]
            qty = Decimal(str(line["quantity"]))

            # Fetch product & verify stock
            p_stmt = select(Product).where(Product.id == p_id)
            prod = (await self.db.execute(p_stmt)).scalars().first()

            if not prod:
                raise HTTPException(status_code=404, detail=f"Product '{p_id}' not found.")

            if prod.stock < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{prod.name}' (Requested: {qty}, Available: {prod.stock})."
                )

            unit_price = Decimal(str(line.get("unit_price", prod.price)))
            line_tot = (qty * unit_price).quantize(Decimal("0.01"))
            subtotal += line_tot

            # Deduct stock directly
            prod.stock -= qty
            self.db.add(prod)

            tx_item = PosTransactionItem(
                id=f"pos-item-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                transaction_id=tx_id,
                product_id=p_id,
                product_code=prod.code,
                product_name=prod.name,
                quantity=qty,
                unit_price=unit_price,
                line_total=line_tot
            )
            tx_items.append(tx_item)

        grand_total = max(Decimal("0.00"), subtotal - discount_amount).quantize(Decimal("0.01"))

        if tendered_amount < grand_total and payment_method == "CASH":
            tendered_amount = grand_total

        change_due = max(Decimal("0.00"), tendered_amount - grand_total).quantize(Decimal("0.01"))

        tx = PosTransaction(
            id=tx_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            session_id=session_id,
            receipt_no=receipt_no,
            client_tx_uuid=client_tx_uuid,
            customer_id=customer_id,
            subtotal=subtotal,
            tax_total=tax_total,
            discount_amount=discount_amount,
            grand_total=grand_total,
            payment_method=payment_method.upper(),
            tendered_amount=tendered_amount,
            change_due=change_due,
            status="COMPLETED",
            transaction_time=datetime.now(timezone.utc)
        )
        tx.items = tx_items

        # Accumulate POS session totals
        session.total_sales += grand_total
        pm = payment_method.upper()
        if pm == "CASH":
            session.total_cash_sales += grand_total
            session.expected_cash += grand_total
        elif pm == "CARD":
            session.total_card_sales += grand_total
        elif pm in ("UPI", "QR"):
            session.total_upi_sales += grand_total

        self.db.add(tx)
        self.db.add_all(tx_items)
        self.db.add(session)
        await self.db.commit()
        return tx

    async def close_session(
        self,
        session_id: str,
        actual_cash_count: Decimal,
        notes: Optional[str] = None
    ) -> PosSession:
        """
        Reconciles cash count and closes a POS drawer session.
        """
        stmt = select(PosSession).where(
            PosSession.id == session_id,
            PosSession.company_id == self.tenant.company_id,
            PosSession.is_deleted == False
        )
        session = (await self.db.execute(stmt)).scalars().first()

        if not session:
            raise HTTPException(status_code=404, detail=f"POS Session '{session_id}' not found.")

        if session.status == "CLOSED":
            return session

        variance = (actual_cash_count - session.expected_cash).quantize(Decimal("0.01"))

        session.actual_cash_count = actual_cash_count
        session.cash_variance = variance
        session.closed_at = datetime.now(timezone.utc)
        session.status = "CLOSED"
        if notes:
            session.notes = notes

        self.db.add(session)
        await self.db.commit()
        return session

    async def process_offline_sync_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ingests a batch of offline POS transactions with client_tx_uuid deduplication.
        """
        results = []
        for line in items:
            tx_uuid = line.get("client_tx_uuid")
            terminal_id = line.get("terminal_id", "DEFAULT-TERM")
            session_id = line.get("session_id")

            # Check if queue entry exists
            q_stmt = select(PosOfflineSyncQueue).where(PosOfflineSyncQueue.client_tx_uuid == tx_uuid)
            q_entry = (await self.db.execute(q_stmt)).scalars().first()

            if q_entry and q_entry.sync_status == "SYNCED":
                results.append({
                    "client_tx_uuid": tx_uuid,
                    "status": "DUPLICATE",
                    "transaction_id": q_entry.synced_transaction_id
                })
                continue

            if not q_entry:
                q_entry = PosOfflineSyncQueue(
                    id=f"sync-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    client_tx_uuid=tx_uuid,
                    terminal_id=terminal_id,
                    payload_json=json.dumps(line),
                    sync_status="PENDING"
                )
                self.db.add(q_entry)
                await self.db.flush()

            try:
                # Get or create open session for offline sync
                sess_stmt = select(PosSession).where(
                    PosSession.terminal_id == terminal_id,
                    PosSession.status == "OPEN",
                    PosSession.company_id == self.tenant.company_id
                )
                active_sess = (await self.db.execute(sess_stmt)).scalars().first()
                if not active_sess:
                    active_sess = await self.open_session(
                        cashier_id=line.get("cashier_id", "OFFLINE_CASHIER"),
                        terminal_id=terminal_id,
                        opening_balance=Decimal("0.00")
                    )

                tx = await self.process_checkout(
                    session_id=active_sess.id,
                    items=line.get("items", []),
                    payment_method=line.get("payment_method", "CASH"),
                    tendered_amount=Decimal(str(line.get("tendered_amount", 0))),
                    customer_id=line.get("customer_id"),
                    client_tx_uuid=tx_uuid
                )

                q_entry.sync_status = "SYNCED"
                q_entry.synced_transaction_id = tx.id
                q_entry.synced_at = datetime.now(timezone.utc)
                self.db.add(q_entry)
                await self.db.commit()

                results.append({
                    "client_tx_uuid": tx_uuid,
                    "status": "SYNCED",
                    "transaction_id": tx.id
                })

            except Exception as ex:
                await self.db.rollback()
                q_entry.sync_status = "FAILED"
                q_entry.error_message = str(ex)
                self.db.add(q_entry)
                await self.db.commit()

                results.append({
                    "client_tx_uuid": tx_uuid,
                    "status": "FAILED",
                    "error": str(ex)
                })

        return results
