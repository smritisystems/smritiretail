"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.17.1 (Phase 1 — POS Checkout)
* Created    : 2026-07-11
* Modified   : 2026-07-15 (Phase 1 — POS Checkout migration)
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.pos import CashRegister, Shift
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product, StockMovement
from ..api.deps import TenantContext
from ..schemas.pos import (
    CashRegisterCreate, ShiftOpen, ShiftClose,
    POSCheckoutRequest,
)


class POSService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    # ──────────────────────────────────────────────────────────────
    # Cash Register
    # ──────────────────────────────────────────────────────────────

    async def create_register(self, req: CashRegisterCreate) -> CashRegister:
        reg = CashRegister(
            id=req.id, name=req.name, code=req.code, notes=req.notes,
            is_active=True, is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A cash register with this ID or code already exists. "
                       "Please use a different register code.",
            )
        await self.db.refresh(reg)
        return reg

    async def list_registers(self) -> list[CashRegister]:
        res = await self.db.execute(
            select(CashRegister).where(
                CashRegister.company_id == self.tenant.company_id,
                CashRegister.branch_id  == self.tenant.branch_id,
                CashRegister.is_deleted == False,
            )
        )
        return res.scalars().all()

    async def get_register(self, register_id: str) -> CashRegister:
        res = await self.db.execute(
            select(CashRegister).where(
                CashRegister.id == register_id,
                CashRegister.company_id == self.tenant.company_id,
                CashRegister.branch_id  == self.tenant.branch_id,
                CashRegister.is_deleted == False,
            )
        )
        reg = res.scalars().first()
        if not reg:
            raise HTTPException(status_code=404, detail="Cash register not found.")
        return reg

    # ──────────────────────────────────────────────────────────────
    # POS Profile CRUD  (frontend POSProfile ↔ CashRegister)
    # ──────────────────────────────────────────────────────────────

    async def create_profile(self, req: "POSProfileCreate") -> CashRegister:  # type: ignore[name-defined]
        """Create a CashRegister from the frontend POS profile form."""
        import uuid as _uuid
        # Auto-derive a short code from the name if not provided
        code = f"REG-{_uuid.uuid4().hex[:6].upper()}"
        reg = CashRegister(
            id=f"PROF-{_uuid.uuid4().hex[:8].upper()}",
            name=req.name,
            code=code,
            notes=req.notes,
            cashier=req.cashier,
            warehouse=req.warehouse,
            is_locked=False,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A profile with this name already exists. Please use a different name.",
            )
        await self.db.refresh(reg)
        return reg

    async def clone_register(self, register_id: str) -> CashRegister:
        """Clone a CashRegister — copies all fields with a new ID and code."""
        import uuid as _uuid
        src = await self.get_register(register_id)
        clone = CashRegister(
            id=f"PROF-{_uuid.uuid4().hex[:8].upper()}",
            name=f"{src.name} (Copy)",
            code=f"REG-{_uuid.uuid4().hex[:6].upper()}",
            notes=src.notes,
            cashier=src.cashier,
            warehouse=src.warehouse,
            is_locked=False,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(clone)
        await self.db.commit()
        await self.db.refresh(clone)
        return clone

    async def archive_register(self, register_id: str) -> CashRegister:
        """Soft-delete a CashRegister (archive). Sets is_deleted=True, is_active=False."""
        from datetime import datetime, timezone
        reg = await self.get_register(register_id)
        reg.is_deleted = True
        reg.is_active = False
        reg.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(reg)
        return reg

    async def toggle_lock_register(self, register_id: str) -> CashRegister:
        """Flip the is_locked state of a CashRegister."""
        reg = await self.get_register(register_id)
        reg.is_locked = not reg.is_locked
        await self.db.commit()
        await self.db.refresh(reg)
        return reg

    async def list_shifts(self) -> list:
        """List all shifts for this tenant (supports App.tsx shifts state)."""
        res = await self.db.execute(
            select(Shift).where(
                Shift.company_id == self.tenant.company_id,
                Shift.is_deleted == False,
            ).order_by(Shift.opened_at.desc()).limit(100)
        )
        return res.scalars().all()

    # ──────────────────────────────────────────────────────────────
    # Shift — open
    # ──────────────────────────────────────────────────────────────

    async def open_shift(self, req: ShiftOpen, cashier_id: str) -> Shift:
        """
        Open a new shift on a register.

        Rules:
        1. Register must belong to this tenant.
        2. Only one shift may be OPEN on a register at a time.
        3. opening_balance >= 0.
        """
        await self.get_register(req.register_id)

        # Check no existing OPEN shift on this register
        existing = await self.db.execute(
            select(Shift).where(
                Shift.register_id == req.register_id,
                Shift.status      == "OPEN",
                Shift.is_deleted  == False,
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="This register already has an open shift. "
                       "Please close the current shift before opening a new one.",
            )

        if req.opening_balance < 0:
            raise HTTPException(
                status_code=400,
                detail="Opening balance cannot be negative.",
            )

        shift = Shift(
            id=req.id,
            register_id=req.register_id,
            cashier_id=cashier_id,
            status="OPEN",
            opened_at=datetime.now(timezone.utc),
            opening_balance=req.opening_balance,
            cash_sales_total=Decimal("0.00"),
            card_sales_total=Decimal("0.00"),
            upi_sales_total=Decimal("0.00"),
            total_sales=Decimal("0.00"),
            total_invoices="0",
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(shift)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A shift with this ID already exists.",
            )
        await self.db.refresh(shift)
        return shift

    # ──────────────────────────────────────────────────────────────
    # Shift — close
    # ──────────────────────────────────────────────────────────────

    async def close_shift(self, shift_id: str, req: ShiftClose, requesting_user_id: str) -> Shift:
        """
        Close a shift:
        1. Aggregate sales totals from linked SalesInvoices.
        2. Compute expected_cash = opening_balance + cash_sales_total.
        3. Compute variance = closing_balance − expected_cash.
        4. Set status = CLOSED, closed_at = now.
        """
        res = await self.db.execute(
            select(Shift).where(
                Shift.id == shift_id,
                Shift.company_id == self.tenant.company_id,
                Shift.branch_id  == self.tenant.branch_id,
                Shift.is_deleted == False,
            )
        )
        shift = res.scalars().first()
        if not shift:
            raise HTTPException(status_code=404, detail="Shift not found.")
        if shift.status == "CLOSED":
            raise HTTPException(
                status_code=400,
                detail="This shift has already been closed.",
            )

        # Aggregate invoices linked to this shift
        invoices_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.shift_id   == shift_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoices = invoices_res.scalars().all()

        cash_total = Decimal("0.00")
        card_total = Decimal("0.00")
        upi_total  = Decimal("0.00")
        total      = Decimal("0.00")

        for inv in invoices:
            gt = Decimal(str(inv.grand_total)) if inv.grand_total else Decimal("0.00")
            mode = (inv.payment_mode or "CASH").upper()
            if mode == "CASH":
                cash_total += gt
            elif mode == "CARD":
                card_total += gt
            elif mode == "UPI":
                upi_total += gt
            total += gt

        expected = (shift.opening_balance + cash_total).quantize(Decimal("0.01"))
        variance = (req.closing_balance - expected).quantize(Decimal("0.01"))

        shift.status           = "CLOSED"
        shift.closed_at        = datetime.now(timezone.utc)
        shift.cash_sales_total = cash_total.quantize(Decimal("0.01"))
        shift.card_sales_total = card_total.quantize(Decimal("0.01"))
        shift.upi_sales_total  = upi_total.quantize(Decimal("0.01"))
        shift.total_sales      = total.quantize(Decimal("0.01"))
        shift.total_invoices   = str(len(invoices))
        shift.closing_balance  = req.closing_balance.quantize(Decimal("0.01"))
        shift.expected_cash    = expected
        shift.variance         = variance
        shift.closing_notes    = req.closing_notes
        shift.modified_at      = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(shift)
        return shift

    # ──────────────────────────────────────────────────────────────
    # Shift — queries
    # ──────────────────────────────────────────────────────────────

    async def list_shifts(self, register_id: str | None = None) -> list[Shift]:
        q = select(Shift).where(
            Shift.company_id == self.tenant.company_id,
            Shift.branch_id  == self.tenant.branch_id,
            Shift.is_deleted == False,
        )
        if register_id:
            q = q.where(Shift.register_id == register_id)
        res = await self.db.execute(q)
        return res.scalars().all()

    async def get_shift(self, shift_id: str) -> Shift:
        res = await self.db.execute(
            select(Shift).where(
                Shift.id == shift_id,
                Shift.company_id == self.tenant.company_id,
                Shift.branch_id  == self.tenant.branch_id,
                Shift.is_deleted == False,
            )
        )
        shift = res.scalars().first()
        if not shift:
            raise HTTPException(status_code=404, detail="Shift not found.")
        return shift

    async def get_active_shift(self, register_id: str) -> Shift:
        """Get the currently open shift for a register."""
        res = await self.db.execute(
            select(Shift).where(
                Shift.register_id == register_id,
                Shift.status      == "OPEN",
                Shift.company_id  == self.tenant.company_id,
                Shift.branch_id   == self.tenant.branch_id,
                Shift.is_deleted  == False,
            )
        )
        shift = res.scalars().first()
        if not shift:
            raise HTTPException(
                status_code=404,
                detail="No open shift found for this register. "
                       "Please open a shift before processing sales.",
            )
        return shift

    # ───────────────────────────────────────────────────────────────
    # POS Checkout  (Phase 1 — replaces Express in-memory bills[])
    # ───────────────────────────────────────────────────────────────

    async def pos_checkout(self, req: POSCheckoutRequest) -> dict:
        """
        Process a POS sale:
        1. Validate shift is OPEN and belongs to this tenant.
        2. Idempotency: if invoice_no already exists, return it (cached=True).
        3. Deduct stock and record StockMovement for each tracked product.
        4. Persist SalesInvoice with shift_id set.
        5. Handle race-condition duplicate via IntegrityError catch.

        Returns {"invoice": SalesInvoice, "shift": Shift, "cached": bool}
        """
        # 1. Validate shift
        shift = await self.get_shift(req.shift_id)
        if shift.status != "OPEN":
            raise HTTPException(
                status_code=400,
                detail="The shift is not open. Please open a shift before processing sales.",
            )

        # 2. Idempotency check (pre-insert)
        existing_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.invoice_no == req.invoice_no,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.is_deleted == False,
            )
        )
        if (existing_inv := existing_res.scalars().first()):
            return {"invoice": existing_inv, "shift": shift, "cached": True}

        # 3. Compute totals and build item records
        tax_total   = Decimal("0.00")
        grand_total = Decimal("0.00")
        invoice_id  = uuid.uuid4().hex[:8]
        db_items:   list[SalesInvoiceItem] = []
        movements:  list[StockMovement]    = []

        for item in req.items:
            qty   = item.quantity
            price = item.price
            gst   = item.gst_rate

            item_tax   = (qty * price * gst / Decimal("100.00")).quantize(Decimal("0.0001"))
            item_total = (qty * price + item_tax).quantize(Decimal("0.01"))
            tax_total   += item_tax
            grand_total += item_total

            db_items.append(SalesInvoiceItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                price=price,
                hsn_code=item.hsn_code,
                gst_rate=gst,
                tax_amount=item_tax,
                total_amount=item_total,
            ))

            # Stock deduction
            prod_res = await self.db.execute(
                select(Product).where(
                    Product.id         == item.product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id  == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = prod_res.scalars().first()
            if product and product.tracking_mode != "No-stock":
                if product.stock < int(qty):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for '{item.name}'. "
                               f"Available: {product.stock}, requested: {int(qty)}.",
                    )
                product.stock -= int(qty)
                self.db.add(product)
                movement_id = (
                    f"SM-{int(datetime.now(timezone.utc).timestamp())}-"
                    f"{uuid.uuid4().hex[:6]}"
                )
                movements.append(StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="OUT",
                    reference_doc_type="POS Invoice",
                    reference_doc_id=invoice_id,
                    warehouse="Default Warehouse",
                    unit_cost=product.cost_price or product.price,
                    remarks=f"POS sale: {req.invoice_no}",
                    source_module="POS",
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                ))

        # 4. Apply bill-level discount
        if req.bill_discount_val and req.bill_discount_val > 0:
            if req.bill_discount_type == "percent":
                discount = (
                    grand_total * req.bill_discount_val / Decimal("100")
                ).quantize(Decimal("0.01"))
            else:
                discount = req.bill_discount_val
            grand_total = max(Decimal("0.00"), grand_total - discount)

        # 5. Persist invoice
        from datetime import date as _date
        invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=req.invoice_no,
            date=_date.today(),
            customer_id=req.customer_id,
            shift_id=req.shift_id,
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=grand_total.quantize(Decimal("0.01")),
            payment_mode=req.payment_mode.upper(),
            status="Submitted",
            items=db_items,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(invoice)
        for m in movements:
            self.db.add(m)

        try:
            await self.db.commit()
        except IntegrityError:
            # Race condition: concurrent request with same invoice_no committed first
            await self.db.rollback()
            race_res = await self.db.execute(
                select(SalesInvoice).where(
                    SalesInvoice.invoice_no == req.invoice_no,
                    SalesInvoice.company_id == self.tenant.company_id,
                    SalesInvoice.is_deleted == False,
                )
            )
            race_inv = race_res.scalars().first()
            if race_inv:
                return {"invoice": race_inv, "shift": shift, "cached": True}
            raise HTTPException(
                status_code=400,
                detail="A billing conflict occurred. Please try again.",
            )

        await self.db.refresh(invoice)
        await self.db.refresh(shift)
        return {"invoice": invoice, "shift": shift, "cached": False}
