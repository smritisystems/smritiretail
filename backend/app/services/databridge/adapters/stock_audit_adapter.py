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
Classification: Internal — Foundation Service Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_STOCK_AUDIT_ADAPTER", role="ADAPTER", canonicalOwner="backend/app/services/databridge/service.py")

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .base_adapter import BaseDataBridgeAdapter
from ..models import (
    DataBridgeClassification,
    DataBridgeConflict,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeResultItem,
)
from app.models.inventory import StockAudit, StockAuditItem, Warehouse, Product
from app.services.identity.engine import IdentityEngine


class DataBridgeStockAuditAdapter(BaseDataBridgeAdapter):
    """
    Canonical domain adapter for Stock Audits & Physical Inventory Counts.
    Handles tabular multi-row grouping by audit_no, warehouse resolution,
    missing product auto-provisioning, system vs counted variance calculations,
    and atomic persistence to stock_audits & stock_audit_items.
    """

    entity_name = "stock_audit"

    def group_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups flat tabular rows into parent Stock Audit documents with line items.
        If a row already contains nested 'items' or 'lines', preserves it as-is.
        """
        grouped: Dict[str, Dict[str, Any]] = {}
        passthrough: List[Dict[str, Any]] = []

        for row in rows:
            if "items" in row and isinstance(row["items"], list):
                passthrough.append(row)
                continue
            if "lines" in row and isinstance(row["lines"], list):
                c = dict(row)
                c["items"] = c.pop("lines")
                passthrough.append(c)
                continue

            raw_audit_no = (
                row.get("audit_no")
                or row.get("count_no")
                or row.get("adjustment_no")
                or row.get("document_no")
                or row.get("doc_no")
            )
            audit_no = str(raw_audit_no).strip() if raw_audit_no else f"GEN-AUDIT-{uuid.uuid4().hex[:8].upper()}"

            sys_qty = float(row.get("system_qty") or row.get("book_qty") or row.get("current_stock") or 0.0)
            counted_qty = float(row.get("counted_qty") or row.get("physical_qty") or row.get("actual_qty") or 0.0)
            cost = float(row.get("unit_cost") or row.get("cost_price") or row.get("rate") or 0.0)
            variance_qty = counted_qty - sys_qty
            variance_val = variance_qty * cost

            line_item = {
                "product_id": str(row.get("product_id") or row.get("sku") or row.get("barcode") or row.get("item_code") or "").strip(),
                "sku": str(row.get("sku") or "").strip(),
                "barcode": str(row.get("barcode") or "").strip(),
                "item_name": str(row.get("item_name") or row.get("product_name") or row.get("name") or "").strip(),
                "batch_no": str(row.get("batch_no") or "DEFAULT").strip(),
                "system_qty": sys_qty,
                "counted_qty": counted_qty,
                "variance_qty": variance_qty,
                "unit_cost": cost,
                "variance_value": variance_val,
                "discrepancy_reason": str(row.get("discrepancy_reason") or row.get("reason") or "COUNTING_ERROR").strip().upper(),
                "notes": str(row.get("item_notes") or row.get("notes") or "").strip(),
            }

            if audit_no not in grouped:
                grouped[audit_no] = {
                    "audit_no": audit_no,
                    "warehouse": str(
                        row.get("warehouse")
                        or row.get("warehouse_code")
                        or row.get("warehouse_id")
                        or row.get("warehouse_name")
                        or ""
                    ).strip(),
                    "audit_date": str(row.get("audit_date") or row.get("date") or "").strip(),
                    "audit_type": str(row.get("audit_type") or "CYCLE_COUNT").strip().upper(),
                    "status": str(row.get("status") or "DRAFT").strip().upper(),
                    "notes": str(row.get("notes") or "").strip(),
                    "reconciled_by": str(row.get("reconciled_by") or "").strip(),
                    "items": [],
                }

            grouped[audit_no]["items"].append(line_item)

        return passthrough + list(grouped.values())

    async def _resolve_or_create_warehouse(
        self,
        session: AsyncSession,
        company_id: str,
        wh_ref: str,
    ) -> Warehouse:
        """Resolves warehouse by id, code, or name; auto-provisions if missing."""
        clean_ref = str(wh_ref or "").strip()
        if not clean_ref:
            clean_ref = "CENTRAL-WH"

        q = select(Warehouse).where(
            Warehouse.company_id == company_id,
            Warehouse.is_deleted == False,
        )
        res = await session.execute(q)
        all_whs = res.scalars().all()

        for w in all_whs:
            if str(w.id).strip().lower() == clean_ref.lower():
                return w
            if str(w.code).strip().lower() == clean_ref.lower():
                return w
            if str(w.name).strip().lower() == clean_ref.lower():
                return w

        wh_id = IdentityEngine.generate_technical_id()
        wh_code = clean_ref.upper()[:50]
        new_wh = Warehouse(
            id=wh_id,
            uuid=wh_id,
            company_id=company_id,
            code=wh_code,
            name=f"Warehouse ({wh_code})",
            is_transit=False,
            is_central_godown=False,
        )
        session.add(new_wh)
        await session.flush()
        return new_wh

    async def _resolve_or_create_product(
        self,
        session: AsyncSession,
        company_id: str,
        item_data: Dict[str, Any],
    ) -> Product:
        """Resolves product by product_id, sku, barcode, or code; auto-provisions if missing."""
        ref = str(
            item_data.get("product_id")
            or item_data.get("sku")
            or item_data.get("barcode")
            or item_data.get("code")
            or ""
        ).strip()
        if not ref:
            ref = f"SKU-{uuid.uuid4().hex[:8].upper()}"

        q = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted == False,
        )
        res = await session.execute(q)
        all_prods = res.scalars().all()

        for p in all_prods:
            if str(p.id).strip() == ref:
                return p
            if p.sku and str(p.sku).strip().lower() == ref.lower():
                return p
            if p.barcode and str(p.barcode).strip().lower() == ref.lower():
                return p
            if p.code and str(p.code).strip().lower() == ref.lower():
                return p

        p_tech_id, p_id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="PRODUCT",
            group_code="PRD",
            company_id=company_id,
        )
        prod_id = p_tech_id or IdentityEngine.generate_technical_id()
        unit_cost = Decimal(str(item_data.get("unit_cost") or 100.0))
        new_p = Product(
            id=prod_id,
            uuid=prod_id,
            company_id=company_id,
            code=p_id_code or f"PRD-{ref.upper()[:20]}",
            sku=ref.upper()[:100],
            name=str(item_data.get("item_name") or f"Product {ref}")[:255],
            category="GENERAL",
            barcode=ref.upper()[:100],
            cost_price=unit_cost,
            price=unit_cost * Decimal("1.25"),
            stock=0,
            mrp=unit_cost * Decimal("1.50"),
        )
        session.add(new_p)
        await session.flush()
        return new_p

    def normalize(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes a single stock audit document structure."""
        audit_no = str(
            row.get("audit_no")
            or row.get("count_no")
            or row.get("adjustment_no")
            or row.get("document_no")
            or row.get("doc_no")
            or ""
        ).strip()

        wh = str(
            row.get("warehouse")
            or row.get("warehouse_code")
            or row.get("warehouse_id")
            or row.get("warehouse_name")
            or ""
        ).strip()

        items = row.get("items") or []
        norm_items: List[Dict[str, Any]] = []
        for it in items:
            sys_qty = float(it.get("system_qty") or 0.0)
            counted_qty = float(it.get("counted_qty") or 0.0)
            cost = float(it.get("unit_cost") or it.get("cost_price") or it.get("rate") or 0.0)
            variance_qty = counted_qty - sys_qty
            variance_val = variance_qty * cost

            norm_items.append({
                "product_id": str(it.get("product_id") or it.get("sku") or it.get("barcode") or it.get("item_code") or "").strip(),
                "sku": str(it.get("sku") or "").strip(),
                "barcode": str(it.get("barcode") or "").strip(),
                "item_name": str(it.get("item_name") or it.get("product_name") or it.get("name") or "").strip(),
                "batch_no": str(it.get("batch_no") or "DEFAULT").strip(),
                "system_qty": sys_qty,
                "counted_qty": counted_qty,
                "variance_qty": variance_qty,
                "unit_cost": cost,
                "variance_value": variance_val,
                "discrepancy_reason": str(it.get("discrepancy_reason") or "COUNTING_ERROR").strip().upper(),
                "notes": str(it.get("notes") or "").strip(),
            })

        return {
            "audit_no": audit_no,
            "warehouse": wh,
            "audit_date": str(row.get("audit_date") or "").strip(),
            "audit_type": str(row.get("audit_type") or "CYCLE_COUNT").strip().upper(),
            "status": str(row.get("status") or "DRAFT").strip().upper(),
            "notes": str(row.get("notes") or "").strip(),
            "reconciled_by": str(row.get("reconciled_by") or "").strip(),
            "items": norm_items,
        }

    def validate(self, normalized_row: Dict[str, Any]) -> List[DataBridgeConflict]:
        """Validates stock audit invariant constraints."""
        conflicts: List[DataBridgeConflict] = []

        if not normalized_row.get("audit_no"):
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-AUDIT-NO-MISSING",
                message="Audit document number (audit_no) is mandatory.",
                severity="BLOCK",
            ))

        if not normalized_row.get("warehouse"):
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-WAREHOUSE-MISSING",
                message="Warehouse reference is mandatory for stock audit.",
                severity="BLOCK",
            ))

        items = normalized_row.get("items") or []
        if not items:
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-NO-LINES",
                message="Stock audit must contain at least one line item.",
                severity="BLOCK",
            ))

        valid_types = ("FULL", "CYCLE_COUNT", "SPOT_CHECK")
        if normalized_row.get("audit_type") not in valid_types:
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-INVALID-AUDIT-TYPE",
                message=f"Invalid audit type: {normalized_row.get('audit_type')}. Must be one of {valid_types}.",
                severity="WARNING",
            ))

        return conflicts

    async def match(
        self,
        session: AsyncSession,
        normalized_row: Dict[str, Any],
        company_id: str,
    ) -> Optional[StockAudit]:
        """Matches existing StockAudit by audit_no within tenant."""
        audit_no = normalized_row.get("audit_no")
        if not audit_no:
            return None

        q = (
            select(StockAudit)
            .where(
                StockAudit.company_id == company_id,
                StockAudit.audit_no == audit_no,
                StockAudit.is_deleted == False,
            )
            .options(selectinload(StockAudit.items))
        )
        res = await session.execute(q)
        return res.scalars().first()

    def diff(
        self,
        existing: Optional[StockAudit],
        normalized_row: Dict[str, Any],
    ) -> DataBridgeDiff:
        """Computes field differences between existing audit and import payload."""
        fields: Dict[str, DataBridgeDiffField] = {}
        if not existing:
            return DataBridgeDiff(fields={})

        if existing.status != normalized_row.get("status"):
            fields["status"] = DataBridgeDiffField(old_value=existing.status, new_value=normalized_row.get("status"))

        if existing.notes != normalized_row.get("notes"):
            fields["notes"] = DataBridgeDiffField(old_value=existing.notes, new_value=normalized_row.get("notes"))

        return DataBridgeDiff(fields=fields)

    def classify(
        self,
        existing: Optional[StockAudit],
        conflicts: List[DataBridgeConflict],
        diff: DataBridgeDiff,
    ) -> DataBridgeClassification:
        """Classifies stock audit operation."""
        if any(c.severity == "BLOCK" for c in conflicts):
            if any("EXISTS" in c.conflict_code or "DUP" in c.conflict_code for c in conflicts):
                return DataBridgeClassification.EXISTING_CONFLICT
            return DataBridgeClassification.VALIDATION_ERROR
        if existing:
            return DataBridgeClassification.EXISTING_CONFLICT
        return DataBridgeClassification.CREATE

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Executes read-only preview for Stock Audits with zero DB mutations."""
        grouped = self.group_rows(rows)
        results: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_audit_nos = set()

        for idx, row in enumerate(grouped):
            norm = self.normalize(row)
            conflicts = self.validate(norm)

            audit_no = norm.get("audit_no")
            if audit_no in seen_audit_nos:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-AUDIT-DUP-FILE",
                    message=f"Duplicate audit reference number in import batch: {audit_no}.",
                    severity="BLOCK",
                ))
            if audit_no:
                seen_audit_nos.add(audit_no)

            existing = await self.match(session, norm, company_id)
            if existing:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-AUDIT-EXISTS",
                    message=f"Stock audit {audit_no} already exists in company database.",
                    severity="BLOCK",
                ))

            d = self.diff(existing, norm)
            classification = self.classify(existing, conflicts, d)

            if classification in (DataBridgeClassification.VALIDATION_ERROR, DataBridgeClassification.EXISTING_CONFLICT):
                for c in conflicts:
                    if c.severity == "BLOCK":
                        blocking_reasons.append(f"Row {idx+1} ({audit_no}): {c.message}")

            results.append(DataBridgeResultItem(
                row_index=idx,
                record_id=existing.id if existing else None,
                entity_type="STOCK_AUDIT",
                classification=classification,
                target_identifier=str(audit_no or f"ROW-{idx}"),
                diff=d,
                conflicts=conflicts,
                warnings=[],
                normalized_data=norm,
            ))

        return results, blocking_reasons

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Atomically persists Stock Audits and line items to database."""
        grouped = self.group_rows(rows)
        results: List[DataBridgeResultItem] = []
        committed_count = 0

        for idx, row in enumerate(grouped):
            norm = self.normalize(row)
            conflicts = self.validate(norm)
            existing = await self.match(session, norm, company_id)

            if existing:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-AUDIT-EXISTS",
                    message=f"Stock audit {norm.get('audit_no')} already exists.",
                    severity="BLOCK",
                ))

            d = self.diff(existing, norm)
            classification = self.classify(existing, conflicts, d)

            if classification == DataBridgeClassification.CREATE:
                wh = await self._resolve_or_create_warehouse(session, company_id, norm["warehouse"])

                audit_id = IdentityEngine.generate_technical_id()
                audit_dt = datetime.now(timezone.utc)
                if norm.get("audit_date"):
                    try:
                        audit_dt = datetime.fromisoformat(norm["audit_date"].replace("Z", "+00:00"))
                    except Exception:
                        pass

                sa = StockAudit(
                    id=audit_id,
                    uuid=audit_id,
                    company_id=company_id,
                    branch_id=branch_id or wh.id,
                    audit_no=norm["audit_no"],
                    warehouse_id=wh.id,
                    audit_date=audit_dt,
                    status=norm.get("status") or "DRAFT",
                    audit_type=norm.get("audit_type") or "CYCLE_COUNT",
                    notes=norm.get("notes") or None,
                    reconciled_by=norm.get("reconciled_by") or None,
                )
                session.add(sa)
                await session.flush()

                for it in norm.get("items", []):
                    prod = await self._resolve_or_create_product(session, company_id, it)
                    item_id = IdentityEngine.generate_technical_id()
                    unit_cost = Decimal(str(it.get("unit_cost") or 0.0))
                    sys_qty = Decimal(str(it.get("system_qty") or 0.0))
                    counted_qty = Decimal(str(it.get("counted_qty") or 0.0))
                    variance_qty = counted_qty - sys_qty
                    variance_val = variance_qty * unit_cost

                    sai = StockAuditItem(
                        id=item_id,
                        uuid=item_id,
                        company_id=company_id,
                        branch_id=branch_id or wh.id,
                        audit_id=sa.id,
                        product_id=prod.id,
                        batch_no=it.get("batch_no") or "DEFAULT",
                        system_qty=sys_qty,
                        counted_qty=counted_qty,
                        variance_qty=variance_qty,
                        unit_cost=unit_cost,
                        variance_value=variance_val,
                        discrepancy_reason=it.get("discrepancy_reason") or "COUNTING_ERROR",
                        is_reconciled=False,
                        notes=it.get("notes") or None,
                    )
                    session.add(sai)

                await session.flush()
                committed_count += 1

            results.append(DataBridgeResultItem(
                row_index=idx,
                record_id=existing.id if existing else None,
                entity_type="STOCK_AUDIT",
                classification=classification,
                target_identifier=str(norm.get("audit_no") or f"ROW-{idx}"),
                diff=d,
                conflicts=conflicts,
                warnings=[],
                normalized_data=norm,
            ))

        return results, committed_count
