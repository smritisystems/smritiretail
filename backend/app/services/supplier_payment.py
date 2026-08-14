"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.13.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.supplier_payment import SupplierPayment
from ..models.purchase import Supplier
from ..api.deps import TenantContext
from ..schemas.supplier_payment import SupplierPaymentCreate


class SupplierPaymentService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def _get_supplier(self, supplier_id: str) -> Supplier:
        res = await self.db.execute(
            select(Supplier).where(
                Supplier.id         == supplier_id,
                Supplier.company_id == self.tenant.company_id,
                Supplier.branch_id  == self.tenant.branch_id,
                Supplier.is_deleted == False,
            )
        )
        s = res.scalars().first()
        if not s:
            raise HTTPException(status_code=404, detail="Supplier not found.")
        return s

    async def record_payment(self, req: SupplierPaymentCreate) -> SupplierPayment:
        """
        Record a payment to a supplier and decrement supplier.outstanding atomically.

        Rules:
        1. Supplier must exist in this tenant.
        2. amount > 0 (enforced by schema validator).
        3. amount must not exceed supplier.outstanding (overpayment guard).
        4. supplier.outstanding is decremented within the same transaction.
        """
        supplier = await self._get_supplier(req.supplier_id)

        outstanding = Decimal(str(supplier.outstanding or "0.00"))
        if req.amount > outstanding:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Payment amount ₹{req.amount:,.2f} exceeds supplier outstanding "
                    f"balance of ₹{outstanding:,.2f}. "
                    "Please enter an amount equal to or less than the outstanding balance."
                ),
            )

        payment = SupplierPayment(
            id=req.id,
            supplier_id=req.supplier_id,
            amount=req.amount,
            payment_mode=req.payment_mode,
            payment_date=req.payment_date,
            reference_no=req.reference_no,
            notes=req.notes,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
        )
        self.db.add(payment)

        # Atomically decrement outstanding
        supplier.outstanding = (outstanding - req.amount).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A payment with this ID already exists.",
            )
        await self.db.refresh(payment)
        return payment

    async def list_payments(self, supplier_id: str | None = None) -> list[SupplierPayment]:
        q = select(SupplierPayment).where(
            SupplierPayment.company_id == self.tenant.company_id,
            SupplierPayment.branch_id  == self.tenant.branch_id,
            SupplierPayment.is_deleted == False,
        ).order_by(SupplierPayment.created_at.desc())
        if supplier_id:
            q = q.where(SupplierPayment.supplier_id == supplier_id)
        res = await self.db.execute(q)
        return res.scalars().all()

    async def get_payment(self, payment_id: str) -> SupplierPayment:
        res = await self.db.execute(
            select(SupplierPayment).where(
                SupplierPayment.id         == payment_id,
                SupplierPayment.company_id == self.tenant.company_id,
                SupplierPayment.branch_id  == self.tenant.branch_id,
                SupplierPayment.is_deleted == False,
            )
        )
        p = res.scalars().first()
        if not p:
            raise HTTPException(status_code=404, detail="Payment record not found.")
        return p
