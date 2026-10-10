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
Classification: Internal — DataBridge Sales Return / Credit Note Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_SALES_RETURN_ADAPTER", role="CANONICAL")

import uuid as uuid_pkg
from datetime import datetime, date as date_type, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple, Set
from fastapi import HTTPException
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
from app.models.sales import SalesReturn, SalesReturnItem, SalesInvoice
from app.models.crm import Customer
from app.models.inventory import Product
from app.services.identity.engine import IdentityEngine


class DataBridgeSalesReturnAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Sales Returns / Customer Credit Notes.
    Supports multi-row line grouping by return_no, invoice resolution/stubbing for FK satisfaction,
    product auto-provisioning, line tax & grand total calculations, idempotent replay,
    and atomic multi-tenant transaction commit.
    """

    RETURN_HEADER_MAP: Dict[str, List[str]] = {
        "return_no": [
            "return_no", "return no", "sr_no", "sr no", "return_number", "return number",
            "credit_note_no", "credit note no", "credit_note_number", "cn_no", "cn no",
        ],
        "original_invoice_no": [
            "original_invoice_no", "invoice_no", "invoice no", "orig_invoice_no",
            "invoice_number", "original_invoice_number", "inv_no", "bill_no", "bill no",
        ],
        "original_invoice_id": [
            "original_invoice_id", "invoice_id", "inv_id",
        ],
        "credit_note_number": [
            "credit_note_number", "credit_note_no", "cn_number",
        ],
        "date": [
            "date", "return_date", "sr_date", "doc_date", "document_date",
        ],
        "customer_id": [
            "customer_id", "customer id", "cust_id", "party_id",
        ],
        "customer_name": [
            "customer_name", "customer name", "customer", "client", "client_name", "party_name",
        ],
        "reason": [
            "reason", "remarks", "notes", "narration", "comment", "description",
        ],
        "item_code": [
            "item_code", "item code", "product_code", "product code", "sku", "sku_code",
            "barcode", "code", "article_code", "item_no",
        ],
        "item_name": [
            "item_name", "item name", "product_name", "product name", "item", "product",
            "item_description", "description",
        ],
        "quantity": [
            "quantity", "qty", "returned_qty", "units", "count",
        ],
        "price": [
            "price", "rate", "unit_price", "selling_price", "return_rate",
        ],
        "gst_rate": [
            "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax", "gst_percent",
        ],
        "tax_amount": [
            "tax_amount", "tax", "gst_amount", "total_tax",
        ],
        "total_amount": [
            "total_amount", "net_amount", "total", "return_amount",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Maps raw row headers and cleans standard Sales Return fields."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.RETURN_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for field in [
            "return_no", "original_invoice_no", "original_invoice_id", "credit_note_number",
            "customer_id", "customer_name", "reason", "item_code", "item_name"
        ]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        if norm.get("return_no"):
            norm["return_no"] = str(norm["return_no"]).strip().upper()

        if norm.get("original_invoice_no"):
            norm["original_invoice_no"] = str(norm["original_invoice_no"]).strip().upper()

        for num_field in ["quantity", "price", "gst_rate", "tax_amount", "total_amount"]:
            if num_field in norm and norm[num_field] is not None:
                try:
                    norm[num_field] = Decimal(str(norm[num_field]).strip())
                except (InvalidOperation, TypeError, ValueError):
                    pass

        return norm

    def group_rows(self, raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Groups multi-row tabular input by document identifier return_no."""
        grouped_docs: Dict[str, Dict[str, Any]] = {}
        order_sequence: List[str] = []

        for idx, row in enumerate(raw_rows):
            normalized = self.normalize(row, idx)
            ret_no = normalized.get("return_no")
            group_key = ret_no if ret_no else f"__UNNAMED_RET_{idx}__"

            if group_key not in grouped_docs:
                order_sequence.append(group_key)
                grouped_docs[group_key] = {
                    "return_no": ret_no,
                    "original_invoice_no": normalized.get("original_invoice_no"),
                    "original_invoice_id": normalized.get("original_invoice_id"),
                    "credit_note_number": normalized.get("credit_note_number"),
                    "date": normalized.get("date"),
                    "customer_id": normalized.get("customer_id"),
                    "customer_name": normalized.get("customer_name"),
                    "reason": normalized.get("reason"),
                    "_row_index": idx,
                    "items": [],
                }

            doc = grouped_docs[group_key]
            for hf in [
                "original_invoice_no", "original_invoice_id", "credit_note_number",
                "customer_id", "customer_name", "reason", "date"
            ]:
                if not doc.get(hf) and normalized.get(hf):
                    doc[hf] = normalized[hf]

            if isinstance(row.get("items"), list) and len(row["items"]) > 0:
                for item_raw in row["items"]:
                    item_norm = self.normalize(item_raw, idx)
                    doc["items"].append(self._build_item_dict(item_norm, idx))
            elif normalized.get("item_code") or normalized.get("item_name") or normalized.get("quantity") is not None:
                doc["items"].append(self._build_item_dict(normalized, idx))

        return [grouped_docs[k] for k in order_sequence]

    def _build_item_dict(self, norm: Dict[str, Any], row_idx: int) -> Dict[str, Any]:
        qty = norm.get("quantity")
        if not isinstance(qty, Decimal):
            try:
                qty = Decimal(str(qty)) if qty is not None else Decimal("1")
            except (InvalidOperation, TypeError, ValueError):
                qty = Decimal("1")

        price = norm.get("price")
        if not isinstance(price, Decimal):
            try:
                price = Decimal(str(price)) if price is not None else Decimal("0.00")
            except (InvalidOperation, TypeError, ValueError):
                price = Decimal("0.00")

        gst = norm.get("gst_rate")
        if not isinstance(gst, Decimal):
            try:
                gst = Decimal(str(gst)) if gst is not None else Decimal("18.00")
            except (InvalidOperation, TypeError, ValueError):
                gst = Decimal("18.00")

        code = norm.get("item_code") or norm.get("code") or "SKU-RET-GEN"
        name = norm.get("item_name") or norm.get("name") or code

        taxable = (qty * price).quantize(Decimal("0.01"))
        tax_amt = (taxable * (gst / Decimal("100"))).quantize(Decimal("0.01"))
        tot_amt = (taxable + tax_amt).quantize(Decimal("0.01"))

        return {
            "code": code,
            "name": name,
            "quantity": qty,
            "price": price,
            "gst_rate": gst,
            "taxable_value": taxable,
            "tax_amount": tax_amt,
            "total_amount": tot_amt,
            "_row_index": row_idx,
        }

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates document numbers and line items."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        ret_no = norm.get("return_no")
        if not ret_no or not str(ret_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SR-NO-REQ",
                    message="Sales return number (return_no) is mandatory.",
                    severity="BLOCK",
                )
            )

        items = norm.get("items", [])
        if not items:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SR-NO-ITEMS",
                    message="Sales return must contain at least one line item.",
                    severity="BLOCK",
                )
            )
        else:
            for i, it in enumerate(items):
                it_qty = it.get("quantity", Decimal("0"))
                if it_qty <= Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-SR-LINE-QTY",
                            message=f"Line {i+1} return quantity must be greater than zero.",
                            severity="BLOCK",
                        )
                    )
                it_price = it.get("price", Decimal("0"))
                if it_price < Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-SR-LINE-PRICE",
                            message=f"Line {i+1} return price cannot be negative.",
                            severity="BLOCK",
                        )
                    )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[SalesReturn]:
        """Matches existing SalesReturn in the database by return_no within company."""
        ret_no = norm.get("return_no")
        if not ret_no:
            return None

        stmt = (
            select(SalesReturn)
            .where(
                SalesReturn.company_id == company_id,
                SalesReturn.return_no == ret_no,
                SalesReturn.is_deleted == False,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[SalesReturn]
    ) -> DataBridgeDiff:
        """Calculates difference between existing database record and ingress document."""
        if not existing:
            return DataBridgeDiff(fields={})

        diff = DataBridgeDiff(fields={})
        if norm.get("reason") and str(existing.reason or "").strip() != str(norm["reason"]).strip():
            diff.fields["reason"] = DataBridgeDiffField(
                old_value=existing.reason,
                new_value=norm["reason"],
                is_different=True,
            )

        return diff

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[SalesReturn],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies sales return row."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any("ALREADY_EXISTS" in c.conflict_code or "DUP" in c.conflict_code for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        return DataBridgeClassification.NO_CHANGE

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes read-only preview and conflict validation for Sales Returns."""
        grouped_docs = self.group_rows(rows)
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_returns: Set[str] = set()

        for idx, doc in enumerate(grouped_docs, start=1):
            target_id = doc.get("return_no") or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            ret_no = doc.get("return_no")
            if ret_no:
                if ret_no in seen_returns:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-SR-DUP-FILE",
                            message=f"Duplicate return number '{ret_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_returns.add(ret_no)

            existing = await self.match(doc, session, company_id)
            if existing:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SALES_RETURN_ALREADY_EXISTS",
                        message=f"Sales Return '{ret_no}' already exists under this company.",
                        severity="BLOCK",
                    )
                )

            d = self.diff(doc, existing)
            classification = self.classify(doc, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Document [{target_id}]: {c.message}")

            tot_tax = sum((it["tax_amount"] for it in doc.get("items", [])), Decimal("0.00"))
            tot_amt = sum((it["total_amount"] for it in doc.get("items", [])), Decimal("0.00"))

            preview_data = {
                "return_no": ret_no,
                "original_invoice_no": doc.get("original_invoice_no") or "N/A",
                "customer_name": doc.get("customer_name") or "Standard Customer",
                "date": str(doc.get("date") or datetime.now(timezone.utc).date()),
                "items_count": len(doc.get("items", [])),
                "tax_total": str(tot_tax),
                "grand_total": str(tot_amt),
                "reason": doc.get("reason"),
            }

            result_items.append(
                DataBridgeResultItem(
                    row_index=doc.get("_row_index", idx),
                    record_id=existing.id if existing else None,
                    entity_type="SALES_RETURN",
                    classification=classification,
                    target_identifier=str(target_id),
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                    normalized_data=preview_data,
                )
            )

        return result_items, blocking_reasons

    async def _resolve_or_create_original_invoice(
        self, session: AsyncSession, doc: Dict[str, Any], company_id: str, branch_id: Optional[str]
    ) -> str:
        """Resolves existing SalesInvoice by ID or invoice_no, or creates historical stub to satisfy FK."""
        orig_id = doc.get("original_invoice_id")
        orig_no = doc.get("original_invoice_no")

        if orig_id:
            stmt = select(SalesInvoice.id).where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.id == orig_id,
                SalesInvoice.is_deleted == False,
            )
            i_res = (await session.execute(stmt)).scalars().first()
            if i_res:
                return i_res

        if orig_no:
            stmt = select(SalesInvoice.id).where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.invoice_no == orig_no,
                SalesInvoice.is_deleted == False,
            )
            i_res = (await session.execute(stmt)).scalars().first()
            if i_res:
                return i_res

        # If not found or not provided, create a historical reference invoice stub to satisfy RESTRICT FK
        inv_tech_id, inv_id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="SALES_INVOICE",
            group_code="INV",
            company_id=company_id,
            branch_id=branch_id,
            purpose="DATABRIDGE_HISTORICAL_STUB",
        )
        stub_inv_no = orig_no or f"INV-HIST-{doc.get('return_no', inv_id_code)}"
        stub_inv = SalesInvoice(
            id=inv_tech_id,
            identity_code=inv_id_code,
            company_id=company_id,
            branch_id=branch_id,
            invoice_no=stub_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_name=doc.get("customer_name") or "Historical Customer",
            status="Draft",
            source_type="DATABRIDGE_HISTORICAL_STUB",
        )
        session.add(stub_inv)
        await session.flush()
        return stub_inv.id

    async def _resolve_or_create_product(
        self, session: AsyncSession, it: Dict[str, Any], company_id: str, branch_id: Optional[str]
    ) -> Tuple[str, str, str, Optional[str], Optional[str]]:
        """Resolves existing Product by code/barcode/id with canonical identity, or provisions a shadow bridge."""
        raw_code = str(it.get("code") or "").strip()
        name = str(it.get("name") or raw_code).strip()
        price = it.get("price") or Decimal("0.00")

        stmt = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted == False,
            or_(
                Product.id == raw_code,
                Product.code == raw_code,
                Product.barcode == raw_code,
                Product.sku == raw_code,
            ),
        )
        p = (await session.execute(stmt)).scalars().first()
        from app.services.product_resolution_service import ProductResolutionService
        if p:
            if not p.item_id:
                res = await ProductResolutionService.resolve_by_product_id(
                    session=session,
                    company_id=company_id,
                    product_id=p.id,
                )
                if not res or not res.item_id:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "UNLINKED_PRODUCT_NOT_ALLOWED",
                            "message": f"Product '{p.code}' is not linked to canonical Item Master. Sales returns are prohibited.",
                        },
                    )
                return p.id, p.code, p.name, res.item_id, res.variant_id
            return p.id, p.code, p.name, p.item_id, getattr(p, "item_variant_id", None)

        # Attempt canonical resolution
        canon_res = await ProductResolutionService.resolve(
            session=session,
            company_id=company_id,
            identifier=raw_code,
        )
        if not canon_res or not canon_res.success or not canon_res.item_id:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ITEM_NOT_FOUND",
                    "message": f"Item/SKU/Barcode '{raw_code}' not found in Item Master. Sales returns for unknown items are prohibited.",
                },
            )

        if canon_res.product_id:
            cp = await session.get(Product, canon_res.product_id)
            if cp:
                return cp.id, cp.code, cp.name, canon_res.item_id, canon_res.variant_id

        # Auto-provision transitional shadow Product bridge
        p_tech_id, p_id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="PRODUCT",
            group_code="PRD",
            company_id=company_id,
            branch_id=branch_id,
            purpose="DATABRIDGE_CANONICAL_BRIDGE",
        )
        code_to_use = raw_code or p_id_code
        new_p = Product(
            id=p_tech_id,
            code=code_to_use,
            sku=canon_res.sku or code_to_use,
            barcode=canon_res.barcode or code_to_use,
            name=canon_res.name or name or code_to_use,
            category="General",
            price=price,
            cost_price=price,
            gst_percentage=it.get("gst_rate") or Decimal("18.00"),
            item_id=canon_res.item_id,
            item_variant_id=canon_res.variant_id,
            company_id=company_id,
            branch_id=branch_id,
            is_active=True,
        )
        session.add(new_p)
        await session.flush()
        return new_p.id, new_p.code, new_p.name, canon_res.item_id, canon_res.variant_id

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Atomically commits Sales Returns and line items to PostgreSQL."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Sales Returns: {'; '.join(blocking)}")

        grouped_docs = self.group_rows(rows)
        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, doc in zip(preview_items, grouped_docs):
            if item_res.classification != DataBridgeClassification.CREATE:
                final_items.append(item_res)
                continue

            ret_no = doc["return_no"]
            orig_inv_id = await self._resolve_or_create_original_invoice(session, doc, company_id, branch_id)

            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")

            return_items: List[SalesReturnItem] = []
            for it in doc.get("items", []):
                p_id, p_code, p_name, item_id, variant_id = await self._resolve_or_create_product(session, it, company_id, branch_id)
                tax_total += it["tax_amount"]
                grand_total += it["total_amount"]

                sr_item = SalesReturnItem(
                    company_id=company_id,
                    branch_id=branch_id,
                    product_id=p_id,
                    item_id=item_id,
                    variant_id=variant_id,
                    code=p_code,
                    name=p_name,
                    quantity=it["quantity"],
                    price=it["price"],
                    gst_rate=it.get("gst_rate", Decimal("18.00")),
                    tax_amount=it["tax_amount"],
                    total_amount=it["total_amount"],
                )
                return_items.append(sr_item)

            sr_tech_id, _sr_id_code = await IdentityEngine.allocate_internal(
                session=session,
                entity_type="SALES_RETURN",
                group_code="SR",
                company_id=company_id,
                branch_id=branch_id,
                purpose="DATABRIDGE_COMMIT",
            )

            sr_date = doc.get("date")
            if isinstance(sr_date, str):
                try:
                    sr_date = datetime.strptime(sr_date[:10], "%Y-%m-%d").date()
                except Exception:
                    sr_date = datetime.now(timezone.utc).date()
            elif isinstance(sr_date, datetime):
                sr_date = sr_date.date()
            elif not isinstance(sr_date, date_type):
                sr_date = datetime.now(timezone.utc).date()

            sales_return = SalesReturn(
                id=sr_tech_id,
                company_id=company_id,
                branch_id=branch_id,
                return_no=ret_no,
                original_invoice_id=orig_inv_id,
                credit_note_number=doc.get("credit_note_number"),
                date=sr_date,
                customer_id=doc.get("customer_id"),
                reason=doc.get("reason"),
                tax_total=tax_total,
                grand_total=grand_total,
                status="Draft",
                items=return_items,
            )
            session.add(sales_return)
            await session.flush()

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=sales_return.id,
                    entity_type="SALES_RETURN",
                    classification=item_res.classification,
                    target_identifier=str(ret_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "return_id": sales_return.id,
                        "return_no": ret_no,
                        "original_invoice_id": orig_inv_id,
                        "grand_total": str(grand_total),
                        "items_count": len(return_items),
                    },
                )
            )

        return final_items, committed_count
