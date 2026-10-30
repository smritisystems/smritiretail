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

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_STOCK_TRANSFER_ADAPTER", role="ADAPTER", canonicalOwner="backend/app/services/databridge/service.py")

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException
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
from app.models.inventory import StockTransfer, StockTransferItem, Warehouse, Product, TransferStatus
from app.services.identity.engine import IdentityEngine


class DataBridgeStockTransferAdapter(BaseDataBridgeAdapter):
    """
    Canonical domain adapter for Stock Transfer Orders (STO).
    Handles tabular multi-row grouping by transfer_no, dual-warehouse resolution,
    missing product auto-provisioning, source != dest warehouse validation,
    and atomic persistence to stock_transfers & stock_transfer_items.
    """

    entity_name = "stock_transfer"

    def group_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups flat tabular rows into parent Stock Transfer documents with line items.
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

            raw_transfer_no = (
                row.get("transfer_no")
                or row.get("sto_no")
                or row.get("transfer_number")
                or row.get("document_no")
                or row.get("doc_no")
            )
            transfer_no = str(raw_transfer_no).strip() if raw_transfer_no else f"GEN-STO-{uuid.uuid4().hex[:8].upper()}"

            line_item = {
                "product_id": str(row.get("product_id") or row.get("sku") or row.get("barcode") or row.get("item_code") or "").strip(),
                "sku": str(row.get("sku") or "").strip(),
                "barcode": str(row.get("barcode") or "").strip(),
                "item_name": str(row.get("item_name") or row.get("product_name") or row.get("name") or "").strip(),
                "batch_no": str(row.get("batch_no") or "DEFAULT").strip(),
                "quantity": float(row.get("quantity") or row.get("quantity_dispatched") or row.get("qty") or 0.0),
                "quantity_dispatched": float(row.get("quantity_dispatched") or row.get("quantity") or row.get("qty") or 0.0),
                "quantity_received": float(row.get("quantity_received") or 0.0),
                "unit_cost": float(row.get("unit_cost") or row.get("cost_price") or row.get("rate") or 0.0),
                "notes": str(row.get("item_notes") or row.get("notes") or "").strip(),
            }

            if transfer_no not in grouped:
                grouped[transfer_no] = {
                    "transfer_no": transfer_no,
                    "source_warehouse": str(
                        row.get("source_warehouse")
                        or row.get("source_warehouse_code")
                        or row.get("source_warehouse_id")
                        or row.get("source_warehouse_name")
                        or row.get("from_warehouse")
                        or ""
                    ).strip(),
                    "dest_warehouse": str(
                        row.get("dest_warehouse")
                        or row.get("dest_warehouse_code")
                        or row.get("dest_warehouse_id")
                        or row.get("dest_warehouse_name")
                        or row.get("to_warehouse")
                        or ""
                    ).strip(),
                    "status": str(row.get("status") or TransferStatus.DRAFT.value).strip().upper(),
                    "dispatch_date": str(row.get("dispatch_date") or row.get("date") or "").strip(),
                    "received_date": str(row.get("received_date") or "").strip(),
                    "transporter_name": str(row.get("transporter_name") or "").strip(),
                    "lr_number": str(row.get("lr_number") or "").strip(),
                    "vehicle_number": str(row.get("vehicle_number") or "").strip(),
                    "e_way_bill_no": str(row.get("e_way_bill_no") or "").strip(),
                    "idempotency_key": str(row.get("idempotency_key") or "").strip(),
                    "notes": str(row.get("notes") or "").strip(),
                    "items": [],
                }

            grouped[transfer_no]["items"].append(line_item)

        return passthrough + list(grouped.values())

    async def _resolve_or_create_warehouse(
        self,
        session: AsyncSession,
        company_id: str,
        wh_ref: str,
        default_name: str = "Warehouse",
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
            name=f"{default_name} ({wh_code})",
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

        matched_p = None
        for p in all_prods:
            if str(p.id).strip() == ref:
                matched_p = p
                break
            if p.sku and str(p.sku).strip().lower() == ref.lower():
                matched_p = p
                break
            if p.barcode and str(p.barcode).strip().lower() == ref.lower():
                matched_p = p
                break
            if p.code and str(p.code).strip().lower() == ref.lower():
                matched_p = p
                break

        from app.services.product_resolution_service import ProductResolutionService
        if matched_p:
            if not matched_p.item_id:
                res = await ProductResolutionService.resolve_by_product_id(
                    session=session,
                    company_id=company_id,
                    product_id=matched_p.id,
                )
                if not res or not res.item_id:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "UNLINKED_PRODUCT_NOT_ALLOWED",
                            "message": f"Product '{matched_p.code}' is not linked to canonical Item Master. Stock transfer is prohibited.",
                        },
                    )
            return matched_p

        # Attempt authoritative canonical resolution
        canon_res = await ProductResolutionService.resolve(
            session=session,
            company_id=company_id,
            identifier=ref,
        )
        if not canon_res or not canon_res.success or not canon_res.item_id:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ITEM_NOT_FOUND",
                    "message": f"Item/SKU/Barcode '{ref}' not found in Item Master. Stock transfer for unknown items is prohibited.",
                },
            )

        if canon_res.product_id:
            cp = await session.get(Product, canon_res.product_id)
            if cp:
                return cp

        p_tech_id, p_id_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="PRODUCT",
            group_code="PRD",
            company_id=company_id,
            purpose="DATABRIDGE_CANONICAL_BRIDGE",
        )
        prod_id = p_tech_id or IdentityEngine.generate_technical_id()
        unit_cost = Decimal(str(item_data.get("unit_cost") or 100.0))
        new_p = Product(
            id=prod_id,
            uuid=prod_id,
            company_id=company_id,
            code=p_id_code or f"PRD-{ref.upper()[:20]}",
            sku=canon_res.sku or ref.upper()[:100],
            name=str(canon_res.name or item_data.get("item_name") or f"Product {ref}")[:255],
            category="GENERAL",
            barcode=canon_res.barcode or ref.upper()[:100],
            cost_price=unit_cost,
            price=unit_cost * Decimal("1.25"),
            stock=0,
            mrp=unit_cost * Decimal("1.50"),
            item_id=canon_res.item_id,
            item_variant_id=canon_res.variant_id,
        )
        session.add(new_p)
        await session.flush()
        return new_p

    def normalize(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes a single stock transfer document structure."""
        transfer_no = str(
            row.get("transfer_no")
            or row.get("sto_no")
            or row.get("transfer_number")
            or row.get("document_no")
            or row.get("doc_no")
            or ""
        ).strip()

        source_wh = str(
            row.get("source_warehouse")
            or row.get("source_warehouse_code")
            or row.get("source_warehouse_id")
            or row.get("source_warehouse_name")
            or row.get("from_warehouse")
            or ""
        ).strip()

        dest_wh = str(
            row.get("dest_warehouse")
            or row.get("dest_warehouse_code")
            or row.get("dest_warehouse_id")
            or row.get("dest_warehouse_name")
            or row.get("to_warehouse")
            or ""
        ).strip()

        items = row.get("items") or []
        norm_items: List[Dict[str, Any]] = []
        for it in items:
            qty = float(it.get("quantity") or it.get("quantity_dispatched") or it.get("qty") or 0.0)
            cost = float(it.get("unit_cost") or it.get("cost_price") or it.get("rate") or 0.0)
            norm_items.append({
                "product_id": str(it.get("product_id") or it.get("sku") or it.get("barcode") or it.get("item_code") or "").strip(),
                "sku": str(it.get("sku") or "").strip(),
                "barcode": str(it.get("barcode") or "").strip(),
                "item_name": str(it.get("item_name") or it.get("product_name") or it.get("name") or "").strip(),
                "batch_no": str(it.get("batch_no") or "DEFAULT").strip(),
                "quantity_dispatched": qty,
                "quantity_received": float(it.get("quantity_received") or 0.0),
                "unit_cost": cost,
                "notes": str(it.get("notes") or "").strip(),
            })

        return {
            "transfer_no": transfer_no,
            "source_warehouse": source_wh,
            "dest_warehouse": dest_wh,
            "status": str(row.get("status") or TransferStatus.DRAFT.value).strip().upper(),
            "dispatch_date": str(row.get("dispatch_date") or "").strip(),
            "received_date": str(row.get("received_date") or "").strip(),
            "transporter_name": str(row.get("transporter_name") or "").strip(),
            "lr_number": str(row.get("lr_number") or "").strip(),
            "vehicle_number": str(row.get("vehicle_number") or "").strip(),
            "e_way_bill_no": str(row.get("e_way_bill_no") or "").strip(),
            "idempotency_key": str(row.get("idempotency_key") or "").strip(),
            "notes": str(row.get("notes") or "").strip(),
            "items": norm_items,
        }

    def validate(self, normalized_row: Dict[str, Any]) -> List[DataBridgeConflict]:
        """Validates stock transfer invariant constraints."""
        conflicts: List[DataBridgeConflict] = []

        if not normalized_row.get("transfer_no"):
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-TRANSFER-NO-MISSING",
                message="Transfer number (transfer_no) is mandatory.",
                severity="BLOCK",
            ))

        src = normalized_row.get("source_warehouse")
        dst = normalized_row.get("dest_warehouse")

        if not src:
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-SRC-WH-MISSING",
                message="Source warehouse is mandatory.",
                severity="BLOCK",
            ))

        if not dst:
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-DEST-WH-MISSING",
                message="Destination warehouse is mandatory.",
                severity="BLOCK",
            ))

        if src and dst and src.strip().lower() == dst.strip().lower():
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-WAREHOUSE-SAME",
                message="Source and destination warehouses cannot be the same.",
                severity="BLOCK",
            ))

        items = normalized_row.get("items") or []
        if not items:
            conflicts.append(DataBridgeConflict(
                conflict_code="SMRITI-VAL-NO-LINES",
                message="Stock transfer must contain at least one line item.",
                severity="BLOCK",
            ))

        for idx, it in enumerate(items):
            if it.get("quantity_dispatched", 0.0) <= 0:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-VAL-INVALID-QTY",
                    message=f"Line {idx+1}: Dispatch quantity must be greater than zero.",
                    severity="BLOCK",
                ))

        return conflicts

    async def match(
        self,
        session: AsyncSession,
        normalized_row: Dict[str, Any],
        company_id: str,
    ) -> Optional[StockTransfer]:
        """Matches existing StockTransfer by transfer_no within tenant."""
        tx_no = normalized_row.get("transfer_no")
        if not tx_no:
            return None

        q = (
            select(StockTransfer)
            .where(
                StockTransfer.company_id == company_id,
                StockTransfer.transfer_no == tx_no,
                StockTransfer.is_deleted == False,
            )
            .options(selectinload(StockTransfer.items))
        )
        res = await session.execute(q)
        return res.scalars().first()

    def diff(
        self,
        existing: Optional[StockTransfer],
        normalized_row: Dict[str, Any],
    ) -> DataBridgeDiff:
        """Computes field differences between existing transfer and import payload."""
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
        existing: Optional[StockTransfer],
        conflicts: List[DataBridgeConflict],
        diff: DataBridgeDiff,
    ) -> DataBridgeClassification:
        """Classifies stock transfer operation."""
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
        """Executes read-only preview for Stock Transfers with zero DB mutations."""
        grouped = self.group_rows(rows)
        results: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_tx_nos = set()

        for idx, row in enumerate(grouped):
            norm = self.normalize(row)
            conflicts = self.validate(norm)

            tx_no = norm.get("transfer_no")
            if tx_no in seen_tx_nos:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-TRANSFER-DUP-FILE",
                    message=f"Duplicate transfer order number in import batch: {tx_no}.",
                    severity="BLOCK",
                ))
            if tx_no:
                seen_tx_nos.add(tx_no)

            existing = await self.match(session, norm, company_id)
            if existing:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-TRANSFER-EXISTS",
                    message=f"Stock transfer {tx_no} already exists in company database.",
                    severity="BLOCK",
                ))

            d = self.diff(existing, norm)
            classification = self.classify(existing, conflicts, d)

            if classification in (DataBridgeClassification.VALIDATION_ERROR, DataBridgeClassification.EXISTING_CONFLICT):
                for c in conflicts:
                    if c.severity == "BLOCK":
                        blocking_reasons.append(f"Row {idx+1} ({tx_no}): {c.message}")

            results.append(DataBridgeResultItem(
                row_index=idx,
                record_id=existing.id if existing else None,
                entity_type="STOCK_TRANSFER",
                classification=classification,
                target_identifier=str(tx_no or f"ROW-{idx}"),
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
        """Atomically persists Stock Transfers and line items to database."""
        grouped = self.group_rows(rows)
        results: List[DataBridgeResultItem] = []
        committed_count = 0

        for idx, row in enumerate(grouped):
            norm = self.normalize(row)
            conflicts = self.validate(norm)
            existing = await self.match(session, norm, company_id)

            if existing:
                conflicts.append(DataBridgeConflict(
                    conflict_code="SMRITI-CONFL-TRANSFER-EXISTS",
                    message=f"Stock transfer {norm.get('transfer_no')} already exists.",
                    severity="BLOCK",
                ))

            d = self.diff(existing, norm)
            classification = self.classify(existing, conflicts, d)

            if classification == DataBridgeClassification.CREATE:
                src_wh = await self._resolve_or_create_warehouse(session, company_id, norm["source_warehouse"], "Source Godown")
                dst_wh = await self._resolve_or_create_warehouse(session, company_id, norm["dest_warehouse"], "Destination Godown")

                transfer_id = IdentityEngine.generate_technical_id()
                dispatch_dt = datetime.now(timezone.utc)
                if norm.get("dispatch_date"):
                    try:
                        dispatch_dt = datetime.fromisoformat(norm["dispatch_date"].replace("Z", "+00:00"))
                    except Exception:
                        pass

                st = StockTransfer(
                    id=transfer_id,
                    uuid=transfer_id,
                    company_id=company_id,
                    branch_id=branch_id or src_wh.id,
                    transfer_no=norm["transfer_no"],
                    source_warehouse_id=src_wh.id,
                    dest_warehouse_id=dst_wh.id,
                    status=norm.get("status") or TransferStatus.DRAFT.value,
                    dispatch_date=dispatch_dt,
                    transporter_name=norm.get("transporter_name") or None,
                    lr_number=norm.get("lr_number") or None,
                    vehicle_number=norm.get("vehicle_number") or None,
                    e_way_bill_no=norm.get("e_way_bill_no") or None,
                    idempotency_key=norm.get("idempotency_key") or None,
                    notes=norm.get("notes") or None,
                )
                session.add(st)
                await session.flush()

                for it in norm.get("items", []):
                    prod = await self._resolve_or_create_product(session, company_id, it)
                    item_id = IdentityEngine.generate_technical_id()
                    sti = StockTransferItem(
                        id=item_id,
                        uuid=item_id,
                        company_id=company_id,
                        branch_id=branch_id or src_wh.id,
                        transfer_id=st.id,
                        product_id=prod.id,
                        batch_no=it.get("batch_no") or "DEFAULT",
                        quantity_dispatched=Decimal(str(it.get("quantity_dispatched") or 1.0)),
                        quantity_received=Decimal(str(it.get("quantity_received") or 0.0)),
                        quantity_shortage=Decimal("0.0000"),
                        quantity_damaged=Decimal("0.0000"),
                        unit_cost=Decimal(str(it.get("unit_cost") or 0.0)),
                        notes=it.get("notes") or None,
                    )
                    session.add(sti)

                await session.flush()
                committed_count += 1

            results.append(DataBridgeResultItem(
                row_index=idx,
                record_id=existing.id if existing else None,
                entity_type="STOCK_TRANSFER",
                classification=classification,
                target_identifier=str(norm.get("transfer_no") or f"ROW-{idx}"),
                diff=d,
                conflicts=conflicts,
                warnings=[],
                normalized_data=norm,
            ))

        return results, committed_count
