"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.9.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    ProcurementRFQ, VendorQuotation, VendorQuotationItem,
    QuotationEvaluation, PurchaseOrder, PurchaseOrderItem,
    VendorContract, VendorContractTier
)
from app.models.inventory import Product
from app.api.deps import TenantContext
from app.procurement.engine.matrix_builder import MatrixBuilder


class ConversionStrategy:
    async def convert(self, db: AsyncSession, tenant: TenantContext, quotation: VendorQuotation, items: list) -> str:
        raise NotImplementedError


class POConversionStrategy(ConversionStrategy):
    async def convert(self, db: AsyncSession, tenant: TenantContext, quotation: VendorQuotation, items: list) -> str:
        # Generate PO
        po_id = f"po-{uuid.uuid4().hex[:8]}"
        order_no = f"PO-AWARD-{uuid.uuid4().hex[:4].upper()}"

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        item_rows = []

        for item in items:
            p_stmt = select(Product).where(
                Product.id == item.product_id,
                Product.is_deleted == False
            )
            product = (await db.execute(p_stmt)).scalars().first()
            gst_rate = Decimal("18.00")
            if product and product.gst_percentage is not None:
                gst_rate = Decimal(str(product.gst_percentage))

            qty = Decimal(str(item.offered_quantity))
            price = Decimal(str(item.net_unit_price))

            tax_amt = (price * qty * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
            line_tot = (price * qty + tax_amt).quantize(Decimal("0.01"))
            subtotal += price * qty
            tax_total += tax_amt

            poi = PurchaseOrderItem(
                id=f"poi-{uuid.uuid4().hex[:8]}",
                order_id=po_id,
                product_id=item.product_id,
                code=product.code if product else "UNKNOWN",
                name=product.name if product else "UNKNOWN",
                quantity=qty,
                cost_price=price,
                gst_rate=gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=tenant.company_id,
                branch_id=tenant.branch_id
            )
            item_rows.append(poi)

        po = PurchaseOrder(
            id=po_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            order_no=order_no,
            supplier_id=quotation.supplier_id,
            status="CONFIRMED",
            notes=f"Generated from RFQ Award Quotation {quotation.quotation_code}",
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01"))
        )
        db.add(po)
        db.add_all(item_rows)
        return po_id


class VendorContractConversionStrategy(ConversionStrategy):
    async def convert(self, db: AsyncSession, tenant: TenantContext, quotation: VendorQuotation, items: list) -> str:
        # Generate Contract
        contract_id = f"vc-{uuid.uuid4().hex[:12]}"
        contract_code = f"VC-AWARD-{uuid.uuid4().hex[:4].upper()}"
        now = datetime.now(timezone.utc)

        contract = VendorContract(
            id=contract_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            supplier_id=quotation.supplier_id,
            contract_code=contract_code,
            contract_title=f"Contract for quote {quotation.quotation_code}",
            version_number=1,
            valid_from=now,
            valid_to=now + timedelta(days=365),
            currency_id=quotation.currency_id,
            payment_terms_id=quotation.payment_terms,
            approval_status="Approved",
            lifecycle_stage="Active",
            workflow_status="Approved"
        )
        db.add(contract)

        for item in items:
            p_stmt = select(Product).where(
                Product.id == item.product_id,
                Product.is_deleted == False
            )
            product = (await db.execute(p_stmt)).scalars().first()

            tier = VendorContractTier(
                id=f"vct-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
                company_id=tenant.company_id,
                branch_id=tenant.branch_id,
                contract_id=contract_id,
                product_id=item.product_id,
                currency_id=quotation.currency_id,
                min_quantity=Decimal("1.00"),
                max_quantity=None,
                contract_unit_price=Decimal(str(item.offered_unit_price)),
                discount_percentage=Decimal(str(item.discount_percentage)),
                effective_from=now,
                effective_to=now + timedelta(days=365),
                workflow_status="Approved"
            )
            db.add(tier)

        return contract_id


class AwardEngine:
    """
    Handles RFQ awarding process.
    Saves immutable audit trail and executes conversion strategies.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant
        self.matrix_builder = MatrixBuilder(db, tenant)

    async def award_rfq(
        self,
        rfq_id: str,
        quotation_id: str,
        awarded_by: str,
        award_notes: str,
        convert_to: str  # PURCHASE_ORDER or VENDOR_CONTRACT
    ) -> QuotationEvaluation:

        # 1. Fetch and Validate RFQ
        rfq_stmt = select(ProcurementRFQ).where(
            ProcurementRFQ.id == rfq_id,
            ProcurementRFQ.company_id == self.tenant.company_id,
            ProcurementRFQ.is_deleted == False
        )
        rfq = (await self.db.execute(rfq_stmt)).scalars().first()
        if not rfq:
            raise HTTPException(status_code=404, detail=f"RFQ '{rfq_id}' not found")
        
        if rfq.status in ["Awarded", "Closed", "Cancelled"]:
            raise HTTPException(status_code=400, detail=f"RFQ cannot be awarded in status '{rfq.status}'")

        # 2. Fetch and Validate Winning Quotation
        q_stmt = select(VendorQuotation).where(
            VendorQuotation.id == quotation_id,
            VendorQuotation.rfq_id == rfq_id,
            VendorQuotation.is_deleted == False
        )
        quotation = (await self.db.execute(q_stmt)).scalars().first()
        if not quotation:
            raise HTTPException(status_code=404, detail=f"Quotation '{quotation_id}' not found for RFQ '{rfq_id}'")

        # Fetch quotation items
        qi_stmt = select(VendorQuotationItem).where(
            VendorQuotationItem.quotation_id == quotation_id
        )
        q_items = list((await self.db.execute(qi_stmt)).scalars().all())

        # 3. Snapshot Comparison Matrix
        matrix_snapshot = await self.matrix_builder.build_matrix(rfq_id)

        # 4. Execute Conversion Strategy
        converted_doc_id = None
        if convert_to == "PURCHASE_ORDER":
            strategy = POConversionStrategy()
            converted_doc_id = await strategy.convert(self.db, self.tenant, quotation, q_items)
        elif convert_to == "VENDOR_CONTRACT":
            strategy = VendorContractConversionStrategy()
            converted_doc_id = await strategy.convert(self.db, self.tenant, quotation, q_items)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid conversion target '{convert_to}'")

        # 5. Create QuotationEvaluation Record
        evaluation_id = f"qev-{uuid.uuid4().hex[:12]}"
        evaluation = QuotationEvaluation(
            id=evaluation_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            rfq_id=rfq_id,
            winning_quotation_id=quotation_id,
            winning_supplier_id=quotation.supplier_id,
            evaluation_profile=rfq.evaluation_profile,
            winning_score=quotation.score or Decimal("0.00"),
            comparison_matrix_snapshot=matrix_snapshot,
            awarded_by=awarded_by,
            awarded_at=datetime.now(timezone.utc),
            award_notes=award_notes,
            converted_doc_type=convert_to,
            converted_doc_id=converted_doc_id
        )
        self.db.add(evaluation)

        # 6. Update RFQ and Quotations status
        rfq.status = "Awarded"
        self.db.add(rfq)

        quotation.status = "Awarded"
        self.db.add(quotation)

        # Mark other quotations as Rejected
        other_quotes_stmt = select(VendorQuotation).where(
            VendorQuotation.rfq_id == rfq_id,
            VendorQuotation.id != quotation_id,
            VendorQuotation.is_deleted == False
        )
        other_quotes = (await self.db.execute(other_quotes_stmt)).scalars().all()
        for oq in other_quotes:
            oq.status = "Rejected"
            self.db.add(oq)

        await self.db.commit()
        await self.db.refresh(evaluation)
        return evaluation
