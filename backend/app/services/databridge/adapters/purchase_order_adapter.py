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
Classification: Internal — DataBridge Purchase Order Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_PURCHASE_ORDER_ADAPTER", role="CANONICAL")

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
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, Supplier
from app.models.inventory import Product
from app.models.item_master import Item
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from app.services.purchase import PurchaseService
from app.services.identity.engine import IdentityEngine
from app.api.deps import TenantContext


class DataBridgePurchaseOrderAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Purchase Order (PO) Inward Transactions.
    Supports multi-row line grouping, supplier auto-resolution/auto-provisioning,
    line tax & totals verification, idempotent replay, and atomic execution.
    """

    PO_HEADER_MAP: Dict[str, List[str]] = {
        "order_no": [
            "order_no", "order no", "po_no", "po no", "po_number", "po number",
            "purchase_order_no", "purchase order no", "purchase_order_number",
            "order_number", "order id", "po_id", "order_num",
        ],
        "supplier_id": [
            "supplier_id", "supplier id", "vendor_id", "vendor id",
        ],
        "supplier_code": [
            "supplier_code", "supplier code", "vendor_code", "vendor code", "supp_code",
        ],
        "supplier_name": [
            "supplier_name", "supplier name", "supplier", "vendor", "vendor_name",
            "vendor name", "party_name", "party name", "supp_name",
        ],
        "supplier_gstin": [
            "supplier_gstin", "vendor_gstin", "gstin", "gst_number", "gst_no", "supp_gstin",
        ],
        "supplier_mobile": [
            "supplier_mobile", "vendor_mobile", "mobile", "phone", "contact",
        ],
        "order_date": [
            "order_date", "po_date", "date", "order date", "po date",
        ],
        "notes": [
            "notes", "remarks", "narration", "comment", "description", "note",
        ],
        "item_code": [
            "item_code", "item code", "product_code", "product code", "sku",
            "sku_code", "article_code", "barcode", "code", "item_no",
        ],
        "item_name": [
            "item_name", "item name", "product_name", "product name", "item",
            "product", "item_description", "description", "name",
        ],
        "quantity": [
            "quantity", "qty", "ordered_qty", "order_qty", "units", "count",
        ],
        "cost_price": [
            "cost_price", "cost price", "rate", "cost", "unit_cost", "purchase_rate",
            "purchase_price", "price", "unit_price", "buying_price",
        ],
        "gst_rate": [
            "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax", "gst_percent",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes a raw row mapping column aliases."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.PO_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for field in ["order_no", "supplier_id", "supplier_code", "supplier_name", "notes", "item_code", "item_name"]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        if norm.get("order_no"):
            norm["order_no"] = str(norm["order_no"]).strip().upper()

        if norm.get("supplier_gstin"):
            norm["supplier_gstin"] = str(norm["supplier_gstin"]).strip().upper()

        for num_field in ["quantity", "cost_price", "gst_rate"]:
            if num_field in norm and norm[num_field] is not None:
                try:
                    norm[num_field] = Decimal(str(norm[num_field]).strip())
                except (InvalidOperation, TypeError, ValueError):
                    pass

        return norm

    def group_rows(self, raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Groups multi-row tabular input by document identifier order_no."""
        grouped_docs: Dict[str, Dict[str, Any]] = {}
        order_sequence: List[str] = []

        for idx, row in enumerate(raw_rows):
            normalized = self.normalize(row, idx)
            order_no = normalized.get("order_no")
            group_key = order_no if order_no else f"__UNNAMED_ROW_{idx}__"

            if group_key not in grouped_docs:
                order_sequence.append(group_key)
                grouped_docs[group_key] = {
                    "order_no": order_no,
                    "supplier_id": normalized.get("supplier_id"),
                    "supplier_code": normalized.get("supplier_code"),
                    "supplier_name": normalized.get("supplier_name"),
                    "supplier_gstin": normalized.get("supplier_gstin"),
                    "supplier_mobile": normalized.get("supplier_mobile"),
                    "notes": normalized.get("notes"),
                    "order_date": normalized.get("order_date"),
                    "_row_index": idx,
                    "items": [],
                }

            doc = grouped_docs[group_key]
            for hf in ["supplier_id", "supplier_code", "supplier_name", "supplier_gstin", "supplier_mobile", "notes"]:
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
            "quantity": qty,
            "cost_price": cost,
            "gst_rate": gst,
            "tax_amount": line_tax,
            "line_total": line_total,
            "_row_index": row_idx,
        }

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates mandatory document headers, supplier specifications, and line items."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        order_no = norm.get("order_no")
        if not order_no or not str(order_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-PO-NO-REQ",
                    message="Purchase Order number (order_no) is mandatory.",
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
                    conflict_code="SMRITI-VAL-PO-SUPPLIER-REQ",
                    message="Supplier reference (supplier_id, supplier_code, or supplier_name) is required.",
                    severity="BLOCK",
                )
            )

        items = norm.get("items", [])
        if not items:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-PO-NO-ITEMS",
                    message="Purchase Order must contain at least one line item.",
                    severity="BLOCK",
                )
            )
        else:
            for i, it in enumerate(items):
                it_qty = it.get("quantity", Decimal("0"))
                if it_qty <= Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-PO-LINE-QTY",
                            message=f"Line {i+1} quantity must be greater than zero.",
                            severity="BLOCK",
                        )
                    )
                it_cost = it.get("cost_price", Decimal("0"))
                if it_cost < Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-PO-LINE-COST",
                            message=f"Line {i+1} cost price cannot be negative.",
                            severity="BLOCK",
                        )
                    )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[PurchaseOrder]:
        """Matches existing PurchaseOrder in the database by order_no within company."""
        order_no = norm.get("order_no")
        if not order_no:
            return None

        stmt = (
            select(PurchaseOrder)
            .where(
                PurchaseOrder.company_id == company_id,
                PurchaseOrder.order_no == order_no,
                PurchaseOrder.is_deleted == False,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[PurchaseOrder]
    ) -> DataBridgeDiff:
        """Calculates difference between existing database record and ingress document."""
        if not existing:
            return DataBridgeDiff(fields={})

        diff_fields: Dict[str, DataBridgeDiffField] = {}
        if norm.get("status") and str(norm["status"]).upper() != str(existing.status).upper():
            diff_fields["status"] = DataBridgeDiffField(
                old_value=existing.status,
                new_value=str(norm["status"]).upper(),
                is_different=True,
            )

        in_notes = norm.get("notes") or ""
        ex_notes = existing.notes or ""
        if in_notes != ex_notes:
            diff_fields["notes"] = DataBridgeDiffField(
                old_value=ex_notes,
                new_value=in_notes,
                is_different=True,
            )

        existing_item_count = len(getattr(existing, "items", []) or [])
        incoming_item_count = len(norm.get("items", []))
        if incoming_item_count != existing_item_count:
            diff_fields["item_count"] = DataBridgeDiffField(
                old_value=existing_item_count,
                new_value=incoming_item_count,
                is_different=True,
            )

        return DataBridgeDiff(fields=diff_fields)

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[PurchaseOrder],
        diff_res: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies document action into CREATE, NO_CHANGE, UPDATE, or EXISTING_CONFLICT."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any("IMMUTABLE" in c.conflict_code or "EXIST" in c.conflict_code for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        if not diff_res.fields:
            return DataBridgeClassification.NO_CHANGE

        return DataBridgeClassification.UPDATE

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes full preview pipeline on grouped purchase orders."""
        grouped_docs = self.group_rows(rows)
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_orders: Set[str] = set()

        for idx, doc in enumerate(grouped_docs, start=1):
            order_no = doc.get("order_no")
            target_id = order_no or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            if order_no:
                if order_no in seen_orders:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-PO-DUP-FILE",
                            message=f"Duplicate Purchase Order '{order_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_orders.add(order_no)

            existing = await self.match(doc, session, company_id)
            if existing and existing.status in ("CONFIRMED", "RECEIVED", "COMPLETED", "CANCELLED"):
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="ORDER_IMMUTABLE",
                        message=f"Purchase order '{existing.order_no}' is already in status '{existing.status}' and cannot be altered.",
                        severity="BLOCK",
                    )
                )

            d = self.diff(doc, existing)
            classification = self.classify(doc, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            subtotal = sum((it["quantity"] * it["cost_price"]) for it in doc.get("items", []))
            tax_total = sum(it["tax_amount"] for it in doc.get("items", []))
            grand_total = subtotal + tax_total

            preview_data = {
                "order_no": order_no,
                "supplier_name": doc.get("supplier_name") or doc.get("supplier_code") or doc.get("supplier_id"),
                "item_count": len(doc.get("items", [])),
                "subtotal": str(subtotal.quantize(Decimal("0.01"))),
                "tax_total": str(tax_total.quantize(Decimal("0.01"))),
                "grand_total": str(grand_total.quantize(Decimal("0.01"))),
                "items": [
                    {
                        "code": it["code"],
                        "name": it["name"],
                        "quantity": str(it["quantity"]),
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
                    entity_type="PURCHASE_ORDER",
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
        sgstin = doc.get("supplier_gstin")

        if sid:
            stmt = select(Supplier).where(
                Supplier.company_id == company_id,
                Supplier.id == sid,
                Supplier.is_deleted == False,
            )
            s_obj = (await session.execute(stmt)).scalars().first()
            if s_obj:
                return s_obj.id

        clauses = []
        if scode:
            clauses.append(Supplier.code == scode)
        if sgstin:
            clauses.append(Supplier.gst_number == sgstin)
        if sname:
            clauses.append(Supplier.name == sname)

        if clauses:
            stmt = select(Supplier).where(
                Supplier.company_id == company_id,
                Supplier.is_deleted == False,
                or_(*clauses),
            )
            s_obj = (await session.execute(stmt)).scalars().first()
            if s_obj:
                return s_obj.id

        # Auto-provision Supplier
        supp_name = sname or scode or f"Supplier-{doc.get('order_no')}"
        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="SUPPLIER",
            group_code="SUP",
            company_id=company_id,
            branch_id=eff_branch,
            purpose="DATABRIDGE_AUTO_PROVISION",
        )
        supp_code = scode or id_code

        new_supp = Supplier(
            id=tech_id,
            identity_code=id_code,
            code=supp_code,
            name=supp_name,
            gst_number=sgstin,
            mobile=doc.get("supplier_mobile"),
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
        """Atomically persists Purchase Orders into tenant database."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Purchase Order batch: {'; '.join(blocking)}")

        grouped_docs = self.group_rows(rows)
        eff_branch = branch_id if branch_id and branch_id != "MAIN" else "BR-MAIN-001"
        tenant_ctx = TenantContext(company_id=company_id, branch_id=eff_branch)
        purchase_service = PurchaseService(session, tenant_ctx)

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, doc in zip(preview_items, grouped_docs):
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            order_no = doc.get("order_no")
            supplier_id = await self._resolve_or_create_supplier(session, doc, company_id, branch_id)

            line_items_in: List[PurchaseOrderItemCreate] = []
            for it in doc.get("items", []):
                code = it["code"]
                p_stmt = select(Product.id).where(
                    Product.company_id == company_id,
                    or_(Product.code == code, Product.sku == code, Product.id == code),
                    Product.is_deleted == False,
                )
                p_id = (await session.execute(p_stmt)).scalars().first()
                if not p_id:
                    # Auto-provision Product record to satisfy foreign key constraint fk_poi_product_id
                    p_tech_id, p_id_code = await IdentityEngine.allocate_internal(
                        session=session,
                        entity_type="PRODUCT",
                        group_code="PRD",
                        company_id=company_id,
                        branch_id=branch_id or "BR-MAIN-001",
                        purpose="DATABRIDGE_AUTO_PROVISION",
                    )
                    new_prod = Product(
                        id=p_tech_id,
                        code=code or p_id_code,
                        sku=code or p_id_code,
                        barcode=code or p_id_code,
                        name=it["name"] or code,
                        category="General",
                        price=it["cost_price"],
                        cost_price=it["cost_price"],
                        company_id=company_id,
                        branch_id=branch_id or "BR-MAIN-001",
                    )
                    session.add(new_prod)
                    await session.flush()
                    p_id = new_prod.id

                line_items_in.append(
                    PurchaseOrderItemCreate(
                        product_id=p_id,
                        code=code,
                        name=it["name"],
                        quantity=it["quantity"],
                        cost_price=it["cost_price"],
                        gst_rate=it["gst_rate"],
                    )
                )

            po_create_schema = PurchaseOrderCreate(
                order_no=order_no,
                supplier_id=supplier_id,
                notes=doc.get("notes"),
                items=line_items_in,
            )

            created_po = await purchase_service.create_purchase_order(po_create_schema)
            created_id = getattr(created_po, "id", None) or (created_po.get("id") if isinstance(created_po, dict) else None)
            grand_total_str = str(getattr(created_po, "grand_total", None) or (created_po.get("grand_total") if isinstance(created_po, dict) else ""))

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=created_id,
                    entity_type="PURCHASE_ORDER",
                    classification=item_res.classification,
                    target_identifier=str(order_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "order_id": created_id,
                        "order_no": order_no,
                        "supplier_id": supplier_id,
                        "grand_total": grand_total_str,
                    },
                )
            )

        return final_items, committed_count
