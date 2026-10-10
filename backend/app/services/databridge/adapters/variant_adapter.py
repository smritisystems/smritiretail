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
Classification: Internal — DataBridge Variant Adapter
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_VARIANT_ADAPTER", role="CANONICAL")

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.localization import UnitOfMeasurementRef
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
from app.models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemUOMSetting,
    ItemPrice,
    ItemTaxProfile,
    ItemSupplierSetting,
    ItemSalesSetting,
    ItemInventoryPolicy,
)
from app.services.item.item_catalog_svc import ItemCatalogService
from app.services.catalog_validation import (
    IM001ControlledFieldValidator,
    CatalogDimensionValidator,
)


class DataBridgeVariantAdapter(BaseDataBridgeAdapter):
    """
    Authoritative DataBridge Adapter for ItemVariant (Physical sellable SKU).
    Enforces parent item resolution, dimension normalization, canonical SKU derivation,
    and 6-policy child domain synchronization. Prevents orphan variants.
    """

    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalizes variant fields from heterogeneous incoming rows."""
        norm = self.normalize_row_headers(raw)
        norm["_row_index"] = row_index

        for str_field in ["item_code", "style_code", "variant_sku", "color", "size", "hsn_code", "primary_uom"]:
            if str_field in norm and norm[str_field] is not None:
                norm[str_field] = str(norm[str_field]).strip()

        for price_field in ["mrp", "selling_price", "cost_price"]:
            if price_field in norm and norm[price_field] is not None:
                try:
                    norm[price_field] = float(norm[price_field])
                except (ValueError, TypeError):
                    pass

        if "tax_rate" in norm and norm["tax_rate"] is not None:
            try:
                norm["tax_rate"] = float(str(norm["tax_rate"]).rstrip("%").strip())
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
        """Validates variant fields and ensures parent style existence."""
        conflicts: List[DataBridgeConflict] = []
        warnings: List[str] = []

        parent_code = (normalized.get("item_code") or normalized.get("style_code") or "").strip().upper()
        if not parent_code:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-DEP-PARENT-MISSING",
                    message="Parent item code (item_code / style_code) is required to associate variant.",
                    severity="BLOCK",
                )
            )

        # Controlled fields validation for color/size
        governed_payload = {
            "color": normalized.get("color"),
            "size": normalized.get("size"),
            "style_code": parent_code,
            "uom": normalized.get("primary_uom") or "PCS",
            "hsn_code": normalized.get("hsn_code"),
            "gst_rate_percent": normalized.get("tax_rate"),
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

        # Pricing sanity
        mrp = normalized.get("mrp")
        sp = normalized.get("selling_price")
        if mrp is not None and sp is not None and sp > mrp:
            conflicts.append(
                DataBridgeConflict(
                    conflict_code="SMRITI-VAL-PRICE-INVARIANT",
                    message=f"Selling price ({sp}) cannot exceed MRP ({mrp}).",
                    severity="BLOCK",
                )
            )

        return conflicts, warnings

    async def resolve_parent_item(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[Item]:
        """Resolves parent item style by item_code or style_code."""
        parent_code = (normalized.get("item_code") or normalized.get("style_code") or "").strip().upper()
        if not parent_code:
            return None

        stmt = select(Item).where(
            Item.company_id == company_id,
            or_(
                Item.item_code == parent_code,
                Item.style_code == parent_code,
            ),
            Item.is_deleted == False,
        )
        return (await session.execute(stmt)).scalars().first()

    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[ItemVariant]:
        """
        Variant matching hierarchy (company scoped):
        1. variant_sku
        2. parent item_id + color + size
        """
        sku = (normalized.get("variant_sku") or "").strip().upper()
        if sku:
            stmt = select(ItemVariant).where(
                ItemVariant.company_id == company_id,
                ItemVariant.variant_sku == sku,
                ItemVariant.is_deleted == False,
            ).options(
                selectinload(ItemVariant.barcodes),
                selectinload(ItemVariant.price_setting),
                selectinload(ItemVariant.uom_setting),
            )
            var = (await session.execute(stmt)).scalars().first()
            if var:
                return var

        # Match by parent + color + size
        parent = await self.resolve_parent_item(normalized, session, company_id)
        color = (normalized.get("color") or "").strip().upper()
        size = (normalized.get("size") or "").strip().upper()

        if parent and color and size:
            stmt = select(ItemVariant).where(
                ItemVariant.company_id == company_id,
                ItemVariant.item_id == parent.id,
                ItemVariant.color == color,
                ItemVariant.size == size,
                ItemVariant.is_deleted == False,
            ).options(
                selectinload(ItemVariant.barcodes),
                selectinload(ItemVariant.price_setting),
                selectinload(ItemVariant.uom_setting),
            )
            var = (await session.execute(stmt)).scalars().first()
            if var:
                return var

        return None

    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[ItemVariant],
    ) -> DataBridgeDiff:
        """Diffs variant pricing and dimensions."""
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

        str_fields = [
            ("color", existing.color, normalized.get("color")),
            ("size", existing.size, normalized.get("size")),
            ("hsn_code", existing.hsn_code, normalized.get("hsn_code")),
        ]
        for fname, old_val, new_val in str_fields:
            if new_val is not None and str(new_val).strip() != "":
                if str(old_val or "").strip().upper() != str(new_val).strip().upper():
                    diff.fields[fname] = DataBridgeDiffField(
                        old_value=old_val,
                        new_value=new_val,
                        is_different=True,
                    )

        return diff

    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[ItemVariant],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        if any(c.conflict_code == "SMRITI-DEP-PARENT-MISSING" for c in conflicts):
            return DataBridgeClassification.DEPENDENCY_ERROR

        for c in conflicts:
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
        """Previews variant batch without mutating DB."""
        result_items: List[DataBridgeResultItem] = []
        blocking_reasons: List[str] = []
        seen_skus: Set[str] = set()

        for idx, raw_row in enumerate(rows, start=1):
            norm = self.normalize(raw_row, idx)
            conflicts, warnings = await self.validate(norm, session, company_id, idx)

            parent = await self.resolve_parent_item(norm, session, company_id)
            if not parent:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-DEP-PARENT-MISSING",
                        message=f"Parent item '{norm.get('item_code') or norm.get('style_code')}' does not exist in catalog.",
                        severity="BLOCK",
                    )
                )

            # Derive candidate SKU
            color = (norm.get("color") or "").strip().upper().replace(" ", "")
            size = (norm.get("size") or "").strip().upper().replace(" ", "")
            p_code = parent.item_code if parent else (norm.get("item_code") or "SKU")
            target_sku = norm.get("variant_sku") or (f"{p_code}-{color}-{size}" if (color and size) else f"{p_code}-VAR-{idx}")
            target_sku = target_sku.strip().upper()

            if target_sku in seen_skus:
                conflicts.append(
                    DataBridgeConflict(
                        conflict_code="SMRITI-VAL-DUP-ROW",
                        message=f"Duplicate variant SKU '{target_sku}' in same import file.",
                        severity="BLOCK",
                    )
                )
            seen_skus.add(target_sku)

            existing = await self.match(norm, session, company_id)
            d = self.diff(norm, existing)
            classification = self.classify(norm, existing, d, conflicts)

            for c in conflicts:
                if c.severity == "BLOCK":
                    blocking_reasons.append(f"Row {idx} [{target_sku}]: {c.message}")

            result_items.append(
                DataBridgeResultItem(
                    row_index=idx,
                    record_id=existing.id if existing else None,
                    entity_type="VARIANT",
                    classification=classification,
                    target_identifier=target_sku,
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
        """Atomically persists variant batch and synchronizes 6 child policy entities."""
        preview_items, blocking = await self.preview(rows, session, company_id, branch_id)
        if blocking:
            raise DataBridgeValidationError(f"Cannot commit Variant batch: {'; '.join(blocking)}")

        committed_count = 0
        final_items: List[DataBridgeResultItem] = []

        for item_res, raw_row in zip(preview_items, rows):
            norm = self.normalize(raw_row, item_res.row_index)
            if item_res.classification == DataBridgeClassification.NO_CHANGE:
                final_items.append(item_res)
                continue

            parent = await self.resolve_parent_item(norm, session, company_id)
            if not parent:
                raise DataBridgeDependencyError(f"Parent item '{norm.get('item_code')}' missing during commit.")

            color = (norm.get("color") or "").strip().upper()
            size = (norm.get("size") or "").strip().upper()
            target_sku = item_res.target_identifier

            if item_res.classification == DataBridgeClassification.CREATE:
                v_name = norm.get("variant_name") or (f"{parent.item_name} ({color} {size})" if (color and size) else (parent.item_name or target_sku))
                new_var = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    item_id=parent.id,
                    variant_sku=target_sku,
                    variant_name=v_name,
                    color=color or None,
                    size=size or None,
                    hsn_code=norm.get("hsn_code") or parent.hsn_code,
                    tax_rate=Decimal(str(norm.get("tax_rate", parent.tax_rate or 18.0))),
                    mrp=Decimal(str(norm.get("mrp", parent.mrp or 0.0))),
                    selling_price=Decimal(str(norm.get("selling_price", parent.selling_price or 0.0))),
                    cost_price=Decimal(str(norm.get("cost_price", parent.cost_price or 0.0))),
                    is_active=True,
                    is_deleted=False,
                )

                session.add(new_var)
                await session.flush()

                # Synchronize 6 child policies anchored 1-to-1 to variant
                raw_uom = (norm.get("primary_uom") or getattr(parent, "primary_uom", None) or "PRS").strip()
                stock_uom_ref = "uom_prs"
                uom_stmt = select(UnitOfMeasurementRef.id).where(
                    or_(
                        UnitOfMeasurementRef.id == raw_uom,
                        func.upper(UnitOfMeasurementRef.code) == raw_uom.upper(),
                    )
                )
                uom_res = (await session.execute(uom_stmt)).scalars().first()
                if uom_res:
                    stock_uom_ref = uom_res
                elif "pair" in raw_uom.lower() or "prs" in raw_uom.lower():
                    stock_uom_ref = "uom_prs"
                elif "pc" in raw_uom.lower():
                    stock_uom_ref = "uom_pcs"

                uom_setting = ItemUOMSetting(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    stock_uom_id=stock_uom_ref,
                    conversion_factor=Decimal("1.0"),
                )
                price_setting = ItemPrice(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    cost_price=new_var.cost_price,
                    selling_price=new_var.selling_price,
                    mrp=new_var.mrp,
                    is_active=True,
                )
                tax_profile = ItemTaxProfile(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    hsn_sac_code=new_var.hsn_code,
                    gst_rate=new_var.tax_rate,
                    tax_inclusive=True,
                )
                sales_setting = ItemSalesSetting(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    selling_price=new_var.selling_price,
                    mrp=new_var.mrp,
                    billable=True,
                )
                supplier_setting = ItemSupplierSetting(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    is_active=True,
                )
                inv_policy = ItemInventoryPolicy(
                    item_variant_id=new_var.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    minimum_stock=Decimal("0.0"),
                    reorder_level=Decimal("0.0"),
                    reorder_quantity=Decimal("0.0"),
                    maximum_stock=Decimal("0.0"),
                    safety_stock=Decimal("0.0"),
                    lead_time=0,
                )
                session.add_all([uom_setting, price_setting, tax_profile, sales_setting, supplier_setting, inv_policy])

                # Barcode if present in variant row
                bc = (norm.get("barcode") or "").strip().upper()
                if bc:
                    new_bc = ItemBarcode(
                        id=f"ibc_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        branch_id=branch_id,
                        item_id=parent.id,
                        variant_id=new_var.id,
                        barcode=bc,
                        barcode_type="EAN13",
                        is_primary=True,
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(new_bc)

                await session.flush()
                committed_count += 1
                item_res.record_id = new_var.id
                final_items.append(item_res)

            elif item_res.classification == DataBridgeClassification.UPDATE:
                existing = await self.match(norm, session, company_id)
                if existing:
                    if "mrp" in norm and norm["mrp"] is not None:
                        existing.mrp = Decimal(str(norm["mrp"]))
                    if "selling_price" in norm and norm["selling_price"] is not None:
                        existing.selling_price = Decimal(str(norm["selling_price"]))
                    if "cost_price" in norm and norm["cost_price"] is not None:
                        existing.cost_price = Decimal(str(norm["cost_price"]))
                    if "tax_rate" in norm and norm["tax_rate"] is not None:
                        existing.tax_rate = Decimal(str(norm["tax_rate"]))
                    if norm.get("hsn_code"):
                        existing.hsn_code = norm["hsn_code"]
                    await session.flush()
                    committed_count += 1
                final_items.append(item_res)

        return final_items, committed_count
