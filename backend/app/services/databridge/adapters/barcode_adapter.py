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
Classification: Internal — DataBridge Barcode Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_BARCODE_ADAPTER", role="CANONICAL")

import uuid
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select
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
    DataBridgeBarcodeConflictError,
    DataBridgeDependencyError,
)
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.services.item.barcode_resolver_svc import BarcodeResolverService


class DataBridgeBarcodeAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for ItemBarcode.
    Enforces the 4 mandatory barcode lifecycle rules and strict immutability.
    Synthetic barcode generation is strictly prohibited per ADR-001/R-01.
    """

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes barcode row attributes."""
        norm = self.normalize_row_headers(raw)
        norm["_row_index"] = row_index

        for str_field in ["barcode", "variant_sku", "item_code", "style_code", "barcode_type"]:
            if str_field in norm and norm[str_field] is not None:
                norm[str_field] = str(norm[str_field]).strip()

        if "barcode" in norm and norm["barcode"]:
            norm["barcode"] = norm["barcode"].upper()

        if "variant_sku" in norm and norm["variant_sku"]:
            norm["variant_sku"] = norm["variant_sku"].upper()

        return norm

    async def validate(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
        row_index: int,
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validates barcode format and SKU presence."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        bc = normalized.get("barcode")
        sku = normalized.get("variant_sku") or normalized.get("item_code")

        if not bc:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-BARCODE-EMPTY",
                    message="Barcode value is empty or missing.",
                    severity="BLOCK",
                )
            )

        if not sku:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-SKU-EMPTY",
                    message="Target SKU / variant_sku is required to bind barcode.",
                    severity="BLOCK",
                )
            )

        return conflicts, warnings

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[ItemBarcode]:
        """Queries existing barcode mapping in company scope."""
        bc = (normalized.get("barcode") or "").strip().upper()
        if not bc:
            return None

        stmt = select(ItemBarcode).where(
            ItemBarcode.company_id == company_id,
            ItemBarcode.barcode == bc,
            ItemBarcode.is_deleted == False,
        ).options(
            selectinload(ItemBarcode.variant),
            selectinload(ItemBarcode.item),
        )
        return (await session.execute(stmt)).scalars().first()

    async def resolve_target_variant(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[ItemVariant]:
        """Resolves target ItemVariant for incoming row."""
        sku = (normalized.get("variant_sku") or "").strip().upper()
        if sku:
            stmt = select(ItemVariant).where(
                ItemVariant.company_id == company_id,
                ItemVariant.variant_sku == sku,
                ItemVariant.is_deleted == False,
            ).options(selectinload(ItemVariant.item))
            var = (await session.execute(stmt)).scalars().first()
            if var:
                return var

        # Fallback to item_code if single variant
        item_code = (normalized.get("item_code") or "").strip().upper()
        if item_code:
            stmt = select(ItemVariant).join(Item, ItemVariant.item_id == Item.id).where(
                ItemVariant.company_id == company_id,
                Item.item_code == item_code,
                ItemVariant.is_deleted == False,
            ).options(selectinload(ItemVariant.item))
            vars_list = (await session.execute(stmt)).scalars().all()
            if len(vars_list) == 1:
                return vars_list[0]

        return None

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[ItemBarcode],
    ) -> DataBridgeDiff:
        """Diffs barcode binding."""
        diff = DataBridgeDiff()
        if not existing:
            return diff

        incoming_sku = (normalized.get("variant_sku") or "").strip().upper()
        existing_sku = existing.variant.variant_sku.upper() if existing.variant else (existing.item.item_code.upper() if existing.item else "")

        if incoming_sku and existing_sku and incoming_sku != existing_sku:
            diff.fields["variant_sku"] = DataBridgeDiffField(
                old_value=existing_sku,
                new_value=incoming_sku,
                is_different=True,
            )

        return diff

    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[ItemBarcode],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """
        Applies the 4 mandatory barcode lifecycle rules:
        Rule 1: Existing barcode + same SKU -> NO_CHANGE
        Rule 2: Existing barcode + different SKU -> EXISTING_CONFLICT
        Rule 3: New barcode + new SKU -> CREATE
        Rule 4: New barcode + existing SKU -> CREATE (secondary)
        """
        for c in conflicts:
            if c.conflict_code == "SMRITI-BARCODE-MISMATCH":
                return DataBridgeClassification.EXISTING_CONFLICT
            if c.severity == "BLOCK":
                return DataBridgeClassification.VALIDATION_ERROR

        if not existing:
            return DataBridgeClassification.CREATE

        # Check existing barcode's SKU
        incoming_sku = (normalized.get("variant_sku") or "").strip().upper()
        existing_sku = existing.variant.variant_sku.upper() if existing.variant else (existing.item.item_code.upper() if existing.item else "")

        if incoming_sku and existing_sku and incoming_sku == existing_sku:
            return DataBridgeClassification.NO_CHANGE

        # Rule 2: Barcode bound to different SKU
        return DataBridgeClassification.EXISTING_CONFLICT

    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Previews barcode batch and classifies conflicts."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_barcodes: Dict[str, str] = {}

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            bc = norm.get("barcode") or f"NO-BC-{idx}"
            incoming_sku = norm.get("variant_sku") or norm.get("item_code") or ""

            conflicts, warnings = await self.validate(norm, session, company_id, idx)

            # In-file duplicate barcode check
            if bc in seen_barcodes:
                prev_sku = seen_barcodes[bc]
                if prev_sku != incoming_sku:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-BARCODE-MISMATCH",
                            message=f"Barcode '{bc}' duplicated in file with mismatched SKU ('{prev_sku}' vs '{incoming_sku}').",
                            severity="BLOCK",
                        )
                    )
                else:
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-VAL-DUP-ROW",
                            message=f"Duplicate barcode '{bc}' in same import file.",
                            severity="BLOCK",
                        )
                    )
            seen_barcodes[bc] = incoming_sku

            existing = await self.match(norm, session, company_id)
            if existing:
                existing_sku = existing.variant.variant_sku.upper() if existing.variant else (existing.item.item_code.upper() if existing.item else "")
                if incoming_sku and existing_sku and incoming_sku.upper() != existing_sku:
                    # Rule 2 violation: Attempt to silently reassign existing barcode
                    conflicts.append(
                        DataBridgeConflict(
                            conflict_code="SMRITI-BARCODE-MISMATCH",
                            message=f"Barcode '{bc}' is already bound to SKU '{existing_sku}'. Cannot reassign to '{incoming_sku}'.",
                            conflicting_entity="ITEM_BARCODE",
                            conflicting_id=existing.id,
                            severity="BLOCK",
                        )
                    )

            d = self.diff(norm, existing)
            classification = self.classify(norm, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [Barcode: {bc}]: {c.message}")

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="BARCODE",
                    classification=classification,
                    target_identifier=bc,
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
        """Atomically persists barcodes obeying the 4 lifecycle rules."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Barcode batch: {'; '.join(blocking)}")

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            norm = self.normalize(raw_row, item_res.row_index)
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            if item_res.classification == DataBridgeClassification.CREATE:
                variant = await self.resolve_target_variant(norm, session, company_id)
                if not variant:
                    raise DataBridgeDependencyError(f"Target SKU '{norm.get('variant_sku')}' not found in catalog for barcode assignment.")

                # Check if variant already has primary barcode
                existing_bc_stmt = select(ItemBarcode).where(
                    ItemBarcode.company_id == company_id,
                    ItemBarcode.variant_id == variant.id,
                    ItemBarcode.is_primary == True,
                    ItemBarcode.is_deleted == False,
                )
                has_primary = (await session.execute(existing_bc_stmt)).scalars().first() is not None
                is_primary = False if has_primary else True

                new_bc = ItemBarcode(
                    id=f"ibc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    item_id=variant.item_id,
                    variant_id=variant.id,
                    barcode=item_res.target_identifier,
                    barcode_type=norm.get("barcode_type") or "EAN13",
                    is_primary=is_primary,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(new_bc)
                await session.flush()
                committed_count += 1
                item_res.record_id = new_bc.id
                final_items.append(item_res)

        return final_items, committed_count
