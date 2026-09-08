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
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from ...models.audit import ComplianceImmutableAuditLog
from ...models.item_master import Item, ItemVariant
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
        if target == "ITEM_MASTER" and resolution.get("status") == "MATCHED":
            raise HTTPException(status_code=409, detail={"row_number": row.get("rowNumber", index), "message": "Item already exists. Item Master import creates new items only."})
        if target in {"PRICE_BOOK", "PURCHASE_INWARD", "STOCK_ADJUSTMENT", "SALES_RETURN", "LABEL_PRINT"} and resolution.get("status") != "MATCHED":
            raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "status": resolution.get("status"), "message": "Every row must resolve to one product before commit."})

        if target == "ITEM_MASTER":
            item_name = _text(row, "item_name", "itemName", "name", "product_name", "Product Name")
            item_code = _text(row, "item_code", "itemCode", "sku", "SKU", "styleArticle", "style", "article", "barcode")
            if not item_name or not item_code:
                raise HTTPException(status_code=422, detail={"row_number": row.get("rowNumber", index), "message": "Item name and item code, SKU, style, or barcode are required to create an item."})
            resolved_rows.append({"row": row, "item_name": item_name, "item_code": item_code})
            continue

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
    try:
        for resolved in resolved_rows:
            if target == "ITEM_MASTER":
                row = resolved["row"]
                item = await UniversalItemMasterService.create_item(
                    session=db,
                    company_id=company_id,
                    item_code=resolved["item_code"],
                    item_name=resolved["item_name"],
                    category=_text(row, "category", "Category") or "General",
                    tax_rate=float(row.get("tax_rate", row.get("gst", 18)) or 18),
                    mrp=float(row.get("mrp", 0) or 0),
                    selling_price=float(row.get("sellingPrice", row.get("price", 0)) or 0),
                    cost_price=float(row.get("costPrice", 0) or 0),
                    primary_barcode=_text(row, "barcode", "Barcode") or None,
                    primary_uom=_text(row, "uom", "UOM") or "PCS",
                    hsn_code=_text(row, "hsn", "hsn_code", "HSN") or "64041990",
                    brand=_text(row, "brand", "Brand") or None,
                    branch_id=getattr(current_user, "branch_id", None) or "BR-001",
                    commit=False,
                )
                results.append({"row_number": row.get("rowNumber"), "status": "CREATED", "item_id": item.id, "item_code": item.item_code})
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