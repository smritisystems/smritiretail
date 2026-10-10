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
Classification: Internal — DataBridge Goods Receipt Note (GRN) Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_GRN_ADAPTER", role="CANONICAL")

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
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier, PurchaseOrder
from app.models.inventory import Product
from app.models.item_master import Item
from app.schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from app.services.purchase import PurchaseService
from app.services.identity.engine import IdentityEngine
from app.api.deps import TenantContext


class DataBridgeGrnAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Goods Receipt Note (GRN) / Inward Receipts.
    Supports multi-line grouping, batch number extraction, PO linking,
    supplier auto-provisioning, and atomic posting through PurchaseService.
    """

    GRN_HEADER_MAP: Dict[str, List[str]] = {
        "receipt_no": [
            "receipt_no", "receipt no", "grn_no", "grn no", "grn_number", "grn number",
            "receipt_number", "receipt id", "grn", "challan_no", "challan no",
            "delivery_challan", "inward_no", "inward_number",
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
        "order_no": [
            "order_no", "po_no", "po_number", "order_number", "purchase_order_no", "order_id",
        ],
        "warehouse_id": [
            "warehouse_id", "warehouse", "godown_id", "godown", "location_id", "store_id",
        ],
        "notes": [
            "notes", "remarks", "narration", "comment", "note",
        ],
        "item_code": [
            "item_code", "item code", "product_code", "product code", "sku",
            "sku_code", "article_code", "barcode", "code",
        ],
        "item_name": [
            "item_name", "item name", "product_name", "product name", "item", "product", "name",
        ],
        "batch_no": [
            "batch_no", "batch no", "batch", "lot_no", "lot", "batch_number",
        ],
        "quantity_received": [
            "quantity_received", "received_qty", "qty_received", "quantity", "qty",
            "accepted_qty", "inward_qty",
        ],
        "cost_price": [
            "cost_price", "cost price", "rate", "cost", "unit_cost", "purchase_rate", "unit_price",
        ],
        "gst_rate": [
            "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax",
        ],
        "mrp": [
            "mrp", "max_retail_price", "retail_price",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes raw input row headers and line attributes."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.GRN_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for field in ["receipt_no", "supplier_id", "supplier_code", "supplier_name", "order_no", "warehouse_id", "notes", "item_code", "item_name", "batch_no"]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        if norm.get("receipt_no"):
            norm["receipt_no"] = str(norm["receipt_no"]).strip().upper()

        for num_f in ["quantity_received", "cost_price", "gst_rate", "mrp"]:
            if num_f in norm and norm[num_f] is not None:
                try:
                    norm[num_f] = Decimal(str(norm[num_f]).strip())
                except (InvalidOperation, TypeError, ValueError):
                    pass

        return norm

    def group_rows(self, raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Groups multi-row tabular input by receipt_no."""
        grouped: Dict[str, Dict[str, Any]] = {}
        seq: List[str] = []

        for idx, row in enumerate(raw_rows):
            normalized = self.normalize(row, idx)
            receipt_no = normalized.get("receipt_no")
            group_key = receipt_no if receipt_no else f"__UNNAMED_GRN_{idx}__"

            if group_key not in grouped:
                seq.append(group_key)
                grouped[group_key] = {
                    "receipt_no": receipt_no,
                    "supplier_id": normalized.get("supplier_id"),
                    "supplier_code": normalized.get("supplier_code"),
                    "supplier_name": normalized.get("supplier_name"),
                    "supplier_gstin": normalized.get("supplier_gstin"),
                    "order_no": normalized.get("order_no"),
                    "warehouse_id": normalized.get("warehouse_id"),
                    "notes": normalized.get("notes"),
                    "_row_index": idx,
                    "items": [],
                }

            doc = grouped[group_key]
            for hf in ["supplier_id", "supplier_code", "supplier_name", "supplier_gstin", "order_no", "warehouse_id", "notes"]:
                if not doc.get(hf) and normalized.get(hf):
                    doc[hf] = normalized[hf]

            if isinstance(row.get("items"), list) and len(row["items"]) > 0:
                for it_raw in row["items"]:
                    it_norm = self.normalize(it_raw, idx)
                    doc["items"].append(self._build_grn_item(it_norm, idx))
            elif normalized.get("item_code") or normalized.get("item_name") or normalized.get("quantity_received") is not None:
                doc["items"].append(self._build_grn_item(normalized, idx))

        return [grouped[k] for k in seq]

    def _build_grn_item(self, norm: Dict[str, Any], row_idx: int) -> Dict[str, Any]:
        qty = norm.get("quantity_received")
        if not isinstance(qty, Decimal):
            try:
                qty = Decimal(str(qty)) if qty is not None else Decimal("1")
            except (InvalidOperation, TypeError, ValueError):
                qty = Decimal("1")

        cost = norm.get("cost_price")
        if not isinstance(cost, Decimal):
            try:
                cost = Decimal(str(cost)) if cost is not None else Decimal("0.00")
            except (InvalidOperation, TypeError, ValueError):
                cost = Decimal("0.00")

        gst = norm.get("gst_rate")
        if not isinstance(gst, Decimal):
            try:
                gst = Decimal(str(gst)) if gst is not None else Decimal("18.00")
            except (InvalidOperation, TypeError, ValueError):
                gst = Decimal("18.00")

        code = norm.get("item_code") or norm.get("code") or "SKU-GENERIC"
        name = norm.get("item_name") or norm.get("name") or code

        line_tax = (qty * cost * (gst / Decimal("100"))).quantize(Decimal("0.01"))
        line_total = (qty * cost + line_tax).quantize(Decimal("0.01"))

        return {
            "code": code,
            "name": name,
            "batch_no": norm.get("batch_no"),
            "mrp": norm.get("mrp"),
            "quantity_received": qty,
            "cost_price": cost,
            "gst_rate": gst,
            "tax_amount": line_tax,
            "line_total": line_total,
            "_row_index": row_idx,
        }

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates GRN receipt fields and items."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        receipt_no = norm.get("receipt_no")
        if not receipt_no or not str(receipt_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-GRN-NO-REQ",
                    message="Goods Receipt Note number (receipt_no) is mandatory.",
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
                    conflict_code="SMRITI-VAL-GRN-SUPPLIER-REQ",
                    message="Supplier reference is required for GRN inwarding.",
                    severity="BLOCK",
                )
            )

        items = norm.get("items", [])
        if not items:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-GRN-NO-ITEMS",
                    message="GRN must contain at least one received item.",
                    severity="BLOCK",
                )
            )
        else:
            for i, it in enumerate(items):
                if it.get("quantity_received", Decimal("0")) <= Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-GRN-LINE-QTY",
                            message=f"Line {i+1} received quantity must be greater than zero.",
                            severity="BLOCK",
                        )
                    )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[PurchaseReceipt]:
        """Matches existing PurchaseReceipt by receipt_no."""
        receipt_no = norm.get("receipt_no")
        if not receipt_no:
            return None

        stmt = (
            select(PurchaseReceipt)
            .where(
                PurchaseReceipt.company_id == company_id,
                PurchaseReceipt.receipt_no == receipt_no,
                PurchaseReceipt.is_deleted == False,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[PurchaseReceipt]
    ) -> DataBridgeDiff:
        """Diffs existing GRN against ingress document."""
        if not existing:
            return DataBridgeDiff(fields={})

        diff_fields: Dict[str, DataBridgeDiffField] = {}
        if norm.get("notes") and norm["notes"] != (existing.notes or ""):
            diff_fields["notes"] = DataBridgeDiffField(
                old_value=existing.notes,
                new_value=norm["notes"],
                is_different=True,
            )
        return DataBridgeDiff(fields=diff_fields)

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[PurchaseReceipt],
        diff_res: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies GRN receipt action."""
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
        """Executes preview for GRN receipts."""
        grouped_docs = self.group_rows(rows)
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_receipts: Set[str] = set()

        for idx, doc in enumerate(grouped_docs, start=1):
            receipt_no = doc.get("receipt_no")
            target_id = receipt_no or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            if receipt_no:
                if receipt_no in seen_receipts:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-GRN-DUP-FILE",
                            message=f"Duplicate GRN number '{receipt_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_receipts.add(receipt_no)

            existing = await self.match(doc, session, company_id)
            if existing:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="GRN_ALREADY_EXISTS",
                        message=f"GRN '{existing.receipt_no}' already exists in system with status '{existing.status}'.",
                        severity="BLOCK",
                    )
                )

            d = self.diff(doc, existing)
            classification = self.classify(doc, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            subtotal = sum((it["quantity_received"] * it["cost_price"]) for it in doc.get("items", []))
            tax_total = sum(it["tax_amount"] for it in doc.get("items", []))
            grand_total = subtotal + tax_total

            preview_data = {
                "receipt_no": receipt_no,
                "supplier_name": doc.get("supplier_name") or doc.get("supplier_code") or doc.get("supplier_id"),
                "order_no": doc.get("order_no"),
                "item_count": len(doc.get("items", [])),
                "subtotal": str(subtotal.quantize(Decimal("0.01"))),
                "tax_total": str(tax_total.quantize(Decimal("0.01"))),
                "grand_total": str(grand_total.quantize(Decimal("0.01"))),
                "items": [
                    {
                        "code": it["code"],
                        "name": it["name"],
                        "batch_no": it.get("batch_no"),
                        "quantity_received": str(it["quantity_received"]),
                        "cost_price": str(it["cost_price"]),
                        "gst_rate": str(it["gst_rate"]),
                        "line_total": str(it["line_total"]),
                    }
                    for it in doc.get("items", [])
                ],
            }

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="GOODS_RECEIPT_NOTE",
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
            name=sname or scode or f"Supplier-{doc.get('receipt_no')}",
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
        """Commits GRN receipts via PurchaseService."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit GRN batch: {'; '.join(blocking)}")

        grouped_docs = self.group_rows(rows)
        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tenant_ctx = TenantContext(company_id=company_id, branch_id=eff_branch)
        purchase_service = PurchaseService(session, tenant_ctx)

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, doc in zip(preview_items, grouped_docs):
            receipt_no = doc.get("receipt_no")
            supplier_id = await self._resolve_or_create_supplier(session, doc, company_id, branch_id)

            po_id = None
            if doc.get("order_no"):
                po_stmt = select(PurchaseOrder.id).where(
                    PurchaseOrder.company_id == company_id,
                    PurchaseOrder.order_no == doc["order_no"],
                    PurchaseOrder.is_deleted == False,
                )
                po_id = (await session.execute(po_stmt)).scalars().first()

            line_items_in: List[PurchaseReceiptItemCreate] = []
            for it in doc.get("items", []):
                code = it["code"]
                p_stmt = select(Product.id).where(
                    Product.company_id == company_id,
                    or_(Product.code == code, Product.sku == code, Product.id == code),
                    Product.is_deleted == False,
                )
                p_id = (await session.execute(p_stmt)).scalars().first()
                from app.services.product_resolution_service import ProductResolutionService
                canon_res = await ProductResolutionService.resolve(
                    session=session,
                    company_id=company_id,
                    identifier=code,
                )
                if not canon_res or not canon_res.success or not canon_res.item_id:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "ITEM_NOT_FOUND",
                            "message": f"Item/SKU/Barcode '{code}' not found in Item Master. Stock inward via GRN is prohibited.",
                        },
                    )

                if canon_res.product_id:
                    p_id = canon_res.product_id
                else:
                    # Canonical Item exists but lacks legacy Product bridge; create transitional shadow Product bridge
                    p_tech_id, p_id_code = await IdentityEngine.allocate_internal(
                        session=session,
                        entity_type="PRODUCT",
                        group_code="PRD",
                        company_id=company_id,
                        branch_id=branch_id or "BR-MAIN-001",
                        purpose="DATABRIDGE_CANONICAL_BRIDGE",
                    )
                    new_prod = Product(
                        id=p_tech_id,
                        code=code or p_id_code,
                        sku=canon_res.sku or code or p_id_code,
                        barcode=canon_res.barcode or code or p_id_code,
                        name=canon_res.name or it["name"] or code,
                        category="General",
                        price=it.get("mrp") or it["cost_price"],
                        cost_price=it["cost_price"],
                        item_id=canon_res.item_id,
                        item_variant_id=canon_res.variant_id,
                        company_id=company_id,
                        branch_id=branch_id or "BR-MAIN-001",
                    )
                    session.add(new_prod)
                    await session.flush()
                    p_id = new_prod.id

                line_items_in.append(
                    PurchaseReceiptItemCreate(
                        product_id=p_id,
                        item_id=canon_res.item_id,
                        variant_id=canon_res.variant_id,
                        code=code,
                        name=it["name"],
                        batch_no=it.get("batch_no"),
                        mrp=it.get("mrp"),
                        quantity_received=it["quantity_received"],
                        cost_price=it["cost_price"],
                        gst_rate=it["gst_rate"],
                        purchase_order_id=po_id,
                        purchase_order_no=doc.get("order_no"),
                    )
                )

            grn_create_schema = PurchaseReceiptCreate(
                receipt_no=receipt_no,
                supplier_id=supplier_id,
                warehouse_id=doc.get("warehouse_id"),
                order_id=po_id,
                notes=doc.get("notes"),
                items=line_items_in,
            )

            created_grn = await purchase_service.create_purchase_receipt(grn_create_schema)
            created_id = getattr(created_grn, "id", None) or (created_grn.get("id") if isinstance(created_grn, dict) else None)
            grand_total_str = str(getattr(created_grn, "grand_total", None) or (created_grn.get("grand_total") if isinstance(created_grn, dict) else ""))

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=created_id,
                    entity_type="GOODS_RECEIPT_NOTE",
                    classification=item_res.classification,
                    target_identifier=str(receipt_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "receipt_id": created_id,
                        "receipt_no": receipt_no,
                        "supplier_id": supplier_id,
                        "grand_total": grand_total_str,
                    },
                )
            )

        return final_items, committed_count
