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
Classification: Internal — DataBridge Item Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_ITEM_ADAPTER", role="CANONICAL")

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, or_, and_
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
)
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.services.item.item_catalog_svc import ItemCatalogService
from app.services.catalog_validation import (
    IM001ControlledFieldValidator,
    CatalogDimensionValidator,
)


class DataBridgeItemAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for ItemMaster (Style / Parent Item).
    Orchestrates validation, matching, diffing, and delegates persistence to ItemCatalogService.
    Zero business rule duplication.
    """

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Maps raw row headers and cleans standard fields."""
        norm = self.normalize_row_headers(raw)
        norm["_row_index"] = row_index

        # Clean string attributes
        for str_field in ["item_code", "item_name", "brand", "category", "department", "primary_uom", "hsn_code", "style_code", "collection_type", "gender"]:
            if str_field in norm and norm[str_field] is not None:
                norm[str_field] = str(norm[str_field]).strip()

        # Numeric attributes
        if "tax_rate" in norm and norm["tax_rate"] is not None:
            try:
                norm["tax_rate"] = float(str(norm["tax_rate"]).rstrip("%").strip())
            except (ValueError, TypeError):
                pass

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
        """Validates controlled fields and mandatory invariants without mutating DB."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        code = normalized.get("item_code") or normalized.get("style_code")
        if not code and not normalized.get("auto_generate_article_number"):
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-ITEM-CODE",
                    message="Item code or style code is mandatory when auto-generation is not requested.",
                    severity="BLOCK",
                )
            )

        # Controlled fields validation via IM001 engine
        governed_payload = {
            "brand": normalized.get("brand"),
            "category": normalized.get("category"),
            "department": normalized.get("department"),
            "style_code": normalized.get("style_code") or code,
            "color": normalized.get("color"),
            "size": normalized.get("size"),
            "uom": normalized.get("primary_uom") or "PCS",
            "hsn_code": normalized.get("hsn_code"),
            "gst_rate_percent": normalized.get("tax_rate"),
            "gender": normalized.get("gender"),
            "product_type": normalized.get("product_type"),
            "heel_type": normalized.get("heel_type"),
            "upper_material": normalized.get("upper_material"),
            "outsole_material": normalized.get("outsole_material"),
            "collection_type": normalized.get("collection_type"),
        }

        try:
            val_res = await IM001ControlledFieldValidator.validate_dict(
                payload=governed_payload,
                company_id=company_id,
                strict=False,
            )
            for err in val_res.get("errors", []):
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-LOOKUP-ERROR",
                        message=err,
                        severity="BLOCK",
                    )
                )
            for warn in val_res.get("warnings", []):
                warnings.append(warn)
        except Exception as e:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-EXCEPTION",
                    message=f"Validation error: {str(e)}",
                    severity="BLOCK",
                )
            )

        return conflicts, warnings

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[Item]:
        """
        Matching order (company scoped):
        1. item_code
        2. identity_code
        3. style_code + brand
        """
        code = (normalized.get("item_code") or "").strip().upper()
        identity_code = (normalized.get("identity_code") or "").strip().upper()
        style_code = (normalized.get("style_code") or "").strip().upper()
        brand = (normalized.get("brand") or "").strip()

        # 1. Exact item_code
        if code:
            stmt = select(Item).where(
                Item.company_id == company_id,
                Item.item_code == code,
                Item.is_deleted == False,
            ).options(selectinload(Item.variants), selectinload(Item.barcodes))
            item = (await session.execute(stmt)).scalars().first()
            if item:
                return item

        # 2. Identity code
        if identity_code:
            stmt = select(Item).where(
                Item.company_id == company_id,
                Item.identity_code == identity_code,
                Item.is_deleted == False,
            ).options(selectinload(Item.variants), selectinload(Item.barcodes))
            item = (await session.execute(stmt)).scalars().first()
            if item:
                return item

        # 3. Style code + brand
        if style_code and brand:
            stmt = select(Item).where(
                Item.company_id == company_id,
                Item.style_code == style_code,
                Item.brand.ilike(brand),
                Item.is_deleted == False,
            ).options(selectinload(Item.variants), selectinload(Item.barcodes))
            item = (await session.execute(stmt)).scalars().first()
            if item:
                return item

        return None

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Item],
    ) -> DataBridgeDiff:
        """Diffs mutable fields against active DB state."""
        diff = DataBridgeDiff()
        if not existing:
            return diff

        mutable_field_pairs = [
            ("item_name", existing.item_name, normalized.get("item_name")),
            ("brand", existing.brand, normalized.get("brand")),
            ("category", existing.category, normalized.get("category")),
            ("department", existing.department, normalized.get("department")),
            ("primary_uom", existing.primary_uom, normalized.get("primary_uom")),
            ("collection_type", existing.collection_type, normalized.get("collection_type")),
            ("hsn_code", existing.hsn_code, normalized.get("hsn_code")),
        ]

        for field_name, old_val, new_val in mutable_field_pairs:
            if new_val is not None and str(new_val).strip() != "":
                clean_old = str(old_val).strip() if old_val is not None else ""
                clean_new = str(new_val).strip()
                if clean_old.upper() != clean_new.upper():
                    diff.fields[field_name] = DataBridgeDiffField(
                        old_value=old_val,
                        new_value=new_val,
                        is_different=True,
                    )

        if "tax_rate" in normalized and normalized["tax_rate"] is not None:
            try:
                new_tax = Decimal(str(normalized["tax_rate"]))
                old_tax = existing.tax_rate or Decimal("0")
                if abs(old_tax - new_tax) > Decimal("0.001"):
                    diff.fields["tax_rate"] = DataBridgeDiffField(
                        old_value=float(old_tax),
                        new_value=float(new_tax),
                        is_different=True,
                    )
            except Exception:
                pass

        return diff

    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Item],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Determines the authoritative classification status."""
        if any(c.severity == "BLOCK" for c in conflicts):
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
        """Executes read-only preview for Item batch."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_codes: Set[str] = set()

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            target_id = norm.get("item_code") or norm.get("style_code") or f"ROW-{idx}"

            # Check duplicate in-file rows
            conflicts, warnings = await self.validate(norm, session, company_id, idx)
            if target_id and target_id.upper() in seen_codes:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-DUP-ROW",
                        message=f"Duplicate item code '{target_id}' found in the same import file.",
                        severity="BLOCK",
                    )
                )
            if target_id and not norm.get("auto_generate_article_number"):
                seen_codes.add(target_id.upper())

            # Match
            existing = await self.match(norm, session, company_id)
            d = self.diff(norm, existing)
            classification = self.classify(norm, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_id}]: {c.message}")

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="ITEM",
                    classification=classification,
                    target_identifier=target_id,
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
        """Atomically persists items delegating to ItemCatalogService."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Item batch: {'; '.join(blocking)}")

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            norm = self.normalize(raw_row, item_res.row_index)
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            if item_res.classification == DataBridgeClassification.CREATE:
                # Delegate to canonical ItemCatalogService
                created_item = await ItemCatalogService.create_item(
                    session=session,
                    company_id=company_id,
                    branch_id=branch_id or "BR-001",
                    item_code=norm.get("item_code"),
                    item_name=norm.get("item_name") or norm.get("item_code") or "Item",
                    brand=norm.get("brand"),
                    category=norm.get("category") or "GENERAL",
                    department=norm.get("department"),
                    primary_uom=norm.get("primary_uom") or "PCS",
                    tax_rate=norm.get("tax_rate", 18.0),
                    mrp=norm.get("mrp", 0.0),
                    selling_price=norm.get("selling_price", 0.0),
                    cost_price=norm.get("cost_price", 0.0),
                    hsn_code=norm.get("hsn_code"),
                    primary_barcode=norm.get("barcode"),
                    collection_type=norm.get("collection_type"),
                    commit=False,
                )
                committed_count += 1
                item_res.record_id = created_item.id
                item_res.target_identifier = created_item.item_code
                final_items.append(item_res)

            elif item_res.classification == DataBridgeClassification.UPDATE:
                existing = await self.match(norm, session, company_id)
                if existing:
                    if norm.get("item_name"):
                        existing.item_name = norm["item_name"]
                    if norm.get("brand"):
                        existing.brand = norm["brand"]
                    if norm.get("category"):
                        existing.category = norm["category"]
                    if norm.get("department"):
                        existing.department = norm["department"]
                    if norm.get("primary_uom"):
                        existing.primary_uom = norm["primary_uom"]
                    if norm.get("collection_type"):
                        existing.collection_type = norm["collection_type"]
                    if norm.get("hsn_code"):
                        existing.hsn_code = norm["hsn_code"]
                    if "tax_rate" in norm and norm["tax_rate"] is not None:
                        existing.tax_rate = Decimal(str(norm["tax_rate"]))
                    await session.flush()
                    committed_count += 1
                final_items.append(item_res)

        return final_items, committed_count
