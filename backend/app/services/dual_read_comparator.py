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
Classification: Dual-Read Comparison & Verification Engine (Gate 6)
"""

from typing import Dict, Any, Optional, Tuple
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class DualReadComparator:
    """
    Read-Only Dual-Read Comparison Engine.
    Executes parallel lookups across legacy products and canonical Item/Variant/Pricing domains
    without modifying live production traffic or altering data authorities.
    """

    @classmethod
    async def compare_by_barcode(
        cls,
        session: AsyncSession,
        company_id: str,
        barcode: str
    ) -> Dict[str, Any]:
        if not company_id or not str(company_id).strip():
            raise ValueError("Multi-tenant security violation: company_id is mandatory")
        clean_bc = str(barcode).strip()

        # 1. Legacy Product Read
        res_leg = await session.execute(
            text("""
                SELECT 
                    id, code, sku, name, barcode, secondary_barcodes,
                    brand, category, category_code, style_code, color, size,
                    mrp, price, cost_price, hsn_code, gst_percentage,
                    is_active, is_deleted
                FROM products
                WHERE (barcode = :bc OR :bc = ANY(secondary_barcodes))
                  AND company_id = :cid
                  AND is_deleted = false
                LIMIT 1
            """),
            {"bc": clean_bc, "cid": company_id}
        )
        leg_row = res_leg.fetchone()
        legacy_data = dict(leg_row._mapping) if leg_row else None

        # 2. Canonical Domain Read (Item -> Variant -> Barcode -> PriceBookEntry)
        res_can = await session.execute(
            text("""
                SELECT 
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.hsn_code,
                    i.tax_rate,
                    i.status as item_status,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.attributes_json,
                    v.is_active as variant_is_active,
                    ib.barcode,
                    ib.barcode_type,
                    ib.is_primary,
                    pbe.selling_price,
                    pbe.mrp,
                    pbe.cost_price,
                    m.disposition as lineage_disposition,
                    m.legacy_id
                FROM item_barcodes ib
                JOIN item_variants v ON ib.variant_id = v.id
                JOIN items i ON v.item_id = i.id
                LEFT JOIN price_book_entries pbe ON pbe.variant_id = v.id AND pbe.is_deleted = false
                LEFT JOIN legacy_id_mappings m ON m.canonical_id = v.id AND m.legacy_table = 'products'
                WHERE ib.barcode = :bc
                  AND ib.company_id = :cid
                  AND ib.is_deleted = false
                LIMIT 1
            """),
            {"bc": clean_bc, "cid": company_id}
        )
        can_row = res_can.fetchone()
        canonical_data = dict(can_row._mapping) if can_row else None

        # 3. Perform Field-by-Field Semantic Comparison
        comparison = {
            "barcode": clean_bc,
            "legacy_found": legacy_data is not None,
            "canonical_found": canonical_data is not None,
            "matches": {},
            "divergences": [],
            "status": "MATCH"
        }

        if not legacy_data and not canonical_data:
            comparison["status"] = "NOT_FOUND_BOTH"
            return comparison
        elif not legacy_data or not canonical_data:
            comparison["status"] = "PRESENCE_DIVERGENCE"
            comparison["divergences"].append(
                f"Presence mismatch: legacy_found={legacy_data is not None}, canonical_found={canonical_data is not None}"
            )
            return comparison

        # Compare Variant SKU (products.code vs item_variants.variant_sku)
        leg_sku = legacy_data.get("code") or legacy_data.get("sku")
        can_sku = canonical_data.get("variant_sku")
        sku_match = (leg_sku == can_sku)
        comparison["matches"]["sku"] = sku_match
        if not sku_match:
            comparison["divergences"].append(f"SKU mismatch: legacy='{leg_sku}' vs canonical='{can_sku}'")

        # Compare Parent Identity (products.style_code vs items.item_code)
        leg_style = legacy_data.get("style_code")
        can_item_code = canonical_data.get("item_code")
        if leg_style:
            style_match = (leg_style == can_item_code)
            comparison["matches"]["style"] = style_match
            if not style_match:
                comparison["divergences"].append(f"Style mismatch: legacy='{leg_style}' vs canonical='{can_item_code}'")
        else:
            # Unassigned parent style: Must have REQUIRES_REVIEW disposition
            comparison["matches"]["style_unassigned"] = canonical_data.get("lineage_disposition") == "REQUIRES_REVIEW"

        # Compare Authoritative Pricing (products.price/mrp vs price_book_entries.selling_price/mrp)
        leg_price = Decimal(str(legacy_data.get("price") or 0.00))
        can_price = Decimal(str(canonical_data.get("selling_price") or 0.00))
        price_match = (leg_price == can_price)
        comparison["matches"]["selling_price"] = price_match
        if not price_match:
            comparison["divergences"].append(f"Price mismatch: legacy={leg_price} vs canonical={can_price}")

        leg_mrp = Decimal(str(legacy_data.get("mrp") or 0.00))
        can_mrp = Decimal(str(canonical_data.get("mrp") or 0.00))
        mrp_match = (leg_mrp == can_mrp)
        comparison["matches"]["mrp"] = mrp_match
        if not mrp_match:
            comparison["divergences"].append(f"MRP mismatch: legacy={leg_mrp} vs canonical={can_mrp}")

        # Compare Tax Rate
        leg_tax = Decimal(str(legacy_data.get("gst_percentage") or 0.00))
        can_tax = Decimal(str(canonical_data.get("tax_rate") or 0.00))
        tax_match = (leg_tax == can_tax)
        comparison["matches"]["tax_rate"] = tax_match
        if not tax_match:
            comparison["divergences"].append(f"Tax mismatch: legacy={leg_tax} vs canonical={can_tax}")

        if comparison["divergences"]:
            comparison["status"] = "DIVERGENCE"
        else:
            comparison["status"] = "MATCH"

        return comparison
