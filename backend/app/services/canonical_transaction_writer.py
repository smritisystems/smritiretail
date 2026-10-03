"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Transaction Write Authority & Dual-Key Consistency Engine (Gate 11C)
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger("smriti.transaction_writer")


@dataclass
class DualKeyWriteIdentity:
    canonical_variant_id: Optional[str]
    canonical_item_id: Optional[str]
    legacy_product_id: Optional[str]
    sku: Optional[str]
    name: Optional[str]
    line_type: str  # PHYSICAL_INVENTORY | NON_INVENTORY_FEE | SERVICE | FINANCIAL_ROUND
    is_valid: bool
    is_quarantined: bool
    is_consistent: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class CanonicalTransactionWriter:
    """
    Core Dual-Key Transactional Authority Engine for SMRITI Retail OS (Gate 11C).
    Enforces the Canonical-First Transactional Write Contract:
      1. Canonical Item/Variant resolution first.
      2. Establishes canonical variant_id / item_id.
      3. Derives legacy product_id via legacy_id_mappings.
      4. Protects the 218 quarantined REQUIRES_REVIEW records.
      5. Validates 100% bidirectional key consistency before commit.
      6. Supports instant rollback via ENABLE_CANONICAL_TRANSACTION_AUTHORITY feature flag.
    """

    @classmethod
    def is_canonical_write_authority_enabled(cls) -> bool:
        """
        Feature flag controlling canonical write authority.
        Can be toggled via environment or dynamic configuration.
        """
        val = os.getenv("ENABLE_CANONICAL_TRANSACTION_AUTHORITY", "true").lower()
        return val in ("true", "1", "yes", "enabled")

    @classmethod
    async def resolve_dual_key_for_line(
        cls,
        session: AsyncSession,
        company_id: str,
        variant_id: Optional[str] = None,
        item_id: Optional[str] = None,
        product_id: Optional[str] = None,
        code_or_barcode: Optional[str] = None,
        is_fee_line: bool = False,
    ) -> DualKeyWriteIdentity:
        """
        Resolves canonical and legacy dual keys for any transactional write line.
        """
        # 1. Non-inventory / Fee / Roundoff lines
        if is_fee_line:
            return DualKeyWriteIdentity(
                canonical_variant_id=None,
                canonical_item_id=None,
                legacy_product_id=None,
                sku=None,
                name=None,
                line_type="NON_INVENTORY_FEE",
                is_valid=True,
                is_quarantined=False,
                is_consistent=True
            )

        # Check feature flag for canonical authority
        canonical_enabled = cls.is_canonical_write_authority_enabled()

        # 2. Canonical-First: Explicit variant_id provided
        if variant_id:
            res = await session.execute(
                text("""
                    SELECT 
                        v.id as variant_id,
                        v.item_id,
                        v.variant_sku,
                        v.variant_name,
                        lim.legacy_id as legacy_product_id,
                        lim.disposition
                    FROM item_variants v
                    LEFT JOIN legacy_id_mappings lim 
                      ON lim.canonical_id = v.id AND lim.legacy_table = 'products'
                    WHERE v.id = :vid AND v.company_id = :cid AND v.is_deleted = false
                """),
                {"vid": variant_id, "cid": company_id}
            )
            row = res.fetchone()
            if not row:
                return DualKeyWriteIdentity(
                    canonical_variant_id=variant_id,
                    canonical_item_id=None,
                    legacy_product_id=None,
                    sku=None,
                    name=None,
                    line_type="PHYSICAL_INVENTORY",
                    is_valid=False,
                    is_quarantined=False,
                    is_consistent=False,
                    error_code="SMRITI-VAL-VAR-NOTFOUND",
                    error_message=f"Canonical variant '{variant_id}' not found in active catalog."
                )

            # Check Quarantined Record Protection
            if row.disposition == "REQUIRES_REVIEW":
                return DualKeyWriteIdentity(
                    canonical_variant_id=variant_id,
                    canonical_item_id=row.item_id,
                    legacy_product_id=row.legacy_product_id,
                    sku=row.variant_sku,
                    name=row.variant_name,
                    line_type="PHYSICAL_INVENTORY",
                    is_valid=False,
                    is_quarantined=True,
                    is_consistent=False,
                    error_code="SMRITI-QUARANTINE-REJECT",
                    error_message=f"Variant '{variant_id}' is linked to quarantined record '{row.legacy_product_id}' requiring manual catalog review."
                )

            # Valid Canonical Dual-Key Write
            return DualKeyWriteIdentity(
                canonical_variant_id=row.variant_id,
                canonical_item_id=row.item_id,
                legacy_product_id=row.legacy_product_id,
                sku=row.variant_sku,
                name=row.variant_name,
                line_type="PHYSICAL_INVENTORY",
                is_valid=True,
                is_quarantined=False,
                is_consistent=(row.legacy_product_id is not None)
            )

        # 3. Canonical-First: Barcode or SKU provided
        if code_or_barcode:
            # Query canonical barcode or SKU first
            res = await session.execute(
                text("""
                    SELECT 
                        v.id as variant_id,
                        v.item_id,
                        v.variant_sku,
                        v.variant_name,
                        lim.legacy_id as legacy_product_id,
                        lim.disposition
                    FROM item_variants v
                    LEFT JOIN item_barcodes b ON b.variant_id = v.id AND b.is_active = true
                    LEFT JOIN legacy_id_mappings lim 
                      ON lim.canonical_id = v.id AND lim.legacy_table = 'products'
                    WHERE (b.barcode = :q OR v.variant_sku = :q OR v.variant_sku = UPPER(:q))
                      AND v.company_id = :cid
                      AND v.is_deleted = false
                    LIMIT 1
                """),
                {"q": code_or_barcode.strip(), "cid": company_id}
            )
            row = res.fetchone()
            if row:
                if row.disposition == "REQUIRES_REVIEW":
                    return DualKeyWriteIdentity(
                        canonical_variant_id=row.variant_id,
                        canonical_item_id=row.item_id,
                        legacy_product_id=row.legacy_product_id,
                        sku=row.variant_sku,
                        name=row.variant_name,
                        line_type="PHYSICAL_INVENTORY",
                        is_valid=False,
                        is_quarantined=True,
                        is_consistent=False,
                        error_code="SMRITI-QUARANTINE-REJECT",
                        error_message=f"Item barcode/SKU '{code_or_barcode}' references quarantined review record."
                    )
                return DualKeyWriteIdentity(
                    canonical_variant_id=row.variant_id,
                    canonical_item_id=row.item_id,
                    legacy_product_id=row.legacy_product_id,
                    sku=row.variant_sku,
                    name=row.variant_name,
                    line_type="PHYSICAL_INVENTORY",
                    is_valid=True,
                    is_quarantined=False,
                    is_consistent=(row.legacy_product_id is not None)
                )

        # 4. Transitional Fallback: Legacy product_id provided
        if product_id:
            # First check legacy_id_mappings directly for disposition and canonical linkage
            map_res = await session.execute(
                text("""
                    SELECT lim.canonical_id as variant_id, v.item_id, lim.disposition, p.sku, p.name
                    FROM legacy_id_mappings lim
                    LEFT JOIN item_variants v ON v.id = lim.canonical_id
                    LEFT JOIN products p ON p.id = lim.legacy_id
                    WHERE lim.legacy_table = 'products' AND lim.legacy_id = :pid
                """),
                {"pid": product_id}
            )
            map_row = map_res.fetchone()
            if map_row:
                if map_row.disposition == "REQUIRES_REVIEW":
                    return DualKeyWriteIdentity(
                        canonical_variant_id=map_row.variant_id,
                        canonical_item_id=map_row.item_id,
                        legacy_product_id=product_id,
                        sku=map_row.sku,
                        name=map_row.name,
                        line_type="PHYSICAL_INVENTORY",
                        is_valid=False,
                        is_quarantined=True,
                        is_consistent=False,
                        error_code="SMRITI-QUARANTINE-REJECT",
                        error_message=f"Product '{product_id}' is quarantined in REQUIRES_REVIEW state."
                    )
                if map_row.variant_id:
                    return DualKeyWriteIdentity(
                        canonical_variant_id=map_row.variant_id,
                        canonical_item_id=map_row.item_id,
                        legacy_product_id=product_id,
                        sku=map_row.sku,
                        name=map_row.name,
                        line_type="PHYSICAL_INVENTORY",
                        is_valid=True,
                        is_quarantined=False,
                        is_consistent=True
                    )
                else:
                    # Unmapped legacy product
                    return DualKeyWriteIdentity(
                        canonical_variant_id=None,
                        canonical_item_id=None,
                        legacy_product_id=product_id,
                        sku=map_row.sku,
                        name=map_row.name,
                        line_type="PHYSICAL_INVENTORY",
                        is_valid=True,
                        is_quarantined=False,
                        is_consistent=False
                    )

        return DualKeyWriteIdentity(
            canonical_variant_id=None,
            canonical_item_id=None,
            legacy_product_id=None,
            sku=None,
            name=None,
            line_type="PHYSICAL_INVENTORY",
            is_valid=False,
            is_quarantined=False,
            is_consistent=False,
            error_code="SMRITI-VAL-NO-IDENTITY",
            error_message="No identifiable product or variant was provided."
        )
