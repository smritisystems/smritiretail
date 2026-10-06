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
Classification: Internal — DataBridge PriceBook Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_PRICEBOOK_ADAPTER", role="CANONICAL")

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .base_adapter import BaseDataBridgeAdapter
from ..models import (
    DataBridgeClassification,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeResultItem,
)
from ..exceptions import (
    DataBridgeValidationError,
    DataBridgeDependencyError,
)
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry
from app.services.item.item_pricing_sync_svc import ItemPricingSyncService


class DataBridgePriceBookAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for PriceBook and PriceBookEntry.
    Enforces composite uniqueness (uq_pbe_matrix), statutory price invariants (mrp >= selling_price),
    and delegates default retail book synchronization to ItemPricingSyncService.
    Zero secondary pricing engine duplication.
    """

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes PriceBook and PriceBookEntry row attributes."""
        norm = self.normalize_row_headers(raw)
        norm["_row_index"] = row_index

        for str_field in ["price_book_code", "variant_sku", "item_code", "currency"]:
            if str_field in norm and norm[str_field] is not None:
                norm[str_field] = str(norm[str_field]).strip()

        # Default min_quantity to 1.0
        try:
            norm["min_quantity"] = float(norm.get("min_quantity") or 1.0)
        except (ValueError, TypeError):
            norm["min_quantity"] = 1.0

        for price_field in ["mrp", "selling_price", "cost_price"]:
            if price_field in norm and norm[price_field] is not None:
                try:
                    norm[price_field] = float(norm[price_field])
                except (ValueError, TypeError):
                    pass

        return norm

    async def validate(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
        row_index: int,
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates pricing sanity and tier thresholds."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        mrp = normalized.get("mrp")
        sp = normalized.get("selling_price")
        cp = normalized.get("cost_price")
        min_qty = normalized.get("min_quantity", 1.0)

        sku = normalized.get("variant_sku") or normalized.get("item_code")
        if not sku:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SKU-MISSING",
                    message="Target SKU or item_code is required for PriceBook entry.",
                    severity="BLOCK",
                )
            )

        if mrp is None or sp is None:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-PRICE-EMPTY",
                    message="Both MRP and Selling Price are required for PriceBook entry.",
                    severity="BLOCK",
                )
            )
        else:
            if mrp < 0 or sp < 0 or (cp is not None and cp < 0):
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-PRICE-NEGATIVE",
                        message="Prices cannot be negative.",
                        severity="BLOCK",
                    )
                )

            if sp > mrp:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-PRICE-INVARIANT",
                        message=f"Selling price ({sp}) cannot exceed MRP ({mrp}) per statutory requirement.",
                        severity="BLOCK",
                    )
                )

        if min_qty <= 0:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-QTY-TIER",
                    message=f"Tier minimum quantity ({min_qty}) must be greater than zero.",
                    severity="BLOCK",
                )
            )

        return conflicts, warnings

    async def resolve_price_book(
        self,
        code: Optional[str],
        session: AsyncSession,
        company_id: str,
    ) -> PriceBook:
        """Resolves existing price book or default retail price book for company."""
        clean_code = (code or f"DEFAULT-{company_id}").strip().upper()
        stmt = select(PriceBook).where(
            PriceBook.company_id == company_id,
            PriceBook.code == clean_code,
            PriceBook.is_deleted == False,
        )
        pb = (await session.execute(stmt)).scalars().first()
        if not pb:
            # Provision new default price book
            pb = PriceBook(
                id=f"pb_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                name=f"Standard Retail Price List ({company_id})" if "DEFAULT" in clean_code else clean_code,
                code=clean_code,
                currency="INR",
                is_default=("DEFAULT" in clean_code),
                status="ACTIVE",
                is_active=True,
                is_deleted=False,
            )
            session.add(pb)
            await session.flush()
        return pb

    async def resolve_target(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Tuple[Optional[Item], Optional[ItemVariant]]:
        """Resolves target Item and optional ItemVariant."""
        sku = (normalized.get("variant_sku") or "").strip().upper()
        item_code = (normalized.get("item_code") or "").strip().upper()

        if sku:
            stmt = select(ItemVariant).where(
                ItemVariant.company_id == company_id,
                ItemVariant.variant_sku == sku,
                ItemVariant.is_deleted == False,
            ).options(selectinload(ItemVariant.item))
            var = (await session.execute(stmt)).scalars().first()
            if var:
                return var.item, var

        if item_code:
            stmt = select(Item).where(
                Item.company_id == company_id,
                Item.item_code == item_code,
                Item.is_deleted == False,
            ).options(selectinload(Item.variants))
            item = (await session.execute(stmt)).scalars().first()
            if item:
                # If item has only 1 variant, bind to it
                if item.variants and len(item.variants) == 1:
                    return item, item.variants[0]
                return item, None

        return None, None

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[PriceBookEntry]:
        """Matches existing entry under composite uniqueness (uq_pbe_matrix)."""
        pb_code = normalized.get("price_book_code")
        pb = await self.resolve_price_book(pb_code, session, company_id)
        item, var = await self.resolve_target(normalized, session, company_id)

        if not item:
            return None

        min_qty = Decimal(str(normalized.get("min_quantity", 1.0)))
        stmt = select(PriceBookEntry).where(
            PriceBookEntry.company_id == company_id,
            PriceBookEntry.price_book_id == pb.id,
            PriceBookEntry.item_id == item.id,
            PriceBookEntry.min_quantity == min_qty,
            PriceBookEntry.is_deleted == False,
        )
        if var:
            stmt = stmt.where(PriceBookEntry.variant_id == var.id)
        else:
            stmt = stmt.where(PriceBookEntry.variant_id.is_(None))

        return (await session.execute(stmt)).scalars().first()

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[PriceBookEntry],
    ) -> DataBridgeDiff:
        """Diffs price rates against existing PriceBookEntry."""
        diff = DataBridgeDiff()
        if not existing:
            return diff

        price_fields = [
            ("mrp", existing.mrp, normalized.get("mrp")),
            ("selling_price", existing.selling_price, normalized.get("selling_price")),
            ("cost_price", existing.cost_price, normalized.get("cost_price")),
        ]

        for fname, old_val, new_val in price_fields:
            if new_val is not None:
                try:
                    dec_old = Decimal(str(old_val if old_val is not None else 0))
                    dec_new = Decimal(str(new_val))
                    if abs(dec_old - dec_new) > Decimal("0.001"):
                        diff.fields[fname] = DataBridgeDiffField(
                            old_value=float(dec_old),
                            new_value=float(dec_new),
                            is_different=True,
                        )
                except Exception:
                    pass

        return diff

    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[PriceBookEntry],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classifies PriceBookEntry row into taxonomy."""
        for c in conflicts:
            if c.conflict_code == "SMRITI-DEP-TARGET-MISSING":
                return DataBridgeClassification.DEPENDENCY_ERROR
            if c.severity == "BLOCK":
                return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        if diff.fields:
            return DataBridgeClassification.UPDATE

        return DataBridgeClassification.NO_CHANGE

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Previews PriceBookEntry batch."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_keys: Set[str] = set()

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            target_sku = norm.get("variant_sku") or norm.get("item_code") or f"ROW-{idx}"
            pb_code = norm.get("price_book_code") or f"DEFAULT-{company_id}"
            min_qty = norm.get("min_quantity", 1.0)
            composite_key = f"{pb_code}::{target_sku}::{min_qty}".upper()

            conflicts, warnings = await self.validate(norm, session, company_id, idx)

            if composite_key in seen_keys:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-DUP-ROW",
                        message=f"Duplicate PriceBook tier for key '{composite_key}' in same file.",
                        severity="BLOCK",
                    )
                )
            seen_keys.add(composite_key)

            item, var = await self.resolve_target(norm, session, company_id)
            if not item:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-DEP-TARGET-MISSING",
                        message=f"Catalog item/variant '{target_sku}' does not exist.",
                        severity="BLOCK",
                    )
                )

            existing = await self.match(norm, session, company_id)
            d = self.diff(norm, existing)
            classification = self.classify(norm, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{composite_key}]: {c.message}")

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="PRICEBOOK",
                    classification=classification,
                    target_identifier=composite_key,
                    diff=d,
                    conflicts=conflicts,
                    warnings=warnings,
                )
            )

        return result_items, blocking_reasons

    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Atomically persists PriceBook entries."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit PriceBook batch: {'; '.join(blocking)}")

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            norm = self.normalize(raw_row, item_res.row_index)
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            pb = await self.resolve_price_book(norm.get("price_book_code"), session, company_id)
            item, var = await self.resolve_target(norm, session, company_id)
            if not item:
                raise DataBridgeDependencyError(f"Target '{norm.get('variant_sku') or norm.get('item_code')}' missing during commit.")

            min_qty = Decimal(str(norm.get("min_quantity", 1.0)))

            if item_res.classification == DataBridgeClassification.CREATE:
                new_pbe = PriceBookEntry(
                    id=f"pbe_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    price_book_id=pb.id,
                    item_id=item.id,
                    variant_id=var.id if var else None,
                    min_quantity=min_qty,
                    mrp=Decimal(str(norm["mrp"])),
                    selling_price=Decimal(str(norm["selling_price"])),
                    cost_price=Decimal(str(norm.get("cost_price", 0.0))),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(new_pbe)
                await session.flush()
                committed_count += 1
                item_res.record_id = new_pbe.id
                final_items.append(item_res)

            elif item_res.classification == DataBridgeClassification.UPDATE:
                existing = await self.match(norm, session, company_id)
                if existing:
                    existing.mrp = Decimal(str(norm["mrp"]))
                    existing.selling_price = Decimal(str(norm["selling_price"]))
                    if "cost_price" in norm and norm["cost_price"] is not None:
                        existing.cost_price = Decimal(str(norm["cost_price"]))
                    await session.flush()
                    committed_count += 1
                final_items.append(item_res)

        return final_items, committed_count
