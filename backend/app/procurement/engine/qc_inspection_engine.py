"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    QualityInspection, QualityInspectionItem, SupplierDebitNote,
    PurchaseReceipt, PurchaseReceiptItem, PurchaseOrderItem
)
from app.models.inventory import Product
from app.api.deps import TenantContext


class QCInspectionEngine:
    """
    QCInspectionEngine — Domain service for Warehouse Goods Receipt (GRN) Quality Control.
    Enforces quality inspection gates, computes line-item disposition, routes stock,
    generates automated Supplier Debit Notes for rejected goods, and guards 3-Way Matching.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def create_inspection_from_receipt(
        self,
        receipt_id: str,
        inspector_id: Optional[str] = None
    ) -> QualityInspection:
        # 1. Fetch & Validate PurchaseReceipt
        r_stmt = select(PurchaseReceipt).where(
            PurchaseReceipt.id == receipt_id,
            PurchaseReceipt.company_id == self.tenant.company_id,
            PurchaseReceipt.is_deleted == False
        )
        receipt = (await self.db.execute(r_stmt)).scalars().first()
        if not receipt:
            raise HTTPException(status_code=404, detail=f"Purchase Receipt (GRN) '{receipt_id}' not found")

        # Fetch receipt items
        ri_stmt = select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == receipt_id,
            PurchaseReceiptItem.is_deleted == False
        )
        receipt_items = list((await self.db.execute(ri_stmt)).scalars().all())
        if not receipt_items:
            raise HTTPException(status_code=400, detail="Purchase Receipt has no line items for inspection")

        inspection_id = f"qci-{uuid.uuid4().hex[:12]}"
        inspection_no = f"QC-{receipt.receipt_no}-{uuid.uuid4().hex[:4].upper()}"

        tot_received = Decimal("0.00")
        item_objs = []

        for r_item in receipt_items:
            qty_rec = Decimal(str(r_item.quantity_received))
            tot_received += qty_rec

            qc_item = QualityInspectionItem(
                id=f"qcii-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                inspection_id=inspection_id,
                product_id=r_item.product_id,
                received_quantity=qty_rec,
                inspected_quantity=qty_rec,
                accepted_quantity=qty_rec,  # Default all accepted until evaluation
                rejected_quantity=Decimal("0.00"),
                quarantine_quantity=Decimal("0.00"),
                defect_category="NONE"
            )
            item_objs.append(qc_item)

        inspection = QualityInspection(
            id=inspection_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            inspection_no=inspection_no,
            receipt_id=receipt.id,
            supplier_id=receipt.supplier_id,
            inspector_id=inspector_id,
            inspected_at=datetime.now(timezone.utc),
            overall_status="UnderInspection",
            total_received_qty=tot_received,
            total_accepted_qty=tot_received,
            total_rejected_qty=Decimal("0.00"),
            total_quarantine_qty=Decimal("0.00")
        )

        receipt.qc_status = "UnderInspection"
        self.db.add(receipt)
        self.db.add(inspection)
        self.db.add_all(item_objs)

        await self.db.commit()
        await self.db.refresh(inspection)
        inspection.items = item_objs
        return inspection

    async def evaluate_inspection(
        self,
        inspection_id: str,
        line_evaluations: List[Dict[str, Any]],
        remarks: Optional[str] = None
    ) -> QualityInspection:
        # 1. Fetch Inspection & Items
        stmt = select(QualityInspection).where(
            QualityInspection.id == inspection_id,
            QualityInspection.company_id == self.tenant.company_id,
            QualityInspection.is_deleted == False
        )
        inspection = (await self.db.execute(stmt)).scalars().first()
        if not inspection:
            raise HTTPException(status_code=404, detail=f"Quality Inspection '{inspection_id}' not found")

        l_stmt = select(QualityInspectionItem).where(
            QualityInspectionItem.inspection_id == inspection.id,
            QualityInspectionItem.is_deleted == False
        )
        items = {item.product_id: item for item in (await self.db.execute(l_stmt)).scalars().all()}

        tot_accepted = Decimal("0.00")
        tot_rejected = Decimal("0.00")
        tot_quarantine = Decimal("0.00")
        total_claim_amount = Decimal("0.00")

        # 2. Process line evaluations
        for line_eval in line_evaluations:
            prod_id = line_eval["product_id"]
            if prod_id not in items:
                raise HTTPException(status_code=400, detail=f"Product '{prod_id}' is not part of this inspection")

            item = items[prod_id]
            acc_qty = Decimal(str(line_eval.get("accepted_quantity", 0)))
            rej_qty = Decimal(str(line_eval.get("rejected_quantity", 0)))
            qua_qty = Decimal(str(line_eval.get("quarantine_quantity", 0)))

            if (acc_qty + rej_qty + qua_qty) > item.received_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sum of accepted ({acc_qty}), rejected ({rej_qty}), and quarantine ({qua_qty}) exceeds received quantity ({item.received_quantity}) for product '{prod_id}'"
                )

            item.accepted_quantity = acc_qty
            item.rejected_quantity = rej_qty
            item.quarantine_quantity = qua_qty
            item.inspected_quantity = acc_qty + rej_qty + qua_qty
            item.defect_category = line_eval.get("defect_category", "NONE")
            item.defect_reason = line_eval.get("defect_reason")
            self.db.add(item)

            tot_accepted += acc_qty
            tot_rejected += rej_qty
            tot_quarantine += qua_qty

            if rej_qty > Decimal("0.00"):
                # Fetch product cost price for debit note claim calculation
                p_stmt = select(Product).where(Product.id == prod_id)
                product = (await self.db.execute(p_stmt)).scalars().first()
                cost_price = product.cost_price if product and product.cost_price else Decimal("100.00")
                total_claim_amount += (rej_qty * cost_price).quantize(Decimal("0.01"))

        inspection.total_accepted_qty = tot_accepted
        inspection.total_rejected_qty = tot_rejected
        inspection.total_quarantine_qty = tot_quarantine
        inspection.remarks = remarks
        inspection.inspected_at = datetime.now(timezone.utc)

        # 3. Compute Overall Outcome FSM
        if tot_rejected == Decimal("0.00") and tot_quarantine == Decimal("0.00"):
            inspection.overall_status = "Passed"
            qc_status = "Passed"
        elif tot_accepted > Decimal("0.00"):
            inspection.overall_status = "PassedWithExceptions"
            qc_status = "Passed"
        else:
            inspection.overall_status = "Failed"
            qc_status = "Failed"

        # Update GRN qc_status
        r_stmt = select(PurchaseReceipt).where(PurchaseReceipt.id == inspection.receipt_id)
        receipt = (await self.db.execute(r_stmt)).scalars().first()
        if receipt:
            receipt.qc_status = qc_status
            self.db.add(receipt)

        # 4. Generate Automated Supplier Debit Note Draft for Rejected Items
        if tot_rejected > Decimal("0.00"):
            gst_tax = (total_claim_amount * Decimal("18.00") / Decimal("100.00")).quantize(Decimal("0.01"))
            total_debit = (total_claim_amount + gst_tax).quantize(Decimal("0.01"))

            dn_id = f"sdn-{uuid.uuid4().hex[:10]}"
            debit_note_no = f"DN-QC-{inspection.inspection_no}-{uuid.uuid4().hex[:4].upper()}"

            debit_note = SupplierDebitNote(
                id=dn_id,
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                debit_note_no=debit_note_no,
                supplier_id=inspection.supplier_id,
                receipt_id=inspection.receipt_id,
                inspection_id=inspection.id,
                claim_amount=total_claim_amount,
                tax_amount=gst_tax,
                total_debit_amount=total_debit,
                status="DRAFT",
                reason=f"Automated debit claim for {tot_rejected} rejected units under QC Inspection {inspection.inspection_no}"
            )
            self.db.add(debit_note)
            inspection.debit_note_id = dn_id

        self.db.add(inspection)
        await self.db.commit()
        await self.db.refresh(inspection)
        inspection.items = list(items.values())
        return inspection

    async def validate_matching_qc_gate(self, receipt_id: str) -> bool:
        """
        Validates that a Goods Receipt Note (GRN) has passed Quality Control before 3-Way Matching execution.
        """
        r_stmt = select(PurchaseReceipt).where(
            PurchaseReceipt.id == receipt_id,
            PurchaseReceipt.company_id == self.tenant.company_id
        )
        receipt = (await self.db.execute(r_stmt)).scalars().first()
        if not receipt:
            raise HTTPException(status_code=404, detail=f"Purchase Receipt '{receipt_id}' not found")

        if receipt.qc_status in ("PendingInspection", "UnderInspection", "Failed"):
            raise HTTPException(
                status_code=400,
                detail=f"3-Way Matching blocked: Purchase Receipt (GRN) '{receipt.receipt_no}' has not passed Quality Control inspection (current QC status: '{receipt.qc_status}')"
            )
        return True
