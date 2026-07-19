"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import random
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_permission
from ...models.auth import User
from ...models.attributes import (
    AttributeDefinition, AttributeGroup, VariantTemplate, CategoryAttributeGroupMapping
)
from ...models.inventory import Product
from ...schemas.attributes import (
    AttributeDefinitionCreate, AttributeDefinitionUpdate, AttributeDefinitionResponse,
    AttributeGroupCreate, AttributeGroupUpdate, AttributeGroupResponse,
    VariantTemplateCreate, VariantTemplateUpdate, VariantTemplateResponse,
    CategoryMappingCreate, CategoryMappingResponse
)
from ...services.attributes import AttributesService

router = APIRouter()


# --- Attribute Definitions CRUD ---

@router.get(
    "/definitions",
    response_model=List[AttributeDefinitionResponse],
)
async def list_definitions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active attribute definitions.
    """
    service = AttributesService(db)
    defns = await service.list_definitions()
    res = []
    for d in defns:
        res.append(AttributeDefinitionResponse(
            id=d.id,
            name=d.name,
            label=d.label,
            dataType=d.data_type,
            isVariantDimension=d.is_variant_dimension or False,
            isMandatory=d.is_mandatory or False,
            validValues=json.loads(d.valid_values) if d.valid_values else [],
            groupId=d.group_id,
            isSearchable=d.is_searchable if d.is_searchable is not None else True,
            isFilterable=d.is_filterable if d.is_filterable is not None else True,
            isPrintable=d.is_printable if d.is_printable is not None else True,
            isBarcodeEnabled=d.is_barcode_enabled if d.is_barcode_enabled is not None else True,
            displayOrder=d.display_order if d.display_order is not None else 0,
            defaultValue=d.default_value,
            tooltip=d.tooltip,
            validationRules=d.validation_rules,
            isEnabled=d.is_enabled if d.is_enabled is not None else True,
            multiLangLabels=d.multi_lang_labels if d.multi_lang_labels is not None else {}
        ))
    return res


@router.post(
    "/definitions",
    response_model=AttributeDefinitionResponse,
    status_code=201,
    dependencies=[Depends(require_permission("ITEM.CREATE"))],
)
async def create_definition(
    req: AttributeDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new custom attribute definition.
    """
    service = AttributesService(db)
    d = await service.create_definition(req, current_user.username)
    return AttributeDefinitionResponse(
        id=d.id,
        name=d.name,
        label=d.label,
        dataType=d.data_type,
        isVariantDimension=d.is_variant_dimension or False,
        isMandatory=d.is_mandatory or False,
        validValues=json.loads(d.valid_values) if d.valid_values else [],
        groupId=d.group_id,
        isSearchable=d.is_searchable if d.is_searchable is not None else True,
        isFilterable=d.is_filterable if d.is_filterable is not None else True,
        isPrintable=d.is_printable if d.is_printable is not None else True,
        isBarcodeEnabled=d.is_barcode_enabled if d.is_barcode_enabled is not None else True,
        displayOrder=d.display_order if d.display_order is not None else 0,
        defaultValue=d.default_value,
        tooltip=d.tooltip,
        validationRules=d.validation_rules,
        isEnabled=d.is_enabled if d.is_enabled is not None else True,
        multiLangLabels=d.multi_lang_labels if d.multi_lang_labels is not None else {}
    )


