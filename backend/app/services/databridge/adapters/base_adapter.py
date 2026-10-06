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
Classification: Internal — DataBridge Adapter Layer
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_BASE_ADAPTER", role="CANONICAL")

import abc
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    DataBridgeClassification,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeResultItem,
)


class BaseDataBridgeAdapter(abc.ABC):
    """
    Abstract contract for all SMRITI DataBridge domain adapters.
    Defines the standardized 7-stage lifecycle:
    normalize() -> validate() -> match() -> diff() -> classify() -> preview() -> commit()
    """

    # Canonical alias dictionary mirroring HeaderAliasRegistry.ts & IM001 extraction map
    CANONICAL_HEADER_MAP: Dict[str, List[str]] = {
        "item_code": [
            "sku", "sku code", "item code", "item no", "item number", "item id",
            "product code", "product no", "product number", "style code", "style no",
            "article code", "article no", "article number", "article", "style article code",
            "style/article code", "article_code", "item_code", "style_code", "article_no",
        ],
        "item_name": [
            "item", "item name", "item description", "product", "product name",
            "product description", "description", "item_name", "product_name",
        ],
        "barcode": [
            "barcode", "barcode no", "barcode number", "barcode code", "ean",
            "ean code", "ean13", "ean 13", "upc", "upc code", "primary_barcode",
        ],
        "brand": [
            "brand", "brand name", "manufacturer", "make", "label", "brand_name",
        ],
        "category": [
            "category", "category name", "product category", "item category",
            "group", "merchandise category", "merchandise_category",
        ],
        "department": [
            "department", "dept", "merchandise department", "merchandise_department",
        ],
        "color": [
            "color", "colour", "shade",
        ],
        "size": [
            "size",
        ],
        "gender": [
            "gender", "gndr",
        ],
        "primary_uom": [
            "uom", "primary_uom", "unit", "unit of measure", "stock uom",
        ],
        "hsn_code": [
            "hsn", "hsn code", "hsn_code", "hsn/sac",
        ],
        "tax_rate": [
            "tax", "tax rate", "tax_rate", "gst", "gst rate", "gst_rate", "gst %", "tax %", "gst_rate_percent",
        ],
        "mrp": [
            "mrp", "max retail price", "maximum retail price",
        ],
        "selling_price": [
            "selling price", "selling_price", "rate", "price", "sp", "sales price", "selling rate",
        ],
        "cost_price": [
            "cost", "cost price", "cost_price", "cp", "purchase rate", "purchase price", "buying price",
        ],
        "variant_sku": [
            "variant_sku", "variant sku", "child sku", "variant_code", "sku_variant",
        ],
        "price_book_code": [
            "price_book_code", "pricebook", "pricebook code", "price list", "price_list",
        ],
        "min_quantity": [
            "min_quantity", "min qty", "minimum quantity", "tier quantity", "qty break",
        ],
        "collection_type": [
            "collection_type", "collection", "season",
        ],
        "product_type": [
            "product_type", "product type",
        ],
        "heel_type": [
            "heel_type", "heel type",
        ],
        "upper_material": [
            "upper_material", "upper material",
        ],
        "outsole_material": [
            "outsole_material", "outsole material",
        ],
    }

    @classmethod
    def clean_header_key(cls, key: str) -> str:
        """Removes special characters and normalizes whitespace/underscores for alias matching."""
        if not key:
            return ""
        k = str(key).strip().lower()
        k = re.sub(r"[_\-\s/]+", " ", k).strip()
        return k

    @classmethod
    def normalize_row_headers(cls, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Maps incoming raw column headers to canonical dictionary keys."""
        normalized: Dict[str, Any] = {}
        matched_canonical: set = set()

        # Step 1: Exact matches against raw keys
        for raw_k, raw_v in raw.items():
            if raw_v is None:
                continue
            clean_raw = cls.clean_header_key(raw_k)
            matched = False
            for canon_key, aliases in cls.CANONICAL_HEADER_MAP.items():
                if canon_key in matched_canonical:
                    continue
                clean_aliases = [cls.clean_header_key(a) for a in aliases]
                if clean_raw in clean_aliases or clean_raw == cls.clean_header_key(canon_key):
                    normalized[canon_key] = raw_v
                    matched_canonical.add(canon_key)
                    matched = True
                    break
            if not matched:
                # Keep original key in lower_case
                normalized[str(raw_k).strip().lower()] = raw_v

        return normalized

    @abc.abstractmethod
    def normalize(self, raw: Dict[str, Any], row_index: int) -> Dict[str, Any]:
        """Normalize raw heterogeneous row into canonical schema parameters."""
        pass

    @abc.abstractmethod
    async def validate(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
        row_index: int,
    ) -> Tuple[List[DataBridgeConflict], List[str]]:
        """Validate normalized payload against canonical rules without mutating database."""
        pass

    @abc.abstractmethod
    async def match(
        self,
        normalized: Dict[str, Any],
        session: AsyncSession,
        company_id: str,
    ) -> Optional[Any]:
        """Query database to find existing candidate record."""
        pass

    @abc.abstractmethod
    def diff(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Any],
    ) -> DataBridgeDiff:
        """Calculate attribute-level diff between incoming and database state."""
        pass

    @abc.abstractmethod
    def classify(
        self,
        normalized: Dict[str, Any],
        existing: Optional[Any],
        diff: DataBridgeDiff,
        conflicts: List[DataBridgeConflict],
    ) -> DataBridgeClassification:
        """Classify row status under the 6-state taxonomy."""
        pass

    @abc.abstractmethod
    async def preview(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
    ) -> Tuple[List[DataBridgeResultItem], List[str]]:
        """Execute read-only preview and conflict classification."""
        pass

    @abc.abstractmethod
    async def commit(
        self,
        rows: List[Dict[str, Any]],
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        actor_id: str = "SYSTEM",
    ) -> Tuple[List[DataBridgeResultItem], int]:
        """Atomically persist changes using canonical domain services."""
        pass
