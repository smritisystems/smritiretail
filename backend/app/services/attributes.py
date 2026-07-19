"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from fastapi import HTTPException

from ..models.attributes import (
    AttributeDefinition, AttributeGroup, VariantTemplate, CategoryAttributeGroupMapping
)
from ..models.inventory import Product


class AttributesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_definitions(self) -> list[AttributeDefinition]:
        q = select(AttributeDefinition).where(AttributeDefinition.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def create_definition(self, data, creator: str) -> AttributeDefinition:
        new_id = f"attr-{data.name.lower().replace(' ', '')}-{uuid.uuid4().hex[:4]}"
        
        # Serialize valid values
        vals_str = json.dumps(data.validValues) if data.validValues is not None else None

        defn = AttributeDefinition(
            id=new_id,
            name=data.name,
            label=data.label,
            data_type=data.dataType,
            is_variant_dimension=data.isVariantDimension or False,
            is_mandatory=data.isMandatory or False,
            valid_values=vals_str,
            group_id=data.groupId,
            is_searchable=data.isSearchable if data.isSearchable is not None else True,
            is_filterable=data.isFilterable if data.isFilterable is not None else True,
            is_printable=data.isPrintable if data.isPrintable is not None else True,
            is_barcode_enabled=data.isBarcodeEnabled if data.isBarcodeEnabled is not None else True,
            display_order=data.displayOrder if data.displayOrder is not None else 0,
            default_value=data.defaultValue,
            tooltip=data.tooltip,
            validation_rules=data.validationRules,
            is_enabled=data.isEnabled if data.isEnabled is not None else True,
            multi_lang_labels=data.multiLangLabels if data.multiLangLabels is not None else {},
            created_by=creator,
            updated_by=creator
        )
        self.db.add(defn)
        await self.db.commit()
        await self.db.refresh(defn)
        return defn

    async def update_definition(self, id: str, data, updater: str) -> AttributeDefinition:
        defn = await self.db.get(AttributeDefinition, id)
        if not defn or defn.is_deleted:
            raise HTTPException(status_code=404, detail="Attribute definition not found")

        if data.name is not None: defn.name = data.name
        if data.label is not None: defn.label = data.label
        if data.dataType is not None: defn.data_type = data.dataType
        if data.isVariantDimension is not None: defn.is_variant_dimension = data.isVariantDimension
        if data.isMandatory is not None: defn.is_mandatory = data.isMandatory
        if data.validValues is not None: defn.valid_values = json.dumps(data.validValues)
        if data.groupId is not None: defn.group_id = data.groupId
        
        # Extended fields update
        if data.isSearchable is not None: defn.is_searchable = data.isSearchable
        if data.isFilterable is not None: defn.is_filterable = data.isFilterable
        if data.isPrintable is not None: defn.is_printable = data.isPrintable
        if data.isBarcodeEnabled is not None: defn.is_barcode_enabled = data.isBarcodeEnabled
        if data.displayOrder is not None: defn.display_order = data.displayOrder
        if data.defaultValue is not None: defn.default_value = data.defaultValue
        if data.tooltip is not None: defn.tooltip = data.tooltip
        if data.validationRules is not None: defn.validation_rules = data.validationRules
        if data.isEnabled is not None: defn.is_enabled = data.isEnabled
        if data.multiLangLabels is not None: defn.multi_lang_labels = data.multiLangLabels
        
        defn.updated_by = updater
        defn.modified_at = datetime.now(timezone.utc)


        await self.db.commit()
        await self.db.refresh(defn)
        return defn

    async def delete_definition(self, id: str, operator: str) -> None:
        defn = await self.db.get(AttributeDefinition, id)
        if not defn or defn.is_deleted:
            raise HTTPException(status_code=404, detail="Attribute definition not found")
        defn.is_deleted = True
        defn.is_active = False
        defn.deleted_at = datetime.now(timezone.utc)
        defn.deleted_by = operator
        await self.db.commit()

    async def list_groups(self) -> list[AttributeGroup]:
        q = select(AttributeGroup).where(AttributeGroup.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def create_group(self, data, creator: str) -> AttributeGroup:
        new_id = f"grp-{data.name.lower().replace(' ', '')}-{uuid.uuid4().hex[:4]}"
        group = AttributeGroup(
            id=new_id,
            name=data.name,
            attribute_ids=json.dumps(data.attributeIds),
            grid_column_attribute_id=data.gridColumnAttributeId,
            grid_row_attribute_id=data.gridRowAttributeId,
            created_by=creator,
            updated_by=creator
        )
        self.db.add(group)
        await self.db.commit()
        await self.db.refresh(group)
        return group

    async def update_group(self, id: str, data, updater: str) -> AttributeGroup:
        group = await self.db.get(AttributeGroup, id)
        if not group or group.is_deleted:
            raise HTTPException(status_code=404, detail="Attribute group not found")

        if data.name is not None: group.name = data.name
        if data.attributeIds is not None: group.attribute_ids = json.dumps(data.attributeIds)
        if data.gridColumnAttributeId is not None: group.grid_column_attribute_id = data.gridColumnAttributeId
        if data.gridRowAttributeId is not None: group.grid_row_attribute_id = data.gridRowAttributeId
        group.updated_by = updater
        group.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(group)
        return group

    async def delete_group(self, id: str, operator: str) -> None:
        group = await self.db.get(AttributeGroup, id)
        if not group or group.is_deleted:
            raise HTTPException(status_code=404, detail="Attribute group not found")
        group.is_deleted = True
        group.is_active = False
        group.deleted_at = datetime.now(timezone.utc)
        group.deleted_by = operator
        await self.db.commit()

    async def list_templates(self) -> list[VariantTemplate]:
        q = select(VariantTemplate).where(VariantTemplate.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def create_template(self, data, creator: str) -> VariantTemplate:
        # Check if style code exists
        q = select(VariantTemplate).where(
            VariantTemplate.style_code == data.styleCode,
            VariantTemplate.is_deleted == False
        )
        existing = (await self.db.execute(q)).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Template Style Code '{data.styleCode}' already exists.")

        new_id = f"vt-{uuid.uuid4().hex[:8]}"
        template = VariantTemplate(
            id=new_id,
            style_code=data.styleCode,
            name=data.name,
            brand=data.brand or "SMRITI",
            category=data.category or "General",
            hsn_code=data.hsnCode or "61091000",
            base_price=int(data.basePrice or 0),
            base_mrp=int(data.baseMrp or 0),
            gst_percentage=int(data.gstPercentage or 18),
            attribute_group_id=data.attributeGroupId,
            pricing_mode=data.pricingMode or "Fixed",
            tracking_mode=data.trackingMode or "Standard",
            created_by=creator,
            updated_by=creator
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def update_template(self, id: str, data, updater: str) -> VariantTemplate:
        template = await self.db.get(VariantTemplate, id)
        if not template or template.is_deleted:
            raise HTTPException(status_code=404, detail="Variant template not found")

        if data.styleCode is not None: template.style_code = data.styleCode
        if data.name is not None: template.name = data.name
        if data.brand is not None: template.brand = data.brand
        if data.category is not None: template.category = data.category
        if data.hsnCode is not None: template.hsn_code = data.hsnCode
        if data.basePrice is not None: template.base_price = int(data.basePrice)
        if data.baseMrp is not None: template.base_mrp = int(data.baseMrp)
        if data.gstPercentage is not None: template.gst_percentage = int(data.gstPercentage)
        if data.attributeGroupId is not None: template.attribute_group_id = data.attributeGroupId
        if data.pricingMode is not None: template.pricing_mode = data.pricingMode
        if data.trackingMode is not None: template.tracking_mode = data.trackingMode
        template.updated_by = updater
        template.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete_template(self, id: str, operator: str) -> None:
        template = await self.db.get(VariantTemplate, id)
        if not template or template.is_deleted:
            raise HTTPException(status_code=404, detail="Variant template not found")
        template.is_deleted = True
        template.is_active = False
        template.deleted_at = datetime.now(timezone.utc)
        template.deleted_by = operator
        await self.db.commit()

    async def list_category_mappings(self) -> list[CategoryAttributeGroupMapping]:
        q = select(CategoryAttributeGroupMapping).where(CategoryAttributeGroupMapping.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def save_category_mapping(self, category: str, attribute_group_id: str, creator: str) -> CategoryAttributeGroupMapping:
        q = select(CategoryAttributeGroupMapping).where(
            CategoryAttributeGroupMapping.category == category,
            CategoryAttributeGroupMapping.is_deleted == False
        )
        res = await self.db.execute(q)
        existing = res.scalars().first()

        if existing:
            existing.attribute_group_id = attribute_group_id
            existing.updated_by = creator
            existing.modified_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        new_id = f"map-{uuid.uuid4().hex[:8]}"
        mapping = CategoryAttributeGroupMapping(
            id=new_id,
            category=category,
            attribute_group_id=attribute_group_id,
            created_by=creator,
            updated_by=creator
        )
        self.db.add(mapping)
        await self.db.commit()
        await self.db.refresh(mapping)
        return mapping

    async def load_industry_template(self, industry: str, operator: str) -> dict:
        templates = {
            "footwear": {
                "group_name": "Footwear Standard",
                "category": "Footwear",
                "attributes": [
                    {"name": "article_no", "label": "Article No", "data_type": "text", "is_variant_dimension": True, "is_mandatory": True, "display_order": 1, "is_searchable": True},
                    {"name": "color", "label": "Color", "data_type": "select", "valid_values": ["Black", "White", "Brown", "Red", "Blue"], "is_variant_dimension": True, "display_order": 2, "is_searchable": True},
                    {"name": "size", "label": "Size", "data_type": "select", "valid_values": ["6", "7", "8", "9", "10", "11"], "is_variant_dimension": True, "display_order": 3, "is_searchable": True},
                    {"name": "brand", "label": "Brand", "data_type": "text", "display_order": 4, "is_searchable": True},
                    {"name": "sole_type", "label": "Sole Type", "data_type": "select", "valid_values": ["Rubber", "PU", "PVC", "Leather"], "display_order": 5}
                ],
                "grid_col": "size",
                "grid_row": "color"
            },
            "apparel": {
                "group_name": "Apparel Basic",
                "category": "Apparel",
                "attributes": [
                    {"name": "style_no", "label": "Style", "data_type": "text", "is_variant_dimension": True, "is_mandatory": True, "display_order": 1, "is_searchable": True},
                    {"name": "color", "label": "Color", "data_type": "select", "valid_values": ["Black", "White", "Navy", "Red", "Grey"], "is_variant_dimension": True, "display_order": 2, "is_searchable": True},
                    {"name": "size", "label": "Size", "data_type": "select", "valid_values": ["S", "M", "L", "XL", "XXL"], "is_variant_dimension": True, "display_order": 3, "is_searchable": True},
                    {"name": "fit", "label": "Fit", "data_type": "select", "valid_values": ["Regular", "Slim", "Loose"], "display_order": 4},
                    {"name": "sleeve", "label": "Sleeve", "data_type": "select", "valid_values": ["Short", "Long", "Sleeveless"], "display_order": 5},
                    {"name": "fabric", "label": "Fabric", "data_type": "select", "valid_values": ["Cotton", "Polyester", "Wool", "Linen"], "display_order": 6}
                ],
                "grid_col": "size",
                "grid_row": "color"
            },
            "grocery": {
                "group_name": "Grocery Pack",
                "category": "Grocery",
                "attributes": [
                    {"name": "pack_size", "label": "Pack Size", "data_type": "text", "is_mandatory": True, "display_order": 1, "is_searchable": True},
                    {"name": "mrp", "label": "MRP", "data_type": "number", "is_mandatory": True, "display_order": 2},
                    {"name": "batch", "label": "Batch", "data_type": "text", "display_order": 3, "is_searchable": True},
                    {"name": "expiry", "label": "Expiry", "data_type": "date", "display_order": 4}
                ],
                "grid_col": None,
                "grid_row": None
            },
            "electronics": {
                "group_name": "Electronics Spec",
                "category": "Electronics",
                "attributes": [
                    {"name": "model", "label": "Model", "data_type": "text", "is_mandatory": True, "display_order": 1, "is_searchable": True},
                    {"name": "serial_number", "label": "Serial Number", "data_type": "text", "display_order": 2, "is_searchable": True},
                    {"name": "ram", "label": "RAM", "data_type": "select", "valid_values": ["4GB", "8GB", "16GB", "32GB"], "display_order": 3},
                    {"name": "storage", "label": "Storage", "data_type": "select", "valid_values": ["128GB", "256GB", "512GB", "1TB"], "display_order": 4}
                ],
                "grid_col": None,
                "grid_row": None
            },
            "jewellery": {
                "group_name": "Jewellery Design",
                "category": "Jewellery",
                "attributes": [
                    {"name": "design_no", "label": "Design", "data_type": "text", "is_mandatory": True, "display_order": 1, "is_searchable": True},
                    {"name": "weight", "label": "Weight", "data_type": "number", "display_order": 2},
                    {"name": "purity", "label": "Purity", "data_type": "select", "valid_values": ["18K", "22K", "24K"], "display_order": 3},
                    {"name": "stone", "label": "Stone", "data_type": "select", "valid_values": ["Diamond", "Ruby", "Emerald", "None"], "display_order": 4}
                ],
                "grid_col": None,
                "grid_row": None
            }
        }
        
        industry_key = industry.lower()
        if industry_key not in templates:
            raise HTTPException(status_code=400, detail=f"Template for '{industry}' not supported.")
            
        data = templates[industry_key]
        
        # 1. Create or retrieve attribute definitions
        attr_ids = []
        grid_col_id = None
        grid_row_id = None
        
        for attr in data["attributes"]:
            # Check if exists
            q = select(AttributeDefinition).where(
                AttributeDefinition.name == attr["name"],
                AttributeDefinition.is_deleted == False
            )
            res = await self.db.execute(q)
            defn = res.scalars().first()
            
            valid_values_json = json.dumps(attr.get("valid_values")) if attr.get("valid_values") else None
            
            if not defn:
                # Create definition
                new_id = f"attr-{attr['name']}-{uuid.uuid4().hex[:4]}"
                defn = AttributeDefinition(
                    id=new_id,
                    name=attr["name"],
                    label=attr["label"],
                    data_type=attr["data_type"],
                    is_variant_dimension=attr.get("is_variant_dimension", False),
                    is_mandatory=attr.get("is_mandatory", False),
                    valid_values=valid_values_json,
                    is_searchable=attr.get("is_searchable", True),
                    is_filterable=attr.get("is_filterable", True),
                    is_printable=attr.get("is_printable", True),
                    is_barcode_enabled=attr.get("is_barcode_enabled", True),
                    display_order=attr.get("display_order", 0),
                    created_by=operator,
                    updated_by=operator
                )
                self.db.add(defn)
                await self.db.commit()
                await self.db.refresh(defn)
            else:
                # Update attributes to make sure they are active
                defn.is_deleted = False
                defn.is_active = True
                defn.updated_by = operator
                defn.modified_at = datetime.now(timezone.utc)
                await self.db.commit()
                await self.db.refresh(defn)
                
            attr_ids.append(defn.id)
            if data["grid_col"] == attr["name"]:
                grid_col_id = defn.id
            if data["grid_row"] == attr["name"]:
                grid_row_id = defn.id
                
        # 2. Create or retrieve attribute group
        q_grp = select(AttributeGroup).where(
            AttributeGroup.name == data["group_name"],
            AttributeGroup.is_deleted == False
        )
        res_grp = await self.db.execute(q_grp)
        group = res_grp.scalars().first()
        
        if not group:
            new_grp_id = f"grp-{industry_key}-{uuid.uuid4().hex[:4]}"
            group = AttributeGroup(
                id=new_grp_id,
                name=data["group_name"],
                attribute_ids=json.dumps(attr_ids),
                grid_column_attribute_id=grid_col_id,
                grid_row_attribute_id=grid_row_id,
                created_by=operator,
                updated_by=operator
            )
            self.db.add(group)
            await self.db.commit()
            await self.db.refresh(group)
        else:
            group.attribute_ids = json.dumps(attr_ids)
            group.grid_column_attribute_id = grid_col_id
            group.grid_row_attribute_id = grid_row_id
            group.updated_by = operator
            group.modified_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(group)
            
        # 3. Create or retrieve mapping
        q_map = select(CategoryAttributeGroupMapping).where(
            CategoryAttributeGroupMapping.category == data["category"],
            CategoryAttributeGroupMapping.is_deleted == False
        )
        res_map = await self.db.execute(q_map)
        mapping = res_map.scalars().first()
        
        if not mapping:
            new_map_id = f"map-{industry_key}-{uuid.uuid4().hex[:4]}"
            mapping = CategoryAttributeGroupMapping(
                id=new_map_id,
                category=data["category"],
                attribute_group_id=group.id,
                created_by=operator,
                updated_by=operator
            )
            self.db.add(mapping)
            await self.db.commit()
            await self.db.refresh(mapping)
        else:
            mapping.attribute_group_id = group.id
            mapping.updated_by = operator
            mapping.modified_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(mapping)
            
        return {"success": True, "group_id": group.id, "mapping_id": mapping.id}