@router.put(
    "/definitions/{id}",
    response_model=AttributeDefinitionResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def update_definition(
    id: str,
    req: AttributeDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update custom attribute definition.
    """
    service = AttributesService(db)
    d = await service.update_definition(id, req, current_user.username)
    return AttributeDefinitionResponse(
        id=d.id,
        name=d.name,
        label=d.label,
        dataType=d.data_type,
        isVariantDimension=d.is_variant_dimension or False,
        isMandatory=d.is_mandatory or False,
        validValues=json.loads(d.valid_values) if d.valid_values else [],
        groupId=d.group_id,
        isSearchable=d.is_searchable if d.is_searchable is not None else True,
        isFilterable=d.is_filterable if d.is_filterable is not None else True,
        isPrintable=d.is_printable if d.is_printable is not None else True,
        isBarcodeEnabled=d.is_barcode_enabled if d.is_barcode_enabled is not None else True,
        displayOrder=d.display_order if d.display_order is not None else 0,
        defaultValue=d.default_value,
        tooltip=d.tooltip,
        validationRules=d.validation_rules,
        isEnabled=d.is_enabled if d.is_enabled is not None else True,
        multiLangLabels=d.multi_lang_labels if d.multi_lang_labels is not None else {}
    )



@router.delete(
    "/definitions/{id}",
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_definition(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete attribute definition.
    """
    service = AttributesService(db)
    await service.delete_definition(id, current_user.username)
    return {"success": True}


# --- Attribute Groups CRUD ---

@router.get(
    "/groups",
    response_model=List[AttributeGroupResponse],
)
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active attribute groups.
    """
    service = AttributesService(db)
    groups = await service.list_groups()
    res = []
    for g in groups:
        res.append(AttributeGroupResponse(
            id=g.id,
            name=g.name,
            attributeIds=json.loads(g.attribute_ids) if g.attribute_ids else [],
            gridColumnAttributeId=g.grid_column_attribute_id,
            gridRowAttributeId=g.grid_row_attribute_id
        ))
    return res


@router.post(
    "/groups",
    response_model=AttributeGroupResponse,
    status_code=201,
    dependencies=[Depends(require_permission("ITEM.CREATE"))],
)
async def create_group(
    req: AttributeGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new attribute group.
    """
    service = AttributesService(db)
    g = await service.create_group(req, current_user.username)
    return AttributeGroupResponse(
        id=g.id,
        name=g.name,
        attributeIds=json.loads(g.attribute_ids) if g.attribute_ids else [],
        gridColumnAttributeId=g.grid_column_attribute_id,
        gridRowAttributeId=g.grid_row_attribute_id
    )


@router.put(
    "/groups/{id}",
    response_model=AttributeGroupResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def update_group(
    id: str,
    req: AttributeGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update attribute group.
    """
    service = AttributesService(db)
    g = await service.update_group(id, req, current_user.username)
    return AttributeGroupResponse(
        id=g.id,
        name=g.name,
        attributeIds=json.loads(g.attribute_ids) if g.attribute_ids else [],
        gridColumnAttributeId=g.grid_column_attribute_id,
        gridRowAttributeId=g.grid_row_attribute_id
    )


@router.delete(
    "/groups/{id}",
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_group(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete attribute group.
    """
    service = AttributesService(db)
    await service.delete_group(id, current_user.username)
    return {"success": True}


# --- Variant Templates CRUD ---

@router.get(
    "/templates",
    response_model=List[VariantTemplateResponse],
)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active style variant templates.
    """
    service = AttributesService(db)
    templates = await service.list_templates()
    res = []
    for t in templates:
        res.append(VariantTemplateResponse(
            id=t.id,
            styleCode=t.style_code,
            name=t.name,
            brand=t.brand or "SMRITI",
            category=t.category or "General",
            hsnCode=t.hsn_code or "61091000",
            basePrice=float(t.base_price or 0),
            baseMrp=float(t.base_mrp or 0),
            gstPercentage=float(t.gst_percentage or 18),
            attributeGroupId=t.attribute_group_id,
            pricingMode=t.pricing_mode,
            trackingMode=t.tracking_mode
        ))
    return res


@router.post(
    "/templates",
    response_model=VariantTemplateResponse,
    status_code=201,
    dependencies=[Depends(require_permission("ITEM.CREATE"))],
)
async def create_template(
    req: VariantTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new variant template.
    """
    service = AttributesService(db)
    t = await service.create_template(req, current_user.username)
    return VariantTemplateResponse(
        id=t.id,
        styleCode=t.style_code,
        name=t.name,
        brand=t.brand or "SMRITI",
        category=t.category or "General",
        hsnCode=t.hsn_code or "61091000",
        basePrice=float(t.base_price or 0),
        baseMrp=float(t.base_mrp or 0),
        gstPercentage=float(t.gst_percentage or 18),
        attributeGroupId=t.attribute_group_id,
        pricingMode=t.pricing_mode,
        trackingMode=t.tracking_mode
    )


@router.put(
    "/templates/{id}",
    response_model=VariantTemplateResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def update_template(
    id: str,
    req: VariantTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update variant template.
    """
    service = AttributesService(db)
    t = await service.update_template(id, req, current_user.username)
    return VariantTemplateResponse(
        id=t.id,
        styleCode=t.style_code,
        name=t.name,
        brand=t.brand or "SMRITI",
        category=t.category or "General",
        hsnCode=t.hsn_code or "61091000",
        basePrice=float(t.base_price or 0),
        baseMrp=float(t.base_mrp or 0),
        gstPercentage=float(t.gst_percentage or 18),
        attributeGroupId=t.attribute_group_id,
        pricingMode=t.pricing_mode,
        trackingMode=t.tracking_mode
    )


@router.delete(
    "/templates/{id}",
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_template(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete variant template.
    """
    service = AttributesService(db)
    await service.delete_template(id, current_user.username)
    return {"success": True}


# --- Generate Variants ---

@router.post(
    "/templates/{id}/generate-variants",
)
async def generate_variants(
    id: str,
    body: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate product variants under a template style.
    """
    template = await db.get(VariantTemplate, id)
    if not template or template.is_deleted:
        raise HTTPException(status_code=404, detail="Variant template not found.")

    group = await db.get(AttributeGroup, template.attribute_group_id)
    if not group or group.is_deleted:
        raise HTTPException(status_code=400, detail="Linked Attribute Group not found.")

    variants_list = body.get("variants", [])
    created_variants = []

    # Get group attribute definitions
    attr_ids = json.loads(group.attribute_ids) if group.attribute_ids else []
    attr_def_list = []
    for aid in attr_ids:
        defn = await db.get(AttributeDefinition, aid)
        if defn and not defn.is_deleted:
            attr_def_list.append(defn)

    for index, v in enumerate(variants_list):
        code_parts = [template.style_code]
        for defn in attr_def_list:
            if defn.is_variant_dimension:
                val = v.get("attributes", {}).get(defn.name)
                if val:
                    code_val = str(val).upper().strip().replace(" ", "")
                    code_parts.append(code_val)

        constructed_code = v.get("sku") or "-".join(code_parts)
        barcode = v.get("barcode") or f"SMR-B{random.randint(100000, 999999)}"

        # Check existing product code
        q = select(Product).where(Product.code == constructed_code, Product.is_deleted == False)
        res = await db.execute(q)
        existing = res.scalars().first()

        if existing:
            existing.stock = int(v.get("stock", 0))
            existing.price = float(v.get("price", template.base_price))
            existing.mrp = float(v.get("mrp", template.base_mrp))
            existing.cost_price = float(v.get("costPrice", float(existing.price) * 0.6))
            existing.sku = v.get("sku") or existing.sku
            existing.barcode = v.get("barcode") or existing.barcode
            existing.attributes = {**existing.attributes, **v.get("attributes", {})}
            created_variants.append(existing)
        else:
            # Create new product item
            new_prod = Product(
                id=f"p-var-{int(datetime.now(timezone.utc).timestamp())}-{index}",
                code=constructed_code,
                sku=v.get("sku") or constructed_code,
                name=template.name,
                price=float(v.get("price", template.base_price)),
                mrp=float(v.get("mrp", template.base_mrp or v.get("price", template.base_price))),
                cost_price=float(v.get("costPrice", float(v.get("price", template.base_price)) * 0.6)),
                stock=int(v.get("stock", 0)),
                category=template.category,
                barcode=barcode,
                style_code=template.style_code,
                gst_percentage=template.gst_percentage,
                attributes=v.get("attributes", {}),
                pricing_mode=template.pricing_mode,
                tracking_mode=template.tracking_mode,
                variant_template_id=template.id,
                created_by=current_user.username,
                updated_by=current_user.username
            )
            db.add(new_prod)
            created_variants.append(new_prod)

    await db.commit()
    
    # Return count and list
    serialized = []
    for prod in created_variants:
        serialized.append({
            "id": prod.id,
            "code": prod.code,
            "sku": prod.sku,
            "name": prod.name,
            "price": float(prod.price),
            "mrp": float(prod.mrp) if prod.mrp else None,
            "stock": prod.stock,
            "category": prod.category,
            "barcode": prod.barcode
        })
    return {"success": True, "count": len(created_variants), "variants": serialized}


# --- Category Mappings CRUD ---

@router.get(
    "/category-mappings",
    response_model=List[CategoryMappingResponse],
)
async def list_category_mappings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all category to attribute group association mappings.
    """
    service = AttributesService(db)
    mappings = await service.list_category_mappings()
    res = []
    for m in mappings:
        res.append(CategoryMappingResponse(
            category=m.category,
            attributeGroupId=m.attribute_group_id
        ))
    return res


@router.post(
    "/category-mappings",
    response_model=CategoryMappingResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def save_category_mapping(
    req: CategoryMappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save category to attribute group mapping registry.
    """
    service = AttributesService(db)
    m = await service.save_category_mapping(req.category, req.attributeGroupId, current_user.username)
    return CategoryMappingResponse(
        category=m.category,
        attributeGroupId=m.attribute_group_id
    )


# --- Import CSV Validators ---

@router.get(
    "/import-headers/{groupId}",
)
async def import_headers(
    groupId: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get dynamic CSV template headers structure for a given attribute group.
    """
    group = await db.get(AttributeGroup, groupId)
    if not group or group.is_deleted:
        raise HTTPException(status_code=404, detail="Attribute Group not found.")

    headers = [
        "TemplateStyleCode", "BaseName", "Brand", "Category", "HSN", 
        "Price", "MRP", "GST_Percentage", "PricingMode", "TrackingMode", "Stock", "Barcode"
    ]
    
    attr_ids = json.loads(group.attribute_ids) if group.attribute_ids else []
    for aid in attr_ids:
        defn = await db.get(AttributeDefinition, aid)
        if defn and not defn.is_deleted:
            headers.append(f"Attr_{defn.name}")

    return {"headers": headers}


@router.post(
    "/import-validate",
)
async def import_validate(
    groupId: str = Body(..., embed=True),
    rows: List[Dict[str, Any]] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate CSV rows structure against group attribute constraints.
    """
    group = await db.get(AttributeGroup, groupId)
    if not group or group.is_deleted:
        raise HTTPException(status_code=404, detail="Attribute Group not found.")

    attr_ids = json.loads(group.attribute_ids) if group.attribute_ids else []
    attr_def_list = []
    for aid in attr_ids:
        defn = await db.get(AttributeDefinition, aid)
        if defn and not defn.is_deleted:
            attr_def_list.append(defn)

    results = []
    has_errors = False

    for index, row in enumerate(rows):
        row_errors = []

        if not row.get("TemplateStyleCode"): row_errors.append("TemplateStyleCode is required")
        if not row.get("BaseName"): row_errors.append("BaseName is required")
        
        price_val = row.get("Price")
        if price_val is None:
            row_errors.append("Price is required")
        else:
            try:
                float(price_val)
            except ValueError:
                row_errors.append("Price must be a valid number")

        for defn in attr_def_list:
            val = row.get(f"Attr_{defn.name}")
            if defn.is_mandatory and not val:
                row_errors.append(f"Mandatory attribute '{defn.label}' is missing.")
            
            if val and defn.data_type == "select" and defn.valid_values:
                try:
                    valids = json.loads(defn.valid_values)
                    if val not in valids:
                        row_errors.append(f"Value '{val}' is not valid for '{defn.label}'. Allowed: {', '.join(valids)}")
                except Exception:
                    pass

        if len(row_errors) > 0:
            has_errors = True

        results.append({
            "index": index,
            "row": row,
            "errors": row_errors,
            "valid": len(row_errors) == 0
        })

    return {"hasErrors": has_errors, "results": results}


@router.post(
    "/import-commit",
)
async def import_commit(
    groupId: str = Body(..., embed=True),
    rows: List[Dict[str, Any]] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk insert/update products with attribute values from validated CSV payload.
    """
    group = await db.get(AttributeGroup, groupId)
    if not group or group.is_deleted:
        raise HTTPException(status_code=404, detail="Attribute Group not found.")

    attr_ids = json.loads(group.attribute_ids) if group.attribute_ids else []
    attr_def_list = []
    for aid in attr_ids:
        defn = await db.get(AttributeDefinition, aid)
        if defn and not defn.is_deleted:
            attr_def_list.append(defn)

    created_products = []

    for index, row in enumerate(rows):
        style_code = row.get("TemplateStyleCode")
        
        # Check if template exists, create if not
        q = select(VariantTemplate).where(
            VariantTemplate.style_code == style_code,
            VariantTemplate.is_deleted == False
        )
        res = await db.execute(q)
        template = res.scalars().first()
        if not template:
            template = VariantTemplate(
                id=f"vt-{int(datetime.now(timezone.utc).timestamp())}-{index}",
                style_code=style_code,
                name=row.get("BaseName"),
                brand=row.get("Brand") or "SMRITI",
                category=row.get("Category") or "General",
                hsn_code=row.get("HSN") or "61091000",
                base_price=int(float(row.get("Price") or 0)),
                base_mrp=int(float(row.get("MRP") or row.get("Price") or 0)),
                gst_percentage=int(float(row.get("GST_Percentage") or 18)),
                attribute_group_id=group.id,
                pricing_mode=row.get("PricingMode") or "Fixed",
                tracking_mode=row.get("TrackingMode") or "Standard",
                created_by=current_user.username,
                updated_by=current_user.username
            )
            db.add(template)

        attrs = {}
        code_parts = [template.style_code]
        for defn in attr_def_list:
            val = row.get(f"Attr_{defn.name}")
            if val:
                attrs[defn.name] = val
                if defn.is_variant_dimension:
                    code_parts.append(str(val).upper().strip().replace(" ", ""))

        constructed_code = "-".join(code_parts)
        barcode = row.get("Barcode") or f"SMR-B{random.randint(100000, 999999)}"

        q_prod = select(Product).where(Product.code == constructed_code, Product.is_deleted == False)
        res_prod = await db.execute(q_prod)
        existing = res_prod.scalars().first()

        if existing:
            existing.stock = int(row.get("Stock") or 0)
            existing.price = float(row.get("Price") or template.base_price)
            existing.mrp = float(row.get("MRP") or template.base_mrp)
            existing.attributes = {**existing.attributes, **attrs}
            created_products.append(existing)
        else:
            new_prod = Product(
                id=f"p-import-{int(datetime.now(timezone.utc).timestamp())}-{index}",
                code=constructed_code,
                sku=constructed_code,
                name=template.name,
                price=float(row.get("Price") or template.base_price),
                mrp=float(row.get("MRP") or template.base_mrp or row.get("Price") or template.base_price),
                stock=int(row.get("Stock") or 0),
                category=template.category,
                barcode=barcode,
                style_code=template.style_code,
                gst_percentage=template.gst_percentage,
                attributes=attrs,
                pricing_mode=template.pricing_mode,
                tracking_mode=template.tracking_mode,
                variant_template_id=template.id,
                created_by=current_user.username,
                updated_by=current_user.username
            )
            db.add(new_prod)
            created_products.append(new_prod)

    await db.commit()
    return {"success": True, "count": len(created_products)}


# --- Analytical Reports API ---

@router.get(
    "/reports/sales-by-attribute",
)
async def sales_by_attribute(
    attributeName: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sales distribution statistics grouped by selected attribute dimension values.
    """
    # For now, return mock stats matching Express implementation fallback logic
    # In live database, this scans bills/items and filters by product attributes
    res = [
        {"value": "Red", "quantitySold": 45, "revenue": 22500.0},
        {"value": "Blue", "quantitySold": 30, "revenue": 15000.0},
        {"value": "XL", "quantitySold": 50, "revenue": 25000.0},
        {"value": "M", "quantitySold": 25, "revenue": 12500.0}
    ]
    return res


@router.get(
    "/reports/stock-by-attribute",
)
async def stock_by_attribute(
    attributeName: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stock valuations grouped by selected attribute dimension values.
    """
    # Scan all products in Postgres database, parsing attributes JSONB
    q = select(Product).where(Product.is_deleted == False)
    res = await db.execute(q)
    products_list = res.scalars().all()

    stats = {}
    for p in products_list:
        attr_val = p.attributes.get(attributeName) if p.attributes else None
        if not attr_val:
            attr_val = p.color if attributeName.lower() == "color" else (p.size if attributeName.lower() == "size" else None)
        
        key = attr_val or "Solid / Free Size"
        if key not in stats:
            stats[key] = {"value": key, "stockCount": 0, "valuation": 0.0, "productCount": 0}
        
        stats[key]["stockCount"] += p.stock or 0
        stats[key]["valuation"] += float(p.stock or 0) * float(p.price or 0.0)
        stats[key]["productCount"] += 1

    return list(stats.values())


@router.post(
    "/load-template",
    status_code=200,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def load_template(
    industry: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Load pre-configured business templates (Footwear, Apparel, Grocery, etc.)
    """
    service = AttributesService(db)
    return await service.load_industry_template(industry, current_user.username)

