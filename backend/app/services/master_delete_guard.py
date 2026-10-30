"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, or_, select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.master_lookup import MasterValue
from ..models.item_master import Item, ItemVariant, ItemBarcode
from ..models.inventory import Product
from ..models.attributes import AttributeDefinition, AttributeGroup, VariantTemplate, CategoryAttributeGroupMapping
from ..models.size_groups import SizeGroup, SizeGroupValue
from .catalog_validation import CatalogDimensionValidator

logger = logging.getLogger(__name__)


class MasterValueDeleteGuard:
    """
    Hard delete safety guard for Master Registry and lookup values.
    
    Prevents deletion (both hard and soft delete) of any master value if it is
    referenced by active Item Master records, SKUs, variants, barcodes, variant templates,
    child lookup values, or attribute mappings.
    """

    @classmethod
    def _collect_targets(cls, item: MasterValue) -> List[str]:
        """Return non-empty code and name values to check for active references."""
        targets = []
        if getattr(item, "code", None):
            code_str = str(item.code).strip()
            if code_str:
                targets.append(code_str)
        if getattr(item, "name", None):
            name_str = str(item.name).strip()
            if name_str and name_str.lower() not in [t.lower() for t in targets]:
                targets.append(name_str)
        return targets

    @classmethod
    async def check_references(
        cls,
        db: AsyncSession,
        item: MasterValue,
        type_code: str,
        company_id: Optional[str] = None,
        max_records_per_entity: int = 10,
    ) -> Optional[Dict[str, Any]]:
        """
        Scan all catalog and registry entities for references to this lookup value.
        Returns a structured blocker dict if references exist, otherwise None.
        """
        targets = cls._collect_targets(item)
        if not targets:
            return None

        normalized_type = CatalogDimensionValidator.resolve_type_code(type_code)
        target_lowers = [t.lower() for t in targets]
        linked_records: List[Dict[str, Any]] = []

        # 1. Check Child Master Values
        try:
            q_child = select(MasterValue.id, MasterValue.code, MasterValue.name).where(
                MasterValue.parent_value_id == item.id,
                MasterValue.is_deleted.is_(False),
            ).limit(max_records_per_entity)
            res_child = await db.execute(q_child)
            for row in res_child.all():
                linked_records.append({
                    "entity_type": "Child Master Value",
                    "identifier": row.code,
                    "name": row.name,
                    "field": "parent_value_id",
                    "matched_value": str(item.id),
                    "company_id": getattr(row, "company_id", None),
                })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking child master values: {exc}")

        # 2. Check Vendor-assigned Master Values
        if normalized_type in ("vendor_code", "vendor"):
            try:
                q_vendor_vals = select(MasterValue.id, MasterValue.code, MasterValue.name).where(
                    func.lower(MasterValue.vendor_code).in_(target_lowers),
                    MasterValue.id != item.id,
                    MasterValue.is_deleted.is_(False),
                ).limit(max_records_per_entity)
                res_vendor_vals = await db.execute(q_vendor_vals)
                for row in res_vendor_vals.all():
                    linked_records.append({
                        "entity_type": "Vendor Master Value",
                        "identifier": row.code,
                        "name": row.name,
                        "field": "vendor_code",
                        "matched_value": item.code,
                        "company_id": getattr(row, "company_id", None),
                    })
            except Exception as exc:
                logger.warning(f"[DeleteGuard] Error checking vendor-linked master values: {exc}")

        # 3. Check Variant Templates
        try:
            template_clauses = [
                VariantTemplate.master_value_id == item.id,
            ]
            if normalized_type in ("style_article", "style", "style_code", "article"):
                template_clauses.append(func.lower(VariantTemplate.style_code).in_(target_lowers))
            if normalized_type in ("vendor_code", "vendor"):
                template_clauses.append(func.lower(VariantTemplate.vendor_code).in_(target_lowers))
            if normalized_type == "brand":
                template_clauses.append(func.lower(VariantTemplate.brand).in_(target_lowers))
            if normalized_type == "category":
                template_clauses.append(func.lower(VariantTemplate.category).in_(target_lowers))
            if normalized_type in ("hsn_code", "hsn"):
                template_clauses.append(func.lower(VariantTemplate.hsn_code).in_(target_lowers))

            q_template = select(
                VariantTemplate.id,
                VariantTemplate.style_code,
                VariantTemplate.name,
                VariantTemplate.brand,
                VariantTemplate.category,
            ).where(
                or_(*template_clauses),
                VariantTemplate.is_deleted.is_(False),
            ).limit(max_records_per_entity)
            res_template = await db.execute(q_template)
            for row in res_template.all():
                linked_records.append({
                    "entity_type": "Variant Template",
                    "identifier": row.style_code or row.id,
                    "name": row.name,
                    "field": normalized_type,
                    "matched_value": item.code,
                    "company_id": getattr(row, "company_id", None),
                })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking variant templates: {exc}")

        # 4. Check Universal Item Master (items table)
        try:
            item_field_map = {
                "brand": Item.brand,
                "category": Item.category,
                "department": Item.department,
                "gender": Item.gender,
                "product_type": Item.product_type,
                "heel_type": Item.heel_type,
                "upper_material": Item.upper_material,
                "outsole_material": Item.outsole_material,
                "collection_type": Item.collection_type,
                "purchase_class": Item.purchase_class,
                "style_article": Item.style_code,
                "vendor_code": Item.vendor_code,
                "color": Item.color,
                "size": Item.size,
            }

            item_clauses = []
            if normalized_type in item_field_map:
                col = item_field_map[normalized_type]
                item_clauses.append(func.lower(col).in_(target_lowers))
            elif normalized_type in ("hsn_code", "hsn"):
                item_clauses.append(or_(
                    func.lower(Item.hsn_code).in_(target_lowers),
                    func.lower(Item.hsn_sac_code).in_(target_lowers),
                ))
            elif normalized_type in ("uom", "primary_uom"):
                item_clauses.append(or_(
                    func.lower(Item.primary_uom).in_(target_lowers),
                    func.lower(Item.uom).in_(target_lowers),
                ))

            # Also check Item.attributes_json for custom attribute values
            for t in targets:
                clean_t = t.replace("%", "").replace("_", "")
                if clean_t:
                    item_clauses.append(cast(Item.attributes_json, String).ilike(f'%"{clean_t}"%'))

            if item_clauses:
                q_items = select(
                    Item.id,
                    Item.item_code,
                    Item.item_name,
                    Item.company_id,
                ).where(
                    or_(*item_clauses),
                    Item.is_deleted.is_(False),
                )
                if getattr(item, "company_id", None):
                    q_items = q_items.where(Item.company_id == item.company_id)
                q_items = q_items.limit(max_records_per_entity)

                res_items = await db.execute(q_items)
                for row in res_items.all():
                    linked_records.append({
                        "entity_type": "Item Master",
                        "identifier": row.item_code,
                        "name": row.item_name,
                        "field": normalized_type,
                        "matched_value": item.code,
                        "company_id": row.company_id,
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking Item Master references: {exc}")

        # 5. Check Universal Item Variants / SKUs (item_variants table)
        try:
            variant_clauses = []
            if normalized_type in ("color", "colour", "shade"):
                variant_clauses.append(func.lower(ItemVariant.color).in_(target_lowers))
            if normalized_type in ("size", "sizes"):
                variant_clauses.append(func.lower(ItemVariant.size).in_(target_lowers))
            if normalized_type in ("hsn_code", "hsn"):
                variant_clauses.append(func.lower(ItemVariant.hsn_code).in_(target_lowers))
            if normalized_type in ("sku", "variant_sku"):
                variant_clauses.append(func.lower(ItemVariant.variant_sku).in_(target_lowers))

            # Dynamic variant attributes_json check
            for t in targets:
                clean_t = t.replace("%", "").replace("_", "")
                if clean_t:
                    variant_clauses.append(cast(ItemVariant.attributes_json, String).ilike(f'%"{clean_t}"%'))

            if variant_clauses:
                q_variants = select(
                    ItemVariant.id,
                    ItemVariant.variant_sku,
                    ItemVariant.variant_name,
                    ItemVariant.company_id,
                ).where(
                    or_(*variant_clauses),
                    ItemVariant.is_deleted.is_(False),
                )
                if getattr(item, "company_id", None):
                    q_variants = q_variants.where(ItemVariant.company_id == item.company_id)
                q_variants = q_variants.limit(max_records_per_entity)

                res_variants = await db.execute(q_variants)
                for row in res_variants.all():
                    linked_records.append({
                        "entity_type": "Item Variant (SKU)",
                        "identifier": row.variant_sku,
                        "name": row.variant_name,
                        "field": normalized_type,
                        "matched_value": item.code,
                        "company_id": row.company_id,
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking ItemVariant references: {exc}")

        # 6. Check Universal Barcodes (item_barcodes table)
        try:
            if normalized_type in ("barcode", "barcodes", "ean"):
                q_barcodes = select(
                    ItemBarcode.id,
                    ItemBarcode.barcode,
                    ItemBarcode.item_id,
                    ItemBarcode.company_id,
                ).where(
                    func.lower(ItemBarcode.barcode).in_(target_lowers),
                    ItemBarcode.is_deleted.is_(False),
                ).limit(max_records_per_entity)

                res_barcodes = await db.execute(q_barcodes)
                for row in res_barcodes.all():
                    linked_records.append({
                        "entity_type": "Item Barcode",
                        "identifier": row.barcode,
                        "name": f"Barcode for Item {row.item_id}",
                        "field": "barcode",
                        "matched_value": row.barcode,
                        "company_id": row.company_id,
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking ItemBarcode references: {exc}")

        # 7. Check Legacy Catalog Products (products table)
        try:
            prod_field_map = {
                "brand": Product.brand,
                "category": Product.category,
                "department": Product.department,
                "product_type": Product.product_type,
                "style_article": Product.style_code,
                "vendor_code": Product.vendor_code,
                "color": Product.color,
                "size": Product.size,
                "barcode": Product.barcode,
                "hsn_code": Product.hsn_code,
                "sku": Product.sku,
            }
            prod_clauses = []
            if normalized_type in prod_field_map:
                col = prod_field_map[normalized_type]
                prod_clauses.append(func.lower(col).in_(target_lowers))

            # Dynamic product attributes check
            for t in targets:
                clean_t = t.replace("%", "").replace("_", "")
                if clean_t:
                    prod_clauses.append(cast(Product.attributes, String).ilike(f'%"{clean_t}"%'))

            if prod_clauses:
                q_products = select(
                    Product.id,
                    Product.code,
                    Product.name,
                    Product.company_id,
                ).where(
                    or_(*prod_clauses),
                    Product.is_deleted.is_(False),
                ).limit(max_records_per_entity)

                res_products = await db.execute(q_products)
                for row in res_products.all():
                    linked_records.append({
                        "entity_type": "Product (Catalog)",
                        "identifier": row.code,
                        "name": row.name,
                        "field": normalized_type,
                        "matched_value": item.code,
                        "company_id": getattr(row, "company_id", None),
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking Product references: {exc}")

        # 8. Check Size Groups and Size Group Values
        try:
            if normalized_type == "category":
                q_size_groups = select(SizeGroup.id, SizeGroup.code, SizeGroup.name).where(
                    func.lower(SizeGroup.category).in_(target_lowers),
                    SizeGroup.is_deleted.is_(False),
                ).limit(max_records_per_entity)
                res_sg = await db.execute(q_size_groups)
                for row in res_sg.all():
                    linked_records.append({
                        "entity_type": "Size Group",
                        "identifier": row.code,
                        "name": row.name,
                        "field": "category",
                        "matched_value": row.code,
                        "company_id": None,
                    })

            if normalized_type in ("size", "sizes"):
                q_sgv = select(SizeGroupValue.id, SizeGroupValue.value, SizeGroupValue.size_group_id).where(
                    func.lower(SizeGroupValue.value).in_(target_lowers),
                    SizeGroupValue.is_deleted.is_(False),
                ).limit(max_records_per_entity)
                res_sgv = await db.execute(q_sgv)
                for row in res_sgv.all():
                    linked_records.append({
                        "entity_type": "Size Group Value",
                        "identifier": row.value,
                        "name": f"Size in Group {row.size_group_id}",
                        "field": "value",
                        "matched_value": row.value,
                        "company_id": None,
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking SizeGroup references: {exc}")

        # 9. Check Category Attribute Group Mappings
        if normalized_type == "category":
            try:
                q_cagm = select(
                    CategoryAttributeGroupMapping.id,
                    CategoryAttributeGroupMapping.category,
                ).where(
                    func.lower(CategoryAttributeGroupMapping.category).in_(target_lowers),
                    CategoryAttributeGroupMapping.is_deleted.is_(False),
                ).limit(max_records_per_entity)
                res_cagm = await db.execute(q_cagm)
                for row in res_cagm.all():
                    linked_records.append({
                        "entity_type": "Category Attribute Mapping",
                        "identifier": row.id,
                        "name": row.category,
                        "field": "category",
                        "matched_value": row.category,
                        "company_id": None,
                    })
            except Exception as exc:
                logger.warning(f"[DeleteGuard] Error checking CategoryAttributeGroupMapping: {exc}")

        # 10. Check Sales Orders and Sales Order Items (transaction history)
        try:
            from ..models.sales import SalesOrder, SalesOrderItem
            if normalized_type in ("style_article", "style", "style_code", "article"):
                q_so_items = select(SalesOrderItem.id, SalesOrderItem.article_no, SalesOrderItem.vendor_style).where(
                    or_(
                        func.lower(SalesOrderItem.article_no).in_(target_lowers),
                        func.lower(SalesOrderItem.vendor_style).in_(target_lowers),
                    )
                ).limit(max_records_per_entity)
                res_so_items = await db.execute(q_so_items)
                for row in res_so_items.all():
                    linked_records.append({
                        "entity_type": "Sales Order Item",
                        "identifier": row.article_no or str(row.id),
                        "name": f"Sales Item {row.vendor_style or row.article_no}",
                        "field": "article_no",
                        "matched_value": item.code,
                        "company_id": None,
                    })

            if normalized_type in ("vendor_code", "vendor"):
                q_so = select(SalesOrder.id, SalesOrder.order_number, SalesOrder.vendor_code).where(
                    func.lower(SalesOrder.vendor_code).in_(target_lowers)
                ).limit(max_records_per_entity)
                res_so = await db.execute(q_so)
                for row in res_so.all():
                    linked_records.append({
                        "entity_type": "Sales Order",
                        "identifier": row.order_number or str(row.id),
                        "name": f"Order {row.order_number}",
                        "field": "vendor_code",
                        "matched_value": row.vendor_code,
                        "company_id": None,
                    })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking Sales Order references: {exc}")

        if not linked_records:
            return None

        total_references = len(linked_records)
        label = CatalogDimensionValidator.get_dimension_label(normalized_type)
        display_val = item.name or item.code

        return {
            "can_delete": False,
            "code": "SMRITI-VAL-003",
            "message": (
                f"Cannot delete {label} '{display_val}': this value is still in use by "
                f"{total_references} Item Master / SKU / master registry reference(s)."
            ),
            "detail": (
                f"Cannot delete {label} '{display_val}': this value is still in use by "
                f"{total_references} Item Master / SKU / master registry reference(s)."
            ),
            "reason": "Active references exist in Item Master, Variants, Barcodes, or Master Mappings.",
            "total_references": total_references,
            "linked_records": linked_records[:25],
            "suggested_action": (
                "Remove, reassign, or retire the linked Item Master, SKU, barcode, "
                "or template records before deleting this master value."
            ),
        }

    @classmethod
    async def check_size_group_references(
        cls,
        db: AsyncSession,
        group_id: str,
        group_code: Optional[str] = None,
        group_name: Optional[str] = None,
        group_values: Optional[List[str]] = None,
        company_id: Optional[str] = None,
        max_records_per_entity: int = 10,
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a SizeGroup or any of its size values are referenced in active data.
        """
        linked_records: List[Dict[str, Any]] = []

        # 1. Check Attribute Groups using this SizeGroup
        try:
            q_attr_groups = select(AttributeGroup.id, AttributeGroup.name).where(
                AttributeGroup.size_group_id == group_id,
                AttributeGroup.is_deleted.is_(False),
            ).limit(max_records_per_entity)
            res_ag = await db.execute(q_attr_groups)
            for row in res_ag.all():
                linked_records.append({
                    "entity_type": "Attribute Group",
                    "identifier": row.id,
                    "name": row.name,
                    "field": "size_group_id",
                    "matched_value": group_id,
                    "company_id": None,
                })
        except Exception as exc:
            logger.warning(f"[DeleteGuard] Error checking AttributeGroup size_group_id: {exc}")

        # 2. Check Size values against ItemVariant, Item, and Product
        if group_values:
            val_lowers = [str(v).strip().lower() for v in group_values if str(v).strip()]
            if val_lowers:
                # Check ItemVariant
                try:
                    q_variants = select(
                        ItemVariant.id,
                        ItemVariant.variant_sku,
                        ItemVariant.variant_name,
                        ItemVariant.company_id,
                    ).where(
                        func.lower(ItemVariant.size).in_(val_lowers),
                        ItemVariant.is_deleted.is_(False),
                    ).limit(max_records_per_entity)
                    res_var = await db.execute(q_variants)
                    for row in res_var.all():
                        linked_records.append({
                            "entity_type": "Item Variant (SKU)",
                            "identifier": row.variant_sku,
                            "name": row.variant_name,
                            "field": "size",
                            "matched_value": group_code or group_id,
                            "company_id": row.company_id,
                        })
                except Exception as exc:
                    logger.warning(f"[DeleteGuard] Error checking ItemVariant size: {exc}")

                # Check Item
                try:
                    q_items = select(
                        Item.id,
                        Item.item_code,
                        Item.item_name,
                        Item.company_id,
                    ).where(
                        func.lower(Item.size).in_(val_lowers),
                        Item.is_deleted.is_(False),
                    ).limit(max_records_per_entity)
                    res_items = await db.execute(q_items)
                    for row in res_items.all():
                        linked_records.append({
                            "entity_type": "Item Master",
                            "identifier": row.item_code,
                            "name": row.item_name,
                            "field": "size",
                            "matched_value": group_code or group_id,
                            "company_id": row.company_id,
                        })
                except Exception as exc:
                    logger.warning(f"[DeleteGuard] Error checking Item size: {exc}")

                # Check Product
                try:
                    q_products = select(
                        Product.id,
                        Product.code,
                        Product.name,
                        Product.company_id,
                    ).where(
                        func.lower(Product.size).in_(val_lowers),
                        Product.is_deleted.is_(False),
                    ).limit(max_records_per_entity)
                    res_prod = await db.execute(q_products)
                    for row in res_prod.all():
                        linked_records.append({
                            "entity_type": "Product (Catalog)",
                            "identifier": row.code,
                            "name": row.name,
                            "field": "size",
                            "matched_value": group_code or group_id,
                            "company_id": getattr(row, "company_id", None),
                        })
                except Exception as exc:
                    logger.warning(f"[DeleteGuard] Error checking Product size: {exc}")

        if not linked_records:
            return None

        total_references = len(linked_records)
        display_name = group_name or group_code or group_id

        return {
            "can_delete": False,
            "code": "SMRITI-VAL-003",
            "message": (
                f"Cannot delete Size Group '{display_name}': this group or its size values are "
                f"still in use by {total_references} Item Master / SKU / Attribute Group reference(s)."
            ),
            "detail": (
                f"Cannot delete Size Group '{display_name}': this group or its size values are "
                f"still in use by {total_references} Item Master / SKU / Attribute Group reference(s)."
            ),
            "reason": "Active references exist in Attribute Groups, Item Master, or Item Variants.",
            "total_references": total_references,
            "linked_records": linked_records[:25],
            "suggested_action": (
                "Remove or reassign size references in Item Master, Variants, and "
                "Attribute Groups before deleting this size group."
            ),
        }
