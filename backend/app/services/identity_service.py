"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import hashlib
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.product_identity import ProductIdentity, BarcodeProvider, IdentityRule

logger = logging.getLogger("smriti.identity_service")


class ProductIdentityService:
    """
    Service for calculating SKU business key, Mod-10 EAN-13 barcode assignment, and fingerprint resolution.
    """

    @staticmethod
    def validate_gs1_company_prefix(prefix: Optional[str]) -> Optional[str]:
        """
        Validates GS1 Company Prefix. Must be 6-11 numeric digits if configured.
        """
        if not prefix or not str(prefix).strip():
            return None
        clean = str(prefix).strip()
        if not clean.isdigit():
            raise ValueError(f"Invalid GS1 Company Prefix '{prefix}': must contain only numeric digits.")
        if not (6 <= len(clean) <= 11):
            raise ValueError(f"Invalid GS1 Company Prefix '{prefix}': length must be between 6 and 11 digits.")
        return clean

    @staticmethod
    def calculate_ean13_check_digit(number_12_digits: str) -> str:
        """
        Calculates official GS1 EAN-13 Mod-10 check digit for a 12-digit string.
        Formula: Sum odd positions * 1 + even positions * 3, check = (10 - (sum % 10)) % 10.
        """
        if len(number_12_digits) != 12 or not number_12_digits.isdigit():
            raise ValueError(f"EAN-13 payload must be exactly 12 numeric digits, got '{number_12_digits}'")
        
        sum_odd = sum(int(number_12_digits[i]) for i in range(0, 12, 2))
        sum_even = sum(int(number_12_digits[i]) for i in range(1, 12, 2))
        
        total = (sum_odd * 3) + sum_even
        remainder = total % 10
        check_digit = (10 - remainder) % 10
        return str(check_digit)

    @staticmethod
    def generate_ean13_barcode(gs1_company_prefix: Optional[str] = None, seq_num: int = 1) -> str:
        """
        Generates official EAN-13 barcode.
        If gs1_company_prefix is set, constructs official GS1 EAN-13 using the company prefix.
        If gs1_company_prefix is None, issues restricted-circulation internal EAN-13 starting with prefix '200'.
        """
        clean_prefix = ProductIdentityService.validate_gs1_company_prefix(gs1_company_prefix)
        if clean_prefix:
            needed_digits = 12 - len(clean_prefix)
            seq_part = f"{(seq_num % (10 ** needed_digits)):0{needed_digits}d}" if needed_digits > 0 else ""
            payload_12 = f"{clean_prefix}{seq_part}"[:12]
        else:
            # GS1 Restricted Circulation Range (200-299) for internal retail numbering
            payload_12 = f"200{(seq_num % 1000000000):09d}"

        check_digit = ProductIdentityService.calculate_ean13_check_digit(payload_12)
        return f"{payload_12}{check_digit}"

    async def get_next_barcode_sequence(self, db: AsyncSession, company_id: Optional[str] = None) -> int:
        """
        Fetches and atomically increments the tenant's barcode sequence counter.
        """
        if not company_id:
            return (uuid.uuid4().int % 1000000) + 1
        from app.models.tenant import Company
        stmt = select(Company).where(Company.id == company_id).with_for_update()
        res = await db.execute(stmt)
        comp = res.scalars().first()
        if comp:
            comp.barcode_counter = (comp.barcode_counter or 0) + 1
            await db.flush()
            return comp.barcode_counter
        return (uuid.uuid4().int % 1000000) + 1

    @staticmethod
    def generate_fingerprint_hash(name: str, category: str, brand: str) -> str:
        """
        Generates canonical SHA-256 fingerprint hash for product attributes.
        """
        raw = f"{name.strip().lower()}|{category.strip().lower()}|{brand.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def generate_sku_business_key(
        self,
        category: str,
        brand: str,
        sequence_num: int,
    ) -> str:
        """
        Formats structured SKU business key.
        """
        cat_prefix = (category or "GEN")[:3].upper()
        brand_prefix = (brand or "GEN")[:3].upper()
        return f"SKU-{cat_prefix}-{brand_prefix}-{sequence_num:05d}"

    async def assign_gs1_barcode(
        self,
        db: AsyncSession,
        product_id: str,
        sku_business_key: str,
        name: str,
        category: str,
        brand: str,
        gs1_company_prefix: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> ProductIdentity:
        """
        Generates EAN-13 barcode, creates canonical ProductIdentity record, and persists to database.
        """
        fingerprint = self.generate_fingerprint_hash(name, category, brand)
        seq_num = await self.get_next_barcode_sequence(db, company_id)
        ean13_barcode = self.generate_ean13_barcode(gs1_company_prefix, seq_num)

        identity = ProductIdentity(
            id=str(uuid.uuid4()),
            product_id=product_id,
            business_key=sku_business_key,
            fingerprint=fingerprint,
            barcode=ean13_barcode,
            state="Available",
        )
        db.add(identity)
        await db.commit()
        return identity

    async def simulate_identity_rules(
        self,
        payload_items: list[dict[str, Any]],
        pattern_template: str = "{category}-{brand}-{seq:04d}",
    ) -> dict[str, Any]:
        """
        Simulates identity rule expression across an item list, assessing SKU generation patterns and collision rates.
        """
        generated_keys = []
        conflicts = 0
        seen_keys = set()

        for idx, item in enumerate(payload_items, start=1):
            cat = (item.get("category") or "GEN")[:3].upper()
            br = (item.get("brand") or "GEN")[:3].upper()
            key = f"SKU-{cat}-{br}-{idx:05d}"
            
            if key in seen_keys:
                conflicts += 1
            else:
                seen_keys.add(key)
            generated_keys.append({"item_name": item.get("name"), "simulated_sku": key})

        total = len(payload_items)
        conflict_rate = (conflicts / total * 100.0) if total > 0 else 0.0

        return {
            "total_items": total,
            "unique_keys_generated": len(seen_keys),
            "collisions_detected": conflicts,
            "conflict_rate_percent": conflict_rate,
            "samples": generated_keys[:10],
        }

    async def generate_variant_skus(
        self,
        db: AsyncSession,
        parent_product_id: str,
        parent_sku: str,
        variants: list[dict[str, str]],
        gs1_company_prefix: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Generates child variant SKUs and assigned EAN-13 barcodes for matrix dimensions (e.g. Size, Color).
        """
        created_variants = []
        for idx, var in enumerate(variants, start=1):
            size = var.get("size", "").upper()
            color = var.get("color", "").upper()
            
            attr_part = f"-{color}" if color else ""
            attr_part += f"-{size}" if size else ""
            if not attr_part:
                attr_part = f"-VAR{idx:02d}"

            child_sku = f"{parent_sku}{attr_part}"
            
            seq_num = await self.get_next_barcode_sequence(db, company_id)
            child_barcode = self.generate_ean13_barcode(gs1_company_prefix, seq_num)

            created_variants.append({
                "parent_product_id": parent_product_id,
                "variant_sku": child_sku,
                "barcode": child_barcode,
                "attributes": var,
            })
        return created_variants

    @staticmethod
    def calculate_duplicate_confidence(
        item_a: dict[str, Any],
        item_b: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Computes attribute similarity confidence score (0.00 - 1.00) between two product master items.
        """
        import difflib

        name_a = item_a.get("name", "").lower()
        name_b = item_b.get("name", "").lower()
        cat_a = item_a.get("category", "").lower()
        cat_b = item_b.get("category", "").lower()

        name_sim = difflib.SequenceMatcher(None, name_a, name_b).ratio()
        cat_sim = 1.0 if cat_a == cat_b else 0.5

        overall_score = (name_sim * 0.7) + (cat_sim * 0.3)
        overall_score = round(overall_score, 2)

        if overall_score >= 0.95:
            classification = "DUPLICATE_EXACT"
        elif overall_score >= 0.75:
            classification = "HIGH_PROBABILITY"
        else:
            classification = "UNIQUE"

        return {
            "confidence_score": overall_score,
            "classification": classification,
            "name_similarity": round(name_sim, 2),
            "category_match": cat_a == cat_b,
        }

