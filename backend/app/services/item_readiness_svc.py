"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Domain Service
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
from enum import Enum


class ItemReadinessStatus(str, Enum):
    DRAFT = "DRAFT"
    INCOMPLETE = "INCOMPLETE"
    READY_FOR_SALE = "READY_FOR_SALE"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class ItemReadinessEngine:
    """
    Centralized Item Master Readiness Engine.
    Evaluates whether an ItemVariant fulfills all commercial, statutory, UOM,
    pricing, and identity requirements to be sold.
    
    Produces structured blocking reasons explaining exactly WHY an item cannot be sold.
    """

    @classmethod
    def evaluate(
        cls,
        variant_data: Dict[str, Any],
        parent_item: Optional[Dict[str, Any]] = None,
        require_barcode: bool = False,
    ) -> Dict[str, Any]:
        """
        Evaluates readiness from dictionary or serialized ORM representation.
        
        variant_data may contain:
          - sku / variant_sku
          - color, size
          - uom (dict or stock_uom_id)
          - pricing (dict or selling_price, mrp, etc.)
          - tax (dict or hsn_sac_code, gst_rate, etc.)
          - barcodes (list)
          - is_active, status
        """
        blocking_reasons: List[Dict[str, str]] = []
        parent = parent_item or {}

        # ── 1. Identity Checks ────────────────────────────────────────────────
        product_name = (
            parent.get("item_name")
            or parent.get("name")
            or variant_data.get("variant_name")
            or variant_data.get("item_name")
        )
        if not product_name or not str(product_name).strip():
            blocking_reasons.append({
                "field": "product_name",
                "message": "Product Name is required before this item can be sold."
            })

        brand = parent.get("brand") or variant_data.get("brand")
        if not brand or not str(brand).strip():
            blocking_reasons.append({
                "field": "brand",
                "message": "Brand is required before this item can be sold."
            })

        category = parent.get("category") or variant_data.get("category")
        if not category or not str(category).strip():
            blocking_reasons.append({
                "field": "category",
                "message": "Category is required before this item can be sold."
            })

        color = variant_data.get("color") or parent.get("color")
        if not color or not str(color).strip():
            blocking_reasons.append({
                "field": "color",
                "message": "Colour is required before this item can be sold."
            })

        size = variant_data.get("size") or parent.get("size")
        if not size or not str(size).strip():
            blocking_reasons.append({
                "field": "size",
                "message": "Size is required before this item can be sold."
            })

        sku = variant_data.get("sku") or variant_data.get("variant_sku")
        if not sku or not str(sku).strip():
            blocking_reasons.append({
                "field": "sku",
                "message": "SKU / Item Code is required before this item can be sold."
            })

        # ── 2. Units of Measure (UOM) ─────────────────────────────────────────
        uom_info = variant_data.get("uom") or {}
        stock_uom_id = (
            uom_info.get("stock_uom_id")
            or uom_info.get("code")
            or variant_data.get("stock_uom_id")
            or parent.get("primary_uom")
            or parent.get("uom")
        )
        if not stock_uom_id or not str(stock_uom_id).strip():
            blocking_reasons.append({
                "field": "stock_uom",
                "message": "Stock UOM is required before this item can be sold."
            })

        # ── 3. Commercial Pricing ─────────────────────────────────────────────
        pricing = variant_data.get("pricing") or {}
        raw_sp = (
            pricing.get("selling_price")
            if "selling_price" in pricing
            else variant_data.get("selling_price")
        )
        try:
            sp = Decimal(str(raw_sp)) if raw_sp is not None else None
        except Exception:
            sp = None

        if sp is None or sp <= Decimal("0.00"):
            blocking_reasons.append({
                "field": "selling_price",
                "message": "Selling Price must be greater than 0 before this item can be sold."
            })

        raw_mrp = (
            pricing.get("mrp")
            if "mrp" in pricing
            else variant_data.get("mrp")
        )
        try:
            mrp = Decimal(str(raw_mrp)) if raw_mrp is not None else None
        except Exception:
            mrp = None

        if mrp is not None and sp is not None and sp > Decimal("0.00"):
            if mrp < sp:
                blocking_reasons.append({
                    "field": "mrp",
                    "message": "MRP cannot be less than Selling Price."
                })

        raw_msp = pricing.get("minimum_selling_price") or variant_data.get("minimum_selling_price")
        if raw_msp is not None and sp is not None:
            try:
                msp = Decimal(str(raw_msp))
                if msp > sp:
                    blocking_reasons.append({
                        "field": "minimum_selling_price",
                        "message": "Minimum Selling Price cannot exceed Selling Price."
                    })
            except Exception:
                pass

        raw_max_disc = pricing.get("maximum_discount_percent") or variant_data.get("maximum_discount_percent")
        if raw_max_disc is not None:
            try:
                max_disc = Decimal(str(raw_max_disc))
                if max_disc < Decimal("0.00") or max_disc > Decimal("100.00"):
                    blocking_reasons.append({
                        "field": "maximum_discount_percent",
                        "message": "Maximum Discount % must be between 0 and 100."
                    })
            except Exception:
                pass

        # ── 4. Statutory Tax Profile ──────────────────────────────────────────
        tax = variant_data.get("tax") or {}
        hsn = (
            tax.get("hsn_sac_code")
            or tax.get("hsn_code")
            or variant_data.get("hsn_code")
            or parent.get("hsn_code")
            or parent.get("hsn_sac_code")
        )
        hsn_str = str(hsn).strip() if hsn is not None else ""
        if not hsn_str or hsn_str == "0000":
            blocking_reasons.append({
                "field": "hsn_sac_code",
                "message": "A valid statutory HSN/SAC code is required before this item can be sold."
            })

        raw_gst = (
            tax.get("gst_rate")
            if "gst_rate" in tax
            else (
                tax.get("tax_rate")
                if "tax_rate" in tax
                else (
                    variant_data.get("tax_rate")
                    if "tax_rate" in variant_data
                    else parent.get("tax_rate")
                )
            )
        )
        is_tax_exempt = bool(tax.get("tax_exempt", False))
        if not is_tax_exempt:
            try:
                gst = Decimal(str(raw_gst)) if raw_gst is not None else None
            except Exception:
                gst = None

            if gst is None or gst < Decimal("0.00"):
                blocking_reasons.append({
                    "field": "gst_rate",
                    "message": "Statutory GST rate configuration is required before this item can be sold."
                })

        # ── 5. Barcode Check (Policy-governed) ─────────────────────────────────
        if require_barcode:
            barcodes = variant_data.get("barcodes") or []
            has_active_primary = any(
                b.get("is_primary") and b.get("status") != "RETIRED" and not b.get("is_deleted")
                for b in barcodes
            )
            if not has_active_primary:
                blocking_reasons.append({
                    "field": "barcode",
                    "message": "An active primary barcode is required before this item can be sold."
                })

        # ── 6. Determine Lifecycle Status ─────────────────────────────────────
        explicit_status = (
            variant_data.get("status")
            or parent.get("status")
            or ("ACTIVE" if variant_data.get("is_active", True) else "INACTIVE")
        )
        explicit_upper = str(explicit_status).upper()

        if explicit_upper == "ARCHIVED":
            final_status = ItemReadinessStatus.ARCHIVED.value
            ready_for_sale = False
        elif explicit_upper == "INACTIVE" or variant_data.get("is_active") is False:
            final_status = ItemReadinessStatus.INACTIVE.value
            ready_for_sale = False
        elif explicit_upper == "DRAFT":
            if blocking_reasons:
                final_status = ItemReadinessStatus.DRAFT.value
                ready_for_sale = False
            else:
                final_status = ItemReadinessStatus.READY_FOR_SALE.value
                ready_for_sale = True
        else:
            if blocking_reasons:
                final_status = ItemReadinessStatus.INCOMPLETE.value
                ready_for_sale = False
            else:
                final_status = (
                    ItemReadinessStatus.ACTIVE.value
                    if explicit_upper == "ACTIVE"
                    else ItemReadinessStatus.READY_FOR_SALE.value
                )
                ready_for_sale = True

        return {
            "status": final_status,
            "ready_for_sale": ready_for_sale,
            "blocking_reasons": blocking_reasons,
        }

    @classmethod
    def evaluate_orm_variant(
        cls,
        variant: Any,
        require_barcode: bool = False,
    ) -> Dict[str, Any]:
        """
        Evaluates an ItemVariant SQLAlchemy model with its relationships.
        """
        parent_dict = {}
        if hasattr(variant, "item") and variant.item:
            parent_dict = {
                "item_name": getattr(variant.item, "item_name", None),
                "brand": getattr(variant.item, "brand", None),
                "category": getattr(variant.item, "category", None),
                "primary_uom": getattr(variant.item, "primary_uom", None),
                "uom": getattr(variant.item, "uom", None),
                "hsn_code": getattr(variant.item, "hsn_code", None),
                "hsn_sac_code": getattr(variant.item, "hsn_sac_code", None),
                "tax_rate": getattr(variant.item, "tax_rate", None),
                "status": getattr(variant.item, "status", None),
            }

        v_dict: Dict[str, Any] = {
            "variant_sku": getattr(variant, "variant_sku", None),
            "sku": getattr(variant, "variant_sku", None),
            "variant_name": getattr(variant, "variant_name", None),
            "color": getattr(variant, "color", None),
            "size": getattr(variant, "size", None),
            "is_active": getattr(variant, "is_active", True),
            "selling_price": getattr(variant, "selling_price", None),
            "mrp": getattr(variant, "mrp", None),
            "cost_price": getattr(variant, "cost_price", None),
            "hsn_code": getattr(variant, "hsn_code", None),
            "tax_rate": getattr(variant, "tax_rate", None),
        }

        # UOM
        if hasattr(variant, "uom_setting") and variant.uom_setting:
            v_dict["uom"] = {
                "stock_uom_id": variant.uom_setting.stock_uom_id,
                "sales_uom_id": variant.uom_setting.sales_uom_id,
                "purchase_uom_id": variant.uom_setting.purchase_uom_id,
                "conversion_factor": variant.uom_setting.conversion_factor,
            }

        # Pricing
        if hasattr(variant, "price_setting") and variant.price_setting:
            v_dict["pricing"] = {
                "cost_price": variant.price_setting.cost_price,
                "selling_price": variant.price_setting.selling_price,
                "mrp": variant.price_setting.mrp,
                "dealer_price": variant.price_setting.dealer_price,
                "wholesale_price": variant.price_setting.wholesale_price,
                "minimum_selling_price": variant.price_setting.minimum_selling_price,
                "maximum_discount_percent": variant.price_setting.maximum_discount_percent,
                "currency": variant.price_setting.currency,
                "effective_from": variant.price_setting.effective_from,
                "effective_to": variant.price_setting.effective_to,
                "is_active": variant.price_setting.is_active,
            }

        # Tax
        if hasattr(variant, "tax_profile") and variant.tax_profile:
            v_dict["tax"] = {
                "hsn_sac_code": variant.tax_profile.hsn_sac_code,
                "tax_category": variant.tax_profile.tax_category,
                "gst_rate": variant.tax_profile.gst_rate,
                "tax_inclusive": variant.tax_profile.tax_inclusive,
                "sales_tax_rate": variant.tax_profile.sales_tax_rate,
                "purchase_tax_rate": variant.tax_profile.purchase_tax_rate,
                "tax_exempt": variant.tax_profile.tax_exempt,
            }

        # Barcodes
        if hasattr(variant, "barcodes") and variant.barcodes:
            v_dict["barcodes"] = [
                {
                    "barcode": b.barcode,
                    "barcode_type": b.barcode_type,
                    "is_primary": b.is_primary,
                    "status": b.status,
                    "is_deleted": b.is_deleted,
                }
                for b in variant.barcodes
            ]

        return cls.evaluate(
            variant_data=v_dict,
            parent_item=parent_dict,
            require_barcode=require_barcode,
        )
