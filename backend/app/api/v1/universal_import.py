"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import hashlib
import json
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from ...models.audit import ComplianceImmutableAuditLog
from ...models.item_master import Item, ItemVariant, ItemBarcode, ItemWarehouseLocation
from ...models.pricing import PriceBook, PriceBookEntry
from ...models.inventory import Product
from ...schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from ...schemas.stock_acct import StockMovementRecordRequest
from ...schemas.sales import SalesReturnCreate, SalesReturnItemCreate
from ...schemas.pricing import PriceBookEntryCreateRequest
from ...services.pricing_engine import PricingEngine
from ...services.item_master_svc import UniversalItemMasterService
from ...services.purchase import PurchaseService
from ...services.stock_acct_svc import StockAccountingBoundaryService
from ...services.sales import SalesService

router = APIRouter()


class ImportPreviewRequest(BaseModel):
    target: str = Field(..., min_length=1)
    rows: List[Dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class ImportCommitRequest(ImportPreviewRequest):
    idempotency_key: str = Field(..., min_length=8, max_length=150)
    price_book_id: Optional[str] = None
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    receipt_no: Optional[str] = None
    reason: Optional[str] = None
    original_invoice_id: Optional[str] = None
    return_no: Optional[str] = None
    price_mode: Optional[str] = "DO_NOT_CREATE"  # DO_NOT_CREATE, CREATE_AS_DRAFT, CREATE_LIVE_RETAIL


def _text(row: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _candidate_payload(item: Item, variant: Optional[ItemVariant] = None) -> Dict[str, Any]:
    return {
        "item_id": item.id,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "variant_id": variant.id if variant else None,
        "variant_sku": variant.variant_sku if variant else None,
        "variant_name": variant.variant_name if variant else None,
        "brand": item.brand,
        "attributes": (variant.attributes_json if variant else item.attributes_json) or {},
        "mrp": float((variant.mrp if variant else item.mrp) or 0),
        "selling_price": float((variant.selling_price if variant else item.selling_price) or 0),
    }


async def _resolve_row(db: AsyncSession, row: Dict[str, Any]) -> Dict[str, Any]:
    barcode = _text(row, "barcode", "Barcode", "ean", "upc")
    sku = _text(row, "sku", "SKU", "variant_sku")
    item_code = _text(row, "item_code", "itemCode", "Item Code")
    style = _text(row, "styleArticle", "style", "article", "Style / Article")
    size = _text(row, "size", "Size")
    color = _text(row, "color", "colour", "Color", "Colour")
    brand = _text(row, "brand", "Brand")

    if barcode:
        match = await UniversalItemMasterService.lookup_by_barcode(db, barcode)
        if match:
            return {"status": "MATCHED", "match_type": "BARCODE", "match": match}

    if sku or item_code:
        code = sku or item_code
        item = await UniversalItemMasterService.get_item_by_code(db, code)
        if item:
            return {"status": "MATCHED", "match_type": "SKU" if sku else "ITEM_CODE", "match": _candidate_payload(item)}

        variant_stmt = (
            select(ItemVariant)
            .join(ItemVariant.item)
            .where(ItemVariant.variant_sku == code.upper(), ItemVariant.is_deleted == False)
            .options(selectinload(ItemVariant.item))
        )
        variant = (await db.execute(variant_stmt)).scalar_one_or_none()
        if variant and variant.item:
            return {"status": "MATCHED", "match_type": "VARIANT_SKU", "match": _candidate_payload(variant.item, variant)}

    if style and size and color:
        candidates_stmt = (
            select(ItemVariant)
            .join(ItemVariant.item)
            .where(
                ItemVariant.is_deleted == False,
                ItemVariant.attributes_json["size"].as_string() == size,
                ItemVariant.attributes_json["color"].as_string() == color,
                Item.attributes_json["style"].as_string() == style,
            )
            .options(selectinload(ItemVariant.item))
        )
        candidates = (await db.execute(candidates_stmt)).scalars().all()
        if brand:
            candidates = [candidate for candidate in candidates if (candidate.item.brand or "").lower() == brand.lower()]
        if len(candidates) == 1:
            return {"status": "MATCHED", "match_type": "STYLE_SIZE_COLOR", "match": _candidate_payload(candidates[0].item, candidates[0])}
        if len(candidates) > 1:
            return {
                "status": "AMBIGUOUS",
                "match_type": "STYLE_SIZE_COLOR",
                "candidates": [_candidate_payload(candidate.item, candidate) for candidate in candidates[:20]],
            }

    return {"status": "NOT_FOUND"}


@router.post("/preview", summary="Preview universal import rows")
async def preview_universal_import(
    request: ImportPreviewRequest,
    db: AsyncSession = Depends(get_company_db),
    _current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    """Resolve rows without creating products, changing stock, or changing prices."""
    if request.target.upper().strip() == "ITEM_MASTER":
        company_id = getattr(_current_user, "company_id", None) or (_current_user.get("company_id") if isinstance(_current_user, dict) else "COMP-001")
        reconciliation_report: List[Dict[str, Any]] = []
        batch_barcodes = set()
        batch_skus = set()
        seen_styles = set()
        processed_styles = set()
        summary = {
            "total_rows": len(request.rows),
            "valid_rows": 0,
            "duplicate_barcodes": 0,
            "duplicate_skus": 0,
            "pricing_conflicts": 0,
            "distinct_styles": 0,
            "status": "READY_FOR_IMPORT",
        }
        for index, row in enumerate(request.rows, start=1):
            row_num = row.get("rowNumber", index)
            barcode = _text(row, "barcode", "Barcode", "BARCODE_NO", "ean", "upc")
            sku = _text(row, "sku", "SKU", "variant_sku", "SKU_CODE", "SKU_PREVIEW")
            style = _text(row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code")
            color = _text(row, "color", "colour", "Color", "Colour", "COLOR")
            size = _text(row, "size", "Size", "SIZE")
            mrp_val = float(row.get("mrp", row.get("MRP", 0)) or 0)
            selling_val = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", 0))) or 0)
            warehouse_code = _text(row, "warehouse_code", "WAREHOUSE_CODE", "warehouse_id")

            errors = []
            if not barcode:
                errors.append("Missing BARCODE_NO")
            elif barcode in batch_barcodes:
                errors.append(f"Duplicate barcode in batch: {barcode}")

            if not sku:
                if style and color and size:
                    sku = f"{style}-{color}-{size}".upper()
                else:
                    errors.append("Missing SKU_CODE or Style/Color/Size")
            elif sku in batch_skus:
                errors.append(f"Duplicate SKU in batch: {sku}")

            if selling_val > mrp_val and mrp_val > 0:
                errors.append(f"SELLING_PRICE ({selling_val}) > MRP ({mrp_val})")

            # Check DB barcode
            if barcode:
                db_bc = await UniversalItemMasterService.lookup_by_barcode(db, barcode)
                if db_bc:
                    errors.append(f"Barcode already exists in database (Item: {db_bc.get('item_name')})")

            # Check DB SKU
            if sku:
                existing_var = (await db.execute(
                    select(ItemVariant).where(ItemVariant.variant_sku == sku.upper(), ItemVariant.is_deleted == False)
                )).scalar_one_or_none()
                if existing_var:
                    errors.append(f"SKU already exists in database: {sku}")

            # Check DB Style
            db_item = None
            if style:
                item_stmt = select(Item).where(
                    Item.company_id == company_id,
                    Item.item_code == style,
                    Item.is_deleted == False
                )
                db_item = (await db.execute(item_stmt)).scalars().first()

            if barcode:
                batch_barcodes.add(barcode)
            if sku:
                batch_skus.add(sku)
            if style:
                seen_styles.add(style)

            is_valid = len(errors) == 0
            if is_valid:
                summary["valid_rows"] += 1
                row_status = "VALID"
                if style and (style in processed_styles or db_item):
                    action = "ATTACH_VARIANT_TO_STYLE"
                else:
                    action = "CREATE_ITEM_AND_VARIANT"
                    if style:
                        processed_styles.add(style)
            else:
                row_status = "INVALID"
                action = "BLOCK"
                if any("barcode" in e.lower() for e in errors):
                    summary["duplicate_barcodes"] += 1
                if any("sku" in e.lower() for e in errors):
                    summary["duplicate_skus"] += 1
                if any("selling_price" in e.lower() for e in errors):
                    summary["pricing_conflicts"] += 1

            reconciliation_report.append({
                "row_number": row_num,
                "barcode": barcode,
                "sku": sku,
                "style_code": style,
                "status": row_status,
                "action": action,
                "errors": errors,
                "color": color,
                "size": size,
                "mrp": mrp_val,
                "selling_price": selling_val,
                "warehouse_code": warehouse_code or "WH-MAIN",
            })

        summary["distinct_styles"] = len(seen_styles)
        if summary["valid_rows"] < summary["total_rows"]:
            summary["status"] = "VALIDATION_ISSUES_FOUND"

        return {
            "target": "ITEM_MASTER",
            "summary": summary,
            "counts": {
                "total": summary["total_rows"],
                "valid": summary["valid_rows"],
                "invalid": summary["total_rows"] - summary["valid_rows"],
                "duplicate_barcodes": summary["duplicate_barcodes"],
                "duplicate_skus": summary["duplicate_skus"],
                "pricing_conflicts": summary["pricing_conflicts"],
                "distinct_styles": summary["distinct_styles"],
            },
            "rows": reconciliation_report,
        }

    results: List[Dict[str, Any]] = []
    purchase_items: List[PurchaseReceiptItemCreate] = []
    return_items: List[SalesReturnItemCreate] = []
    counts = {"total": len(request.rows), "matched": 0, "ambiguous": 0, "not_found": 0}

    for index, row in enumerate(request.rows, start=1):
        result = await _resolve_row(db, row)
        result["row_number"] = row.get("rowNumber", index)
        result["input"] = row
        results.append(result)
        counts[result["status"].lower()] = counts.get(result["status"].lower(), 0) + 1

    return {"target": request.target, "counts": counts, "rows": results}


@router.post("/commit", status_code=status.HTTP_200_OK, summary="Commit a universal import")
async def commit_universal_import(
    request: ImportCommitRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Commit the first governed target, Price Book, after server-side re-resolution."""
    target = request.target.upper().strip()
    if target not in {"PRICE_BOOK", "ITEM_MASTER", "PURCHASE_INWARD", "STOCK_ADJUSTMENT", "SALES_RETURN", "LABEL_PRINT"}:
        raise HTTPException(status_code=501, detail="This target is preview-only until its domain commit adapter is enabled.")
    if target == "PRICE_BOOK" and not request.price_book_id:
        raise HTTPException(status_code=400, detail="price_book_id is required for Price Book imports.")
    if target == "PURCHASE_INWARD" and not request.supplier_id:
        raise HTTPException(status_code=400, detail="supplier_id is required for Purchase Inward imports.")
    if target in {"STOCK_ADJUSTMENT", "SALES_RETURN"} and not request.reason:
        raise HTTPException(status_code=400, detail="reason is required for Stock Adjustment imports.")
    if target == "SALES_RETURN" and (not request.original_invoice_id or not request.return_no):
        raise HTTPException(status_code=400, detail="original_invoice_id and return_no are required for Sales Return imports.")
    company_id = getattr(current_user, "company_id", None) or (current_user.get("company_id") if isinstance(current_user, dict) else "COMP-001")
    user_id = getattr(current_user, "id", None) or getattr(current_user, "username", None) or (current_user.get("sub") if isinstance(current_user, dict) else "usr-system")
    payload_hash = hashlib.sha256(request.model_dump_json().encode("utf-8")).hexdigest()

    prior_stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.company_id == company_id,
        ComplianceImmutableAuditLog.event_type == "UNIVERSAL_IMPORT_COMMIT",
        ComplianceImmutableAuditLog.entity_id == request.idempotency_key,
        ComplianceImmutableAuditLog.payload_hash == payload_hash,
    )
    prior = (await db.execute(prior_stmt)).scalars().first()
    if prior:
        return {"success": True, "idempotent_replay": True, "idempotency_key": request.idempotency_key, "results": []}

    resolved_rows: List[Dict[str, Any]] = []
    for index, row in enumerate(request.rows, start=1):
        resolution = await _resolve_row(db, row)
        if resolution.get("status") == "AMBIGUOUS" and row.get("selected_variant_id"):
            selected_stmt = (
                select(ItemVariant)
                .join(ItemVariant.item)
                .where(
                    ItemVariant.id == str(row["selected_variant_id"]),
                    ItemVariant.is_deleted == False,
                )
                .options(selectinload(ItemVariant.item))
            )
            selected_variant = (await db.execute(selected_stmt)).scalars().first()
            if selected_variant and selected_variant.item:
                resolution = {"status": "MATCHED", "match_type": "USER_SELECTED", "match": _candidate_payload(selected_variant.item, selected_variant)}
        elif resolution.get("status") == "AMBIGUOUS" and row.get("selected_item_id"):
            selected_item = (await db.execute(select(Item).where(Item.id == str(row["selected_item_id"]), Item.is_deleted == False))).scalars().first()
            if selected_item:
                resolution = {"status": "MATCHED", "match_type": "USER_SELECTED", "match": _candidate_payload(selected_item)}
        if target == "ITEM_MASTER":
            barcode = _text(row, "barcode", "Barcode", "BARCODE_NO", "ean", "upc")
            sku = _text(row, "sku", "SKU", "variant_sku", "SKU_CODE", "SKU_PREVIEW")
            style_code = _text(row, "style_code", "styleCode", "styleArticle", "style", "article", "ARTICLE_STYLE_CODE", "item_code")
            item_name = _text(row, "item_name", "itemName", "name", "ITEM_DESCRIPTION", "product_name") or style_code or sku or barcode

            if not (barcode or sku or style_code):
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "At least one identifier (Barcode, SKU, or Style Code) is required."})

            if barcode:
                existing_bc = (await db.execute(
                    select(ItemBarcode).where(ItemBarcode.company_id == company_id, ItemBarcode.barcode == barcode.strip().upper(), ItemBarcode.is_deleted == False)
                )).scalars().first()
                if existing_bc:
                    raise HTTPException(status_code=409, detail={"row_number": row.get("rowNumber", index), "message": f"Barcode '{barcode}' already exists in database."})

            if sku:
                existing_sku = (await db.execute(
                    select(ItemVariant).where(ItemVariant.company_id == company_id, ItemVariant.variant_sku == sku.strip().upper(), ItemVariant.is_deleted == False)
                )).scalars().first()
                if existing_sku:
                    raise HTTPException(status_code=409, detail={"row_number": row.get("rowNumber", index), "message": f"SKU '{sku}' already exists in database."})

            resolved_rows.append({
                "row": row,
                "item_name": item_name,
                "item_code": style_code or sku or barcode,
                "style_code": style_code or sku or barcode,
                "barcode": barcode,
                "sku": sku,
            })
            continue

        if target in {"PRICE_BOOK", "PURCHASE_INWARD", "STOCK_ADJUSTMENT", "SALES_RETURN", "LABEL_PRINT"} and resolution.get("status") != "MATCHED":
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "status": resolution.get("status"), "message": "Every row must resolve to one product before commit."})

        if target == "PURCHASE_INWARD":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Matched canonical item has no legacy inventory product for GRN posting."})
            quantity = row.get("quantity", row.get("qty"))
            cost_price = row.get("costPrice", row.get("price", row.get("sellingPrice")))
            if quantity is None or float(quantity) <= 0 or cost_price is None:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Quantity and cost price are required for Purchase Inward."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity, "cost_price": cost_price})
            continue

        if target == "STOCK_ADJUSTMENT":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Matched item has no inventory product for stock adjustment."})
            quantity = row.get("quantity", row.get("qty"))
            if quantity is None or float(quantity) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A positive quantity is required for Stock Adjustment."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity})
            continue

        if target == "SALES_RETURN":
            match = resolution["match"]
            product_stmt = select(Product).where(
                Product.company_id == company_id,
                Product.is_deleted == False,
                (Product.item_id == match["item_id"]) | (Product.barcode == match.get("barcode")),
            )
            product = (await db.execute(product_stmt)).scalars().first()
            quantity = row.get("quantity", row.get("qty"))
            if not product or quantity is None or float(quantity) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A matched product and positive return quantity are required."})
            resolved_rows.append({"row": row, "match": match, "product": product, "quantity": quantity})
            continue

        if target == "LABEL_PRINT":
            quantity = row.get("quantity", row.get("qty", 1))
            if float(quantity or 0) <= 0:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "A positive quantity is required for Label Printing."})
            resolved_rows.append({"row": row, "match": resolution["match"], "quantity": quantity})
            continue

        mrp = row.get("mrp")
        selling_price = row.get("sellingPrice", row.get("price"))
        cost_price = row.get("costPrice")
        if mrp is None or selling_price is None:
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "MRP and selling price are required for Price Book imports."})
        if float(selling_price) > float(mrp):
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Selling price cannot be greater than MRP."})

        match = resolution["match"]
        entry_request = PriceBookEntryCreateRequest(
            item_id=match["item_id"],
            variant_id=match.get("variant_id"),
            min_quantity=float(row.get("quantity", row.get("qty", 1)) or 1),
            selling_price=float(selling_price),
            mrp=float(mrp),
            cost_price=float(cost_price) if cost_price is not None and str(cost_price).strip() else None,
        )
        resolved_rows.append({"row": row, "match": match, "request": entry_request})

    results: List[Dict[str, Any]] = []
    purchase_items: List[PurchaseReceiptItemCreate] = []
    return_items: List[SalesReturnItemCreate] = []
    created_styles_map: Dict[str, Any] = {}
    try:
        for index, resolved in enumerate(resolved_rows, start=1):
            if target == "ITEM_MASTER":
                row = resolved["row"]
                style_code = resolved["style_code"]
                clean_barcode = (resolved.get("barcode") or "").strip().upper()
                clean_sku = (resolved.get("sku") or "").strip().upper()

                # 1. Resolve or create parent Item
                if style_code in created_styles_map:
                    item = created_styles_map[style_code]
                else:
                    item_stmt = select(Item).where(
                        Item.company_id == company_id,
                        Item.item_code == style_code,
                        Item.is_deleted == False
                    )
                    existing_item = (await db.execute(item_stmt)).scalars().first()
                    if existing_item:
                        item = existing_item
                    else:
                        cat_raw = _text(row, "category", "Category", "MERCHANDISE_CATEGORY") or "Footwear"
                        dept_raw = _text(row, "department", "Department", "MERCHANDISE_DEPARTMENT")
                        cat = "Footwear" if "footwear" in (cat_raw + " " + (dept_raw or "")).lower() else cat_raw
                        dept = dept_raw or ("Footwear" if cat == "Footwear" else None)
                        brand = _text(row, "brand", "Brand", "BRAND_NAME")
                        hsn = _text(row, "hsn", "hsn_code", "HSN_CODE", "HSN") or "64041990"
                        uom = _text(row, "uom", "UOM") or "PRS"
                        tax_rate = float(row.get("tax_rate", row.get("gst", row.get("GST_RATE_PERCENT", 18))) or 18)
                        buying_price = float(row.get("buyingPrice", row.get("buying_price", row.get("BUYING_PRICE", 0))) or 0)
                        cost_price = float(row.get("costPrice", row.get("cost_price", row.get("LANDED_COST_PRICE", 0))) or 0)
                        mrp = float(row.get("mrp", row.get("MRP", 0)) or 0)
                        selling_price = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", 0))) or 0)

                        item = await UniversalItemMasterService.create_item(
                            session=db,
                            company_id=company_id,
                            item_code=style_code,
                            item_name=resolved["item_name"],
                            category=cat,
                            department=dept,
                            brand=brand,
                            style_code=style_code,
                            tax_rate=tax_rate,
                            mrp=mrp,
                            selling_price=selling_price,
                            cost_price=cost_price,
                            buying_price=buying_price if buying_price > 0 else None,
                            primary_uom=uom,
                            hsn_code=hsn,
                            branch_id=getattr(current_user, "branch_id", None) or "BR-001",
                            commit=False,
                        )
                    created_styles_map[style_code] = item

                # 2. Create ItemVariant
                color = _text(row, "color", "colour", "COLOR")
                size = _text(row, "size", "SIZE")
                if not clean_sku:
                    clean_sku = f"{style_code}-{color}-{size}".upper() if (color and size) else f"{style_code}-VAR-{index}"

                attrs = {
                    "color": color,
                    "size": size,
                    "collection_type": _text(row, "collection_type", "COLLECTION_TYPE"),
                    "gender": _text(row, "gender", "GENDER"),
                    "product_type": _text(row, "product_type", "PRODUCT_TYPE"),
                    "design_attribute": _text(row, "design_attribute", "DESIGN_ATTRIBUTE"),
                    "heel_type": _text(row, "heel_type", "HEEL_TYPE"),
                    "upper_material": _text(row, "upper_material", "UPPER_MATERIAL"),
                    "outsole_material": _text(row, "outsole_material", "OUTSOLE_MATERIAL"),
                    "purchase_class": _text(row, "purchase_class", "PURCHASE_CLASS"),
                }
                attrs = {k: v for k, v in attrs.items() if v}

                row_mrp = float(row.get("mrp", row.get("MRP", item.mrp)) or item.mrp or 0)
                row_selling = float(row.get("sellingPrice", row.get("price", row.get("SELLING_PRICE", item.selling_price))) or item.selling_price or 0)
                row_cost = float(row.get("costPrice", row.get("cost_price", row.get("LANDED_COST_PRICE", item.cost_price))) or item.cost_price or 0)

                variant_stmt = select(ItemVariant).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == clean_sku,
                    ItemVariant.is_deleted == False
                )
                variant = (await db.execute(variant_stmt)).scalars().first()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        item_id=item.id,
                        variant_sku=clean_sku,
                        variant_name=f"{style_code} {color} {size}".strip() or item.item_name,
                        attributes_json=attrs,
                        mrp=Decimal(str(row_mrp)),
                        selling_price=Decimal(str(row_selling)),
                        cost_price=Decimal(str(row_cost)),
                        is_active=True,
                    )
                    db.add(variant)
                    await db.flush()

                # 3. Create ItemBarcode
                if clean_barcode:
                    bc_stmt = select(ItemBarcode).where(
                        ItemBarcode.company_id == company_id,
                        ItemBarcode.barcode == clean_barcode,
                        ItemBarcode.is_deleted == False
                    )
                    existing_bc = (await db.execute(bc_stmt)).scalars().first()
                    if not existing_bc:
                        tax_inc = _text(row, "tax_inclusive_yn", "TAX_INCLUSIVE_YN").upper() == "Y" if _text(row, "tax_inclusive_yn", "TAX_INCLUSIVE_YN") else None
                        barcode_entity = ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            company_id=company_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=clean_barcode,
                            barcode_type="EAN13" if len(clean_barcode) == 13 and clean_barcode.isdigit() else "CUSTOM",
                            is_primary=True,
                            is_tax_inclusive=tax_inc,
                        )
                        db.add(barcode_entity)

                # 4. Warehouse Location
                wh_code = _text(row, "warehouse_code", "WAREHOUSE_CODE", "warehouse_id")
                reorder = row.get("reorder_level", row.get("REORDER_LEVEL"))
                if wh_code and reorder is not None:
                    try:
                        loc_stmt = select(ItemWarehouseLocation).where(
                            ItemWarehouseLocation.item_id == item.id,
                            ItemWarehouseLocation.warehouse_id == wh_code,
                            ItemWarehouseLocation.is_deleted == False
                        )
                        existing_loc = (await db.execute(loc_stmt)).scalars().first()
                        if not existing_loc:
                            db.add(ItemWarehouseLocation(
                                id=f"loc_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                item_id=item.id,
                                warehouse_id=wh_code,
                                min_reorder_level=Decimal(str(reorder)),
                            ))
                    except Exception:
                        pass

                # 5. Price Book Entry (if requested)
                price_mode = (request.price_mode or "DO_NOT_CREATE").upper().strip()
                if price_mode in {"CREATE_AS_DRAFT", "CREATE_LIVE_RETAIL"}:
                    pb_id = request.price_book_id
                    if not pb_id:
                        pb_stmt = select(PriceBook).where(
                            PriceBook.company_id == company_id,
                            PriceBook.is_default == True,
                            PriceBook.is_deleted == False
                        )
                        default_pb = (await db.execute(pb_stmt)).scalars().first()
                        if not default_pb:
                            default_pb = PriceBook(
                                id=f"pb_{uuid.uuid4().hex[:12]}",
                                company_id=company_id,
                                name="Default Retail Price Book",
                                code=f"PB-RETAIL-{company_id}",
                                currency="INR",
                                is_default=True,
                                status="ACTIVE" if price_mode == "CREATE_LIVE_RETAIL" else "DRAFT",
                            )
                            db.add(default_pb)
                            await db.flush()
                        pb_id = default_pb.id

                    pbe_stmt = select(PriceBookEntry).where(
                        PriceBookEntry.price_book_id == pb_id,
                        PriceBookEntry.item_id == item.id,
                        PriceBookEntry.variant_id == variant.id,
                        PriceBookEntry.is_deleted == False
                    )
                    existing_pbe = (await db.execute(pbe_stmt)).scalars().first()
                    if not existing_pbe:
                        db.add(PriceBookEntry(
                            id=f"pbe_{uuid.uuid4().hex[:12]}",
                            company_id=company_id,
                            price_book_id=pb_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            min_quantity=Decimal("1.0000"),
                            selling_price=Decimal(str(row_selling)),
                            mrp=Decimal(str(row_mrp)),
                            cost_price=Decimal(str(row_cost)) if row_cost > 0 else None,
                        ))

                results.append({
                    "row_number": row.get("rowNumber", index),
                    "status": "CREATED",
                    "item_id": item.id,
                    "item_code": item.item_code,
                    "variant_sku": variant.variant_sku,
                    "barcode": clean_barcode,
                })
            elif target == "PRICE_BOOK":
                entry = await PricingEngine.add_price_book_entry(
                    session=db,
                    company_id=company_id,
                    price_book_id=request.price_book_id,
                    req=resolved["request"],
                    created_by=user_id,
                    commit=False,
                )
                results.append({"row_number": resolved["row"].get("rowNumber"), "status": "COMMITTED", "entry_id": entry.id, "item_id": entry.item_id})
            elif target == "STOCK_ADJUSTMENT":
                row = resolved["row"]
                movement_type = str(row.get("movement_type", row.get("movementType", "ADJUSTMENT_IN"))).upper()
                if movement_type not in {"ADJUSTMENT_IN", "ADJUSTMENT_OUT"}:
                    raise HTTPException(status_code=422, detail=f"Invalid stock adjustment movement type: {movement_type}")
                movement = await StockAccountingBoundaryService.record_stock_movement(
                    session=db,
                    company_id=company_id,
                    req=StockMovementRecordRequest(
                        product_id=resolved["product"].id,
                        quantity=float(resolved["quantity"]),
                        movement_type=movement_type,
                        reference_doc_type="UNIVERSAL_IMPORT",
                        reference_doc_id=request.idempotency_key,
                        warehouse_id=request.warehouse_id,
                        batch=row.get("batch_no", row.get("batch")),
                        unit_cost=float(row.get("costPrice", 0) or 0),
                        remarks=request.reason,
                        source_module="UNIVERSAL_IMPORT",
                    ),
                    user_id=user_id,
                    commit=False,
                )
                results.append({"row_number": row.get("rowNumber"), "status": "ADJUSTED", "movement_id": movement.id, "product_id": resolved["product"].id})
            elif target == "SALES_RETURN":
                return_items.append(SalesReturnItemCreate(
                    product_id=resolved["product"].id,
                    item_id=resolved["match"].get("item_id"),
                    code=resolved["product"].code,
                    name=resolved["product"].name,
                    quantity=resolved["quantity"],
                    price=0,
                    total_amount=0,
                ))
            elif target == "LABEL_PRINT":
                row = resolved["row"]
                match = resolved["match"]
                results.append({
                    "row_number": row.get("rowNumber"),
                    "status": "PRINT_READY",
                    "item_id": match.get("item_id"),
                    "variant_id": match.get("variant_id"),
                    "barcode": match.get("barcode") or row.get("barcode"),
                    "item_name": match.get("item_name"),
                    "quantity": resolved["quantity"],
                    "mrp": row.get("mrp", match.get("mrp")),
                    "selling_price": row.get("sellingPrice", row.get("price", match.get("selling_price"))),
                })
            else:
                row = resolved["row"]
                purchase_items.append(PurchaseReceiptItemCreate(
                    product_id=resolved["product"].id,
                    item_id=resolved["match"].get("item_id"),
                    code=resolved["product"].code,
                    name=resolved["product"].name,
                    batch_no=row.get("batch_no", row.get("batch")),
                    mrp=float(row.get("mrp")) if row.get("mrp") is not None else None,
                    quantity_received=resolved["quantity"],
                    cost_price=resolved["cost_price"],
                    gst_rate=row.get("gst_rate", row.get("gst", 18)),
                ))

        if target == "PURCHASE_INWARD":
            receipt = await PurchaseService(db, tenant).create_purchase_receipt(PurchaseReceiptCreate(
                id=f"imp-grn-{payload_hash[:12]}",
                receipt_no=request.receipt_no or f"GRN-IMP-{payload_hash[:10].upper()}",
                supplier_id=request.supplier_id,
                warehouse_id=request.warehouse_id,
                notes="Universal Import Purchase Inward",
                items=purchase_items,
            ))
            results = [
                {"row_number": row.get("rowNumber"), "status": "RECEIVED", "receipt_id": receipt.id, "product_id": item.product_id}
                for row, item in zip(request.rows, purchase_items)
            ]
        if target == "SALES_RETURN":
            sales_return = await SalesService(db, tenant).create_sales_return(
                SalesReturnCreate(
                    id=f"imp-ret-{payload_hash[:12]}",
                    return_no=request.return_no,
                    original_invoice_id=request.original_invoice_id,
                    reason=request.reason,
                    items=return_items,
                ),
                idempotency_key=request.idempotency_key,
            )
            results = [
                {"row_number": item["row"].get("rowNumber"), "status": "RETURNED", "return_id": sales_return.id, "product_id": item["product"].id}
                for item in resolved_rows
            ]

        audit = ComplianceImmutableAuditLog(
            id=f"uil_{payload_hash[:16]}",
            company_id=company_id,
            event_type="UNIVERSAL_IMPORT_COMMIT",
            entity_name="price_book_entries" if target == "PRICE_BOOK" else "items" if target == "ITEM_MASTER" else "purchase_receipts" if target == "PURCHASE_INWARD" else "stock_movements",
            entity_id=request.idempotency_key,
            actor_user_id=user_id,
            before_state_json=None,
            after_state_json=json.dumps({"target": target, "price_book_id": request.price_book_id, "row_count": len(results)}),
            action_summary=f"Committed {len(results)} Price Book import rows",
            payload_hash=payload_hash,
        )
        db.add(audit)
        await db.commit()
    except Exception as error:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Universal import rolled back: {error}") from error
    return {"success": True, "idempotent_replay": False, "idempotency_key": request.idempotency_key, "results": results}