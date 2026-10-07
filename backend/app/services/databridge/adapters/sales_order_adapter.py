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
Classification: Internal — DataBridge Sales Order Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_SALES_ORDER_ADAPTER", role="CANONICAL")

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
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.crm import Customer
from app.models.inventory import Product
from app.services.identity.engine import IdentityEngine


class DataBridgeSalesOrderAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for Sales Orders (Customer Orders).
    Supports multi-row line grouping by order_no, customer auto-resolution/auto-provisioning,
    product auto-provisioning for FK satisfaction, line tax & grand total calculations,
    idempotent replay, and atomic multi-tenant transaction commit.
    """

    SO_HEADER_MAP: Dict[str, List[str]] = {
        "order_no": [
            "order_no", "order no", "so_no", "so no", "so_number", "so number",
            "sales_order_no", "sales order no", "sales_order_number", "order_number", "order id",
        ],
        "date": [
            "date", "order_date", "so_date", "doc_date", "document_date",
        ],
        "customer_id": [
            "customer_id", "customer id", "cust_id", "cust id", "party_id",
        ],
        "customer_code": [
            "customer_code", "customer code", "cust_code", "cust code", "party_code",
        ],
        "customer_name": [
            "customer_name", "customer name", "customer", "client", "client_name", "party_name",
            "buyer_name", "name",
        ],
        "customer_gstin": [
            "customer_gstin", "gstin", "gst_no", "gst_number", "buyer_gstin", "party_gstin",
        ],
        "customer_mobile": [
            "customer_mobile", "mobile", "phone", "contact", "mobile_no", "phone_no",
        ],
        "po_number": [
            "po_number", "po_no", "po number", "cust_po", "customer_po", "po_reference",
        ],
        "delivery_date": [
            "delivery_date", "due_date", "expected_delivery_date", "ship_date",
        ],
        "delivery_address": [
            "delivery_address", "shipping_address", "address", "destination",
        ],
        "notes": [
            "notes", "remarks", "narration", "comment", "description",
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
            "quantity", "qty", "ordered_qty", "units", "count",
        ],
        "price": [
            "price", "rate", "unit_price", "selling_price", "sale_rate", "selling_rate",
        ],
        "gst_rate": [
            "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax", "gst_percent",
        ],
        "hsn_code": [
            "hsn_code", "hsn", "hsn_sac",
        ],
        "mrp": [
            "mrp", "max_retail_price",
        ],
    }

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Maps raw row headers and cleans standard Sales Order fields."""
        norm: Dict[str, Any] = {}

        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_k = self.clean_header_key(raw_k)
            matched = False
            for target_k, aliases in self.SO_HEADER_MAP.items():
                clean_aliases = [self.clean_header_key(a) for a in aliases]
                if clean_k in clean_aliases or clean_k == self.clean_header_key(target_k):
                    norm[target_k] = raw_v
                    matched = True
                    break
            if not matched:
                norm[str(raw_k).strip().lower()] = raw_v

        norm["_row_index"] = row_index

        for field in [
            "order_no", "customer_id", "customer_code", "customer_name",
            "customer_gstin", "customer_mobile", "po_number", "delivery_address",
            "notes", "item_code", "item_name", "hsn_code"
        ]:
            if field in norm and norm[field] is not None:
                norm[field] = str(norm[field]).strip()

        if norm.get("order_no"):
            norm["order_no"] = str(norm["order_no"]).strip().upper()

        if norm.get("customer_gstin"):
            norm["customer_gstin"] = str(norm["customer_gstin"]).strip().upper()

        for num_field in ["quantity", "price", "gst_rate", "mrp"]:
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
            group_key = order_no if order_no else f"__UNNAMED_SO_{idx}__"

            if group_key not in grouped_docs:
                order_sequence.append(group_key)
                grouped_docs[group_key] = {
                    "order_no": order_no,
                    "date": normalized.get("date"),
                    "customer_id": normalized.get("customer_id"),
                    "customer_code": normalized.get("customer_code"),
                    "customer_name": normalized.get("customer_name"),
                    "customer_gstin": normalized.get("customer_gstin"),
                    "customer_mobile": normalized.get("customer_mobile"),
                    "po_number": normalized.get("po_number"),
                    "delivery_date": normalized.get("delivery_date"),
                    "delivery_address": normalized.get("delivery_address"),
                    "notes": normalized.get("notes"),
                    "_row_index": idx,
                    "items": [],
                }

            doc = grouped_docs[group_key]
            for hf in [
                "customer_id", "customer_code", "customer_name", "customer_gstin",
                "customer_mobile", "po_number", "delivery_date", "delivery_address", "notes", "date"
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

        code = norm.get("item_code") or norm.get("code") or "SKU-SO-GEN"
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
            "hsn_code": norm.get("hsn_code"),
            "mrp": norm.get("mrp") or price,
            "_row_index": row_idx,
        }

    async def validate(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str, row_index: int
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates document numbers and line items."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        order_no = norm.get("order_no")
        if not order_no or not str(order_no).strip():
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SO-NO-REQ",
                    message="Sales order number (order_no) is mandatory.",
                    severity="BLOCK",
                )
            )

        items = norm.get("items", [])
        if not items:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SO-NO-ITEMS",
                    message="Sales order must contain at least one line item.",
                    severity="BLOCK",
                )
            )
        else:
            for i, it in enumerate(items):
                it_qty = it.get("quantity", Decimal("0"))
                if it_qty <= Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-SO-LINE-QTY",
                            message=f"Line {i+1} quantity must be greater than zero.",
                            severity="BLOCK",
                        )
                    )
                it_price = it.get("price", Decimal("0"))
                if it_price < Decimal("0"):
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-SO-LINE-PRICE",
                            message=f"Line {i+1} price cannot be negative.",
                            severity="BLOCK",
                        )
                    )

        return conflicts, warnings

    async def match(
        self, norm: Dict[str, Any], session: AsyncSession, company_id: str
    ) -> Optional[SalesOrder]:
        """Matches existing SalesOrder in the database by order_no within company."""
        order_no = norm.get("order_no")
        if not order_no:
            return None

        stmt = (
            select(SalesOrder)
            .where(
                SalesOrder.company_id == company_id,
                SalesOrder.order_no == order_no,
                SalesOrder.is_deleted == False,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def diff(
        self, norm: Dict[str, Any], existing: Optional[SalesOrder]
    ) -> DataBridgeDiff:
        """Calculates difference between existing database record and ingress document."""
        if not existing:
            return DataBridgeDiff(fields={})

        diff = DataBridgeDiff(fields={})
        if norm.get("customer_name") and str(existing.customer_name).strip() != str(norm["customer_name"]).strip():
            diff.fields["customer_name"] = DataBridgeDiffField(
                old_value=existing.customer_name,
                new_value=norm["customer_name"],
                is_different=True,
            )

        return diff

    def classify(
        self,
        norm: Dict[str, Any],
        existing: Optional[SalesOrder],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies sales order row."""
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
        """Executes read-only preview and conflict validation for Sales Orders."""
        grouped_docs = self.group_rows(rows)
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_orders: Set[str] = set()

        for idx, doc in enumerate(grouped_docs, start=1):
            target_id = doc.get("order_no") or f"ROW-{idx}"
            conflicts, warnings = await self.validate(doc, session, company_id, idx)

            order_no = doc.get("order_no")
            if order_no:
                if order_no in seen_orders:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-CONFL-SO-DUP-FILE",
                            message=f"Duplicate order number '{order_no}' found in the same import file.",
                            severity="BLOCK",
                        )
                    )
                seen_orders.add(order_no)

            existing = await self.match(doc, session, company_id)
            if existing:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SALES_ORDER_ALREADY_EXISTS",
                        message=f"Sales Order '{order_no}' already exists under this company.",
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
                "order_no": order_no,
                "customer_name": doc.get("customer_name") or doc.get("customer_code") or "Cash Customer",
                "customer_gstin": doc.get("customer_gstin"),
                "date": str(doc.get("date") or datetime.now(timezone.utc).date()),
                "items_count": len(doc.get("items", [])),
                "tax_total": str(tot_tax),
                "grand_total": str(tot_amt),
                "po_number": doc.get("po_number"),
            }

            result_items.append(
                DataBridgeResultItem(
                    row_index=doc.get("_row_index", idx),
                    record_id=existing.id if existing else None,
                    entity_type="SALES_ORDER",
                    classification=classification,
                    target_identifier=str(target_id),
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                    normalized_data=preview_data,
                )
            )

        return result_items, blocking_reasons

    async def _resolve_or_create_customer(
        self, session: AsyncSession, doc: Dict[str, Any], company_id: str, branch_id: Optional[str]
    ) -> Tuple[str, str]:
        """Resolves existing customer or auto-provisions a new Customer entity."""
        cid = doc.get("customer_id")
        ccode = doc.get("customer_code")
        cname = doc.get("customer_name")
        cgstin = doc.get("customer_gstin")
        cmobile = doc.get("customer_mobile")

        if cid:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.id == cid,
                Customer.is_deleted == False,
            )
            c = (await session.execute(stmt)).scalars().first()
            if c:
                return c.id, c.name

        clauses = []
        if ccode:
            clauses.append(Customer.code == ccode)
        if cgstin:
            clauses.append(Customer.gst_number == cgstin)
        if cmobile:
            clauses.append(Customer.mobile == cmobile)
        if cname and not (ccode or cgstin or cmobile):
            clauses.append(Customer.name == cname)

        if clauses:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                Customer.is_deleted == False,
                or_(*clauses),
            )
            c = (await session.execute(stmt)).scalars().first()
            if c:
                return c.id, c.name

        # Auto-provision new Customer
        c_tech_id, c_id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="CUSTOMER",
            group_code="CUS",
            company_id=company_id,
            branch_id=branch_id,
            purpose="DATABRIDGE_AUTO_PROVISION",
        )
        resolved_name = cname or f"Customer {c_id_code}"
        new_c = Customer(
            id=c_tech_id,
            identity_code=c_id_code,
            code=ccode or c_id_code,
            name=resolved_name,
            mobile=cmobile,
            gst_number=cgstin,
            customer_type="RETAIL" if not cgstin else "B2B",
            pricing_basis="MRP",
            company_id=company_id,
            branch_id=branch_id,
            status="Active",
        )
        session.add(new_c)
        await session.flush()
        return new_c.id, new_c.name

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
                            "message": f"Product '{p.code}' is not linked to canonical Item Master. Sales orders are prohibited.",
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
                    "message": f"Item/SKU/Barcode '{raw_code}' not found in Item Master. Sales orders for unknown items are prohibited.",
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
            mrp=it.get("mrp") or price,
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
        """Atomically commits Sales Orders and line items to PostgreSQL."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Sales Orders: {'; '.join(blocking)}")

        grouped_docs = self.group_rows(rows)
        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, doc in zip(preview_items, grouped_docs):
            if item_res.classification != DataBridgeClassification.CREATE:
                final_items.append(item_res)
                continue

            order_no = doc["order_no"]
            cust_id, cust_name = await self._resolve_or_create_customer(session, doc, company_id, branch_id)

            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")
            basic_total = Decimal("0.00")
            total_qty = Decimal("0.0000")

            order_items: List[SalesOrderItem] = []
            for it in doc.get("items", []):
                p_id, p_code, p_name, item_id, variant_id = await self._resolve_or_create_product(session, it, company_id, branch_id)
                basic_total += it["taxable_value"]
                tax_total += it["tax_amount"]
                grand_total += it["total_amount"]
                total_qty += it["quantity"]

                so_item = SalesOrderItem(
                    company_id=company_id,
                    branch_id=branch_id,
                    product_id=p_id,
                    item_id=item_id,
                    variant_id=variant_id,
                    code=p_code,
                    name=p_name,
                    quantity=it["quantity"],
                    price=it["price"],
                    hsn_code=it.get("hsn_code"),
                    gst_rate=it.get("gst_rate", Decimal("18.00")),
                    tax_amount=it["tax_amount"],
                    total_amount=it["total_amount"],
                    pending_quantity=it["quantity"],
                )
                order_items.append(so_item)

            so_tech_id, _so_id_code = await IdentityEngine.allocate_internal(
                session=session,
                entity_type="SALES_ORDER",
                group_code="SO",
                company_id=company_id,
                branch_id=branch_id,
                purpose="DATABRIDGE_COMMIT",
            )

            so_date = doc.get("date")
            if isinstance(so_date, str):
                try:
                    so_date = datetime.strptime(so_date[:10], "%Y-%m-%d").date()
                except Exception:
                    so_date = datetime.now(timezone.utc).date()
            elif isinstance(so_date, datetime):
                so_date = so_date.date()
            elif not isinstance(so_date, date_type):
                so_date = datetime.now(timezone.utc).date()

            sales_order = SalesOrder(
                id=so_tech_id,
                company_id=company_id,
                branch_id=branch_id,
                order_no=order_no,
                date=so_date,
                customer_id=cust_id,
                customer_name=cust_name,
                customer_gstin=doc.get("customer_gstin"),
                po_number=doc.get("po_number"),
                delivery_address=doc.get("delivery_address"),
                basic_total=basic_total,
                tax_total=tax_total,
                grand_total=grand_total,
                total_qty=total_qty,
                pending_qty=total_qty,
                status="Draft",
                fulfillment_status="UNFULFILLED",
                items=order_items,
            )
            session.add(sales_order)
            await session.flush()

            committed_count += 1
            final_items.append(
                DataBridgeResultItem(
                    row_index=item_res.row_index,
                    record_id=sales_order.id,
                    entity_type="SALES_ORDER",
                    classification=item_res.classification,
                    target_identifier=str(order_no),
                    diff=item_res.diff,
                    conflicts=[],
                    warnings=[],
                    normalized_data={
                        "order_id": sales_order.id,
                        "order_no": order_no,
                        "customer_id": cust_id,
                        "customer_name": cust_name,
                        "grand_total": str(grand_total),
                        "items_count": len(order_items),
                    },
                )
            )

        return final_items, committed_count
