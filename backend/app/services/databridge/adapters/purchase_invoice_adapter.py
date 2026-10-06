"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — DataBridge Purchase Invoice / Bill Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_PURCHASE_INVOICE_ADAPTER", role="CANONICAL")

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from .base_adapter import BaseDataBridgeAdapter
from ..models import (
    DataBridgeClassification,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeResultItem,
)
from ..exceptions import DataBridgeValidationError
from app.models.purchase import PurchaseBill, PurchaseReceipt, PurchaseOrder, Supplier
from app.schemas.purchase import PurchaseBillCreate
from app.services.purchase import PurchaseService
from app.services.identity.engine import IdentityEngine
from app.api.deps import TenantContext


class DataBridgePurchaseInvoiceAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Purchase Invoice / Supplier Commercial Bills.
    Validates taxable amount, tax amount, total amount math, resolves supplier and
    originating PO/GRN references, prevents duplicates, and commits via PurchaseService.
    """

    BILL_HEADER_MAP: Dict[str, List[str]] = {
        "bill_no": [
            "bill_no", "bill no", "invoice_no", "invoice no", "bill_number", "bill number",
            "invoice_number", "invoice number", "purchase_invoice_no", "vendor_invoice_no",
            "bill_num", "inv_no",
        ],
        "supplier_id": [
            "supplier_id", "supplier id", "vendor_id", "vendor id",
        ],
        "supplier_code": [
            "supplier_code", "supplier code", "vendor_code", "vendor code", "supp_code",
        ],
        "supplier_name": [
            "supplier_name", "supplier name", "supplier", "vendor", "vendor_name",
            "party_name", "supp_name",
        ],
        "supplier_gstin": [
            "supplier_gstin", "vendor_gstin", "gstin", "gst_number", "gst_no",
        ],
        "receipt_no": [
            "receipt_no", "grn_no", "grn_number", "receipt_number", "grn",
        ],
        "order_no": [
            "order_no", "po_no", "po_number", "order_number", "purchase_order_no",
        ],
        "bill_date": [
            "bill_date", "invoice_date", "date", "bill date", "invoice date",
        ],
        "due_date": [
            "due_date", "payment_due_date", "due date",
        ],
        "taxable_amount": [
            "taxable_amount", "taxable_value", "taxable amount", "subtotal", "sub_total",
        ],
        "tax_amount": [
            "tax_amount", "tax", "gst_amount", "tax amount", "total_tax",
        ],
        "total_amount": [
            "total_amount", "grand_total", "total", "net_amount", "bill_amount",
            "invoice_amount", "total amount",
        ],
        "notes": [
            "notes", "remarks", "narration", "comment",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes raw input row headers and numerical values."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.BILL_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for s_f in ["bill_no", "supplier_id", "supplier_code", "supplier_name", "receipt_no", "order_no", "notes"]:
            if s_f in norm and norm[s_f] is not None:
                norm[s_f] = str(norm[s_f]).strip()

        if norm.get("bill_no"):
            norm["bill_no"] = str(norm["bill_no"]).strip().upper()

        for num_f in ["taxable_amount", "tax_amount", "total_amount"]:
            if num_f in norm and norm[num_f] is not None:
                try:
                    norm[num_f] = Decimal(str(norm[num_f]).strip())
                except (InvalidOperation, TypeError, ValueError):
                    pass

        if isinstance(norm.get("taxable_amount"), Decimal) and isinstance(norm.get("tax_amount"), Decimal) and norm.get("total_amount") is None:
            norm["total_amount"] = norm["taxable_amount"] + norm["tax_amount"]
        elif isinstance(norm.get("total_amount"), Decimal) and norm.get("taxable_amount") is None:
            norm["taxable_amount"] = norm["total_amount"]
            norm["tax_amount"] = Decimal("0.00")

        return norm

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates invoice number, supplier reference, and amount totals."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        bill_no = norm.get("bill_no")
        if not bill_no or not str(bill_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-BILL-NO-REQ",
                    message="Purchase bill / invoice number (bill_no) is mandatory.",
                    severity="BLOCK",
                )
            )

        has_supplier = bool(
            norm.get("supplier_id")
            or norm.get("supplier_code")
            or norm.get("supplier_name")
        )
        if not has_supplier:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-BILL-SUPPLIER-REQ",
                    message="Supplier reference is required for purchase invoice.",
                    severity="BLOCK",
                )
            )

        tot = norm.get("total_amount")
        if tot is None or not isinstance(tot, Decimal) or tot <= Decimal("0"):
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-BILL-TOTAL-REQ",
                    message="Purchase bill total amount must be a positive decimal value.",
                    severity="BLOCK",
                )
            )

        taxable = norm.get("taxable_amount")
        tax = norm.get("tax_amount")
        if isinstance(taxable, Decimal) and isinstance(tax, Decimal) and isinstance(tot, Decimal):
            if abs((taxable + tax) - tot) > Decimal("0.05"):
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-BILL-MATH-INVARIANT",
                        message=f"Bill total ({tot}) does not equal taxable ({taxable}) + tax ({tax}).",
                        severity="BLOCK",
                    )
                )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[PurchaseBill]:
        """Matches existing PurchaseBill by bill_no + company_id."""
        bill_no = norm.get("bill_no")
        if not bill_no:
            return None

        stmt = (
            select(PurchaseBill)
            .where(
                PurchaseBill.company_id == company_id,
                PurchaseBill.bill_no == bill_no,
                PurchaseBill.is_deleted == False,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[PurchaseBill]
    ) -> DataBridgeDiff:
        """Diffs existing purchase bill against ingress document."""
        if not existing:
            return DataBridgeDiff(fields={})

        diff_fields: Dict[str, DataBridgeDiffField] = {}
        if norm.get("total_amount") and norm["total_amount"] != existing.total_amount:
            diff_fields["total_amount"] = DataBridgeDiffField(
                old_value=str(existing.total_amount),
                new_value=str(norm["total_amount"]),
                is_different=True,
            )
        return DataBridgeDiff(fields=diff_fields)

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[PurchaseBill],
        diff_res: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies purchase bill action."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any("EXIST" in c.conflict_code or "ALREADY" in c.conflict_code for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        return DataBridgeClassification.EXISTING_CONFLICT

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes preview pipeline for purchase invoices."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_bills: Set[str] = set()

        for idx, row in enumerate(rows, start=1):
            doc = self.normalize(row, idx)
            bill_no = doc.get("bill_no")
            target_id = bill_no or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            if bill_no:
                if bill_no in seen_bills:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-BILL-DUP-FILE",
                            message=f"Duplicate invoice number '{bill_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_bills.add(bill_no)

            existing = await self.match(doc, session, company_id)
            if existing:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="BILL_ALREADY_EXISTS",
                        message=f"Purchase bill '{existing.bill_no}' already exists in system with status '{existing.status}'.",
                        severity="BLOCK",
                    )
                )

            d = self.diff(doc, existing)
            classification = self.classify(doc, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            preview_data = {
                "bill_no": bill_no,
                "supplier_name": doc.get("supplier_name") or doc.get("supplier_code") or doc.get("supplier_id"),
                "taxable_amount": str(doc.get("taxable_amount", Decimal("0.00"))),
                "tax_amount": str(doc.get("tax_amount", Decimal("0.00"))),
                "total_amount": str(doc.get("total_amount", Decimal("0.00"))),
                "receipt_no": doc.get("receipt_no"),
                "order_no": doc.get("order_no"),
            }

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="PURCHASE_INVOICE",
                    classification=classification,
                    target_identifier=str(target_id),
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                    normalized_data=preview_data,
                )
            )

        return result_items, blocking_reasons

    async def _resolve_or_create_supplier(
        self, session: AsyncSession, doc: Dict[str, Any], company_id: str, branch_id: Optional[str]
    ) -> str:
        sid = doc.get("supplier_id")
        scode = doc.get("supplier_code")
        sname = doc.get("supplier_name")

        if sid:
            stmt = select(Supplier.id).where(
                Supplier.company_id == company_id,
                Supplier.id == sid,
                Supplier.is_deleted == False,
            )
            s_res = (await session.execute(stmt)).scalars().first()
            if s_res:
                return s_res

        clauses = []
        if scode:
            clauses.append(Supplier.code == scode)
        if sname:
            clauses.append(Supplier.name == sname)
        if clauses:
            stmt = select(Supplier.id).where(
                Supplier.company_id == company_id,
                Supplier.is_deleted == False,
                or_(*clauses),
            )
            s_res = (await session.execute(stmt)).scalars().first()
            if s_res:
                return s_res

        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="SUPPLIER",
            group_code="SUP",
            company_id=company_id,
            branch_id=eff_branch,
            purpose="DATABRIDGE_AUTO_PROVISION",
        )
        new_supp = Supplier(
            id=tech_id,
            identity_code=id_code,
            code=scode or id_code,
            name=sname or scode or f"Supplier-{doc.get('bill_no')}",
            gst_number=doc.get("supplier_gstin"),
            company_id=company_id,
            branch_id=eff_branch,
            outstanding=Decimal("0.00"),
        )
        session.add(new_supp)
        await session.flush()
        return new_supp.id

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Commits purchase invoices via PurchaseService."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Purchase Invoice batch: {'; '.join(blocking)}")

        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tenant_ctx = TenantContext(company_id=company_id, branch_id=eff_branch)
        purchase_service = PurchaseService(session, tenant_ctx)

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            doc = self.normalize(raw_row, item_res.row_index)
            bill_no = doc.get("bill_no")
            supplier_id = await self._resolve_or_create_supplier(session, doc, company_id, branch_id)

            receipt_id = None
            if doc.get("receipt_no"):
                r_stmt = select(PurchaseReceipt.id).where(
                    PurchaseReceipt.company_id == company_id,
                    PurchaseReceipt.receipt_no == doc["receipt_no"],
                    PurchaseReceipt.is_deleted == False,
                )
                receipt_id = (await session.execute(r_stmt)).scalars().first()

            order_id = None
            if doc.get("order_no"):
                o_stmt = select(PurchaseOrder.id).where(
                    PurchaseOrder.company_id == company_id,
                    PurchaseOrder.order_no == doc["order_no"],
                    PurchaseOrder.is_deleted == False,
                )
                order_id = (await session.execute(o_stmt)).scalars().first()

            bill_create_schema = PurchaseBillCreate(
                bill_no=bill_no,
                supplier_id=supplier_id,
                receipt_id=receipt_id,
                order_id=order_id,
                taxable_amount=doc.get("taxable_amount", Decimal("0.00")),
                tax_amount=doc.get("tax_amount", Decimal("0.00")),
                total_amount=doc.get("total_amount", Decimal("0.00")),
                notes=doc.get("notes"),
            )

            created_bill = await purchase_service.create_purchase_bill(bill_create_schema)
            created_id = getattr(created_bill, "id", None) or (created_bill.get("id") if isinstance(created_bill, dict) else None)
            total_amt_str = str(getattr(created_bill, "total_amount", None) or (created_bill.get("total_amount") if isinstance(created_bill, dict) else ""))

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=created_id,
                    entity_type="PURCHASE_INVOICE",
                    classification=item_res.classification,
                    target_identifier=str(bill_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "bill_id": created_id,
                        "bill_no": bill_no,
                        "supplier_id": supplier_id,
                        "total_amount": total_amt_str,
                    },
                )
            )

        return final_items, committed_count
