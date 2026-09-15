"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-15
Modified     : 2026-09-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Barcode Billing CSV Import Engine
"""

from __future__ import annotations

import csv
import io
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.auth import User

router = APIRouter()

# ---------------------------------------------------------------------------
# Format Tier Labels
# ---------------------------------------------------------------------------

FORMAT_LABELS: Dict[str, str] = {
    "FORMAT_1": "Barcode Only",
    "FORMAT_2": "Barcode + Quantity",
    "FORMAT_3": "Barcode + Quantity + Selling Price",
    "FORMAT_4": "Barcode + Quantity + Rate",
    "FORMAT_5": "Barcode + Quantity + Discount %",
    "FORMAT_6": "Full Billing Import",
    "FORMAT_PDT": "PDT Tilde/Pipe Delimited",
}

# Header alias normalisation map
HEADER_ALIASES: Dict[str, str] = {
    "barcode": "barcode", "ean": "barcode", "upc": "barcode",
    "barcode_no": "barcode", "code": "barcode", "ean13": "barcode",
    "scan_code": "barcode", "bar_code": "barcode",
    "quantity": "quantity", "qty": "quantity", "pcs": "quantity",
    "units": "quantity", "count": "quantity", "nos": "quantity",
    "selling_price": "selling_price", "price": "selling_price",
    "sp": "selling_price", "sale_price": "selling_price", "sell_price": "selling_price",
    "rate": "rate", "unit_rate": "rate", "invoice_rate": "rate",
    "discount_percent": "discount_percent", "discount": "discount_percent",
    "disc": "discount_percent", "disc_pct": "discount_percent",
    "off%": "discount_percent", "disc%": "discount_percent",
    "mrp": "mrp", "max_price": "mrp", "mrp_price": "mrp", "list_price": "mrp",
    "gst_rate": "gst_rate", "gst": "gst_rate", "tax_rate": "gst_rate",
    "hsn_code": "hsn_code", "hsn": "hsn_code", "hsn_no": "hsn_code",
    "tariff_code": "hsn_code",
    "sku": "sku", "sku_code": "sku", "item_code": "sku",
    "stock_no": "sku", "article_no": "sku",
}

DISCRETE_UOMS = {"PCS", "PC", "NOS", "NO", "PAIR", "PRS", "BOX", "SET", "UNIT", "DOZ", "EA"}


def _norm_header(h: str) -> str:
    return HEADER_ALIASES.get(h.strip().lower().replace(" ", "_"), h.strip().lower())


def _detect_delimiter(first_line: str) -> str:
    if "~" in first_line:
        return "~"
    if "|" in first_line and "," not in first_line:
        return "|"
    if "\t" in first_line:
        return "\t"
    return ","


def _detect_format(canonical_headers: List[str], is_pdt: bool) -> str:
    if is_pdt:
        return "FORMAT_PDT"
    h = set(canonical_headers)
    if "mrp" in h or "gst_rate" in h or "hsn_code" in h:
        return "FORMAT_6"
    if "discount_percent" in h:
        return "FORMAT_5"
    if "rate" in h:
        return "FORMAT_4"
    if "selling_price" in h:
        return "FORMAT_3"
    if ("barcode" in h or "sku" in h) and "quantity" in h:
        return "FORMAT_2"
    if "barcode" in h or "sku" in h:
        return "FORMAT_1"
    return "FORMAT_2"


# ---------------------------------------------------------------------------
# GST Computation — selling price basis, never MRP
# ---------------------------------------------------------------------------

def _compute_gst(selling_price: Decimal, gst_rate: Decimal, qty: Decimal) -> Dict[str, float]:
    two = Decimal("0.01")
    taxable_val = (selling_price * qty / (1 + gst_rate / 100)).quantize(two, rounding=ROUND_HALF_UP)
    cgst = (taxable_val * gst_rate / 2 / 100).quantize(two, rounding=ROUND_HALF_UP)
    sgst = cgst
    line_total = (selling_price * qty).quantize(two, rounding=ROUND_HALF_UP)
    return {
        "taxable_value": float(taxable_val),
        "cgst_amount": float(cgst),
        "sgst_amount": float(sgst),
        "line_total": float(line_total),
    }


# ---------------------------------------------------------------------------
# Catalog Lookup — Barcode or SKU strictly verified against database
# ---------------------------------------------------------------------------

async def _lookup_catalog(
    db: AsyncSession, company_id: str, identifier: str, sku_hint: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    identifier = identifier.strip()
    sku_hint = sku_hint.strip() if sku_hint else None
    sql = text("""
        SELECT
            p.id                            AS product_id,
            p.name                          AS item_name,
            COALESCE(p.code, p.sku, '')     AS sku,
            p.barcode                       AS barcode,
            COALESCE(p.mrp, 0)              AS catalog_mrp,
            COALESCE(p.price, p.mrp, 0)     AS catalog_selling_price,
            COALESCE(p.gst_percentage, 0)   AS gst_rate,
            COALESCE(p.hsn_code, '')        AS hsn_code,
            COALESCE(p.stock, 0)            AS available_stock,
            'PCS'                           AS uom,
            COALESCE(p.brand, '')           AS brand,
            COALESCE(p.color, '')           AS color,
            COALESCE(p.size, '')            AS size_variant
        FROM products p
        WHERE p.company_id = :company_id
          AND p.is_deleted = FALSE
          AND (
            p.barcode = :identifier
            OR :identifier = ANY(p.secondary_barcodes)
            OR p.code = :identifier
            OR p.sku = :identifier
            OR (:sku_hint IS NOT NULL AND (p.code = :sku_hint OR p.sku = :sku_hint))
          )
        LIMIT 1
    """)
    try:
        res = await db.execute(sql, {
            "company_id": company_id,
            "identifier": identifier,
            "sku_hint": sku_hint,
        })
        row = res.mappings().first()
        return dict(row) if row else None
    except Exception:
        return None



# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CsvValidateRequest(BaseModel):
    raw_text: str = Field(..., description="Raw CSV or PDT file content as text string")
    delimiter_hint: Optional[str] = Field(None, description="Delimiter override (null = auto-detect)")


class CsvRowResult(BaseModel):
    row_index: int
    barcode: str
    status: str  # VALID | WARNING | REJECTED
    resolved_item: Optional[str] = None
    resolved_sku: Optional[str] = None
    product_id: Optional[str] = None
    hsn_code: Optional[str] = None
    quantity: Optional[float] = None
    catalog_mrp: Optional[float] = None
    effective_selling_price: Optional[float] = None
    mrp_markdown_pct: Optional[int] = None
    mrp_markdown_display: Optional[str] = None
    gst_rate: Optional[float] = None
    taxable_value: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    line_total: Optional[float] = None
    available_stock: Optional[int] = None
    uom: Optional[str] = None
    warnings: Optional[List[str]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class CsvValidateResponse(BaseModel):
    format_detected: str
    format_label: str
    total_rows: int
    valid_rows: int
    rejected_rows: int
    warning_rows: int
    can_proceed: bool
    rows: List[CsvRowResult]


# ---------------------------------------------------------------------------
# Row Validator
# ---------------------------------------------------------------------------

def _err(idx: int, bc: str, code: str, msg: str) -> CsvRowResult:
    return CsvRowResult(row_index=idx, barcode=bc, status="REJECTED",
                        error_code=code, error_message=msg)


async def _validate_row(
    idx: int, raw_id: str, raw_sku: Optional[str], raw_qty: str,
    raw_price: Optional[str], raw_disc: Optional[str],
    raw_mrp_csv: Optional[str], raw_gst_csv: Optional[str],
    fmt: str, db: AsyncSession, company_id: str,
) -> CsvRowResult:

    identifier = raw_id.strip()
    if not identifier and raw_sku:
        identifier = raw_sku.strip()

    if not identifier:
        return _err(idx, "(empty)", "SMRITI-BILL-001",
                    "Row has no barcode or SKU. Please provide a valid barcode or SKU present in the database.")

    # Quantity
    try:
        qty = Decimal(str(raw_qty).strip()) if raw_qty and raw_qty.strip() else Decimal("1")
    except Exception:
        return _err(idx, identifier, "SMRITI-BILL-008",
                    f"The quantity '{raw_qty}' for '{identifier}' is not a valid number.")
    if qty <= 0:
        return _err(idx, identifier, "SMRITI-BILL-003",
                    f"Quantity must be at least 1 for '{identifier}'.")
    if qty > 99999:
        return _err(idx, identifier, "SMRITI-BILL-003",
                    f"Quantity {qty} for '{identifier}' exceeds the maximum of 99,999 units.")

    # Strict Database Catalog lookup: ONLY items present in database are allowed
    catalog = await _lookup_catalog(db, company_id, identifier, raw_sku)
    if not catalog:
        return _err(idx, identifier, "SMRITI-BILL-001",
                    f"'{identifier}' is not present in the database. "
                    f"Only valid barcodes or SKUs registered in the product catalogue can be added to billing.")

    barcode = catalog.get("barcode") or identifier
    catalog_mrp = Decimal(str(catalog["catalog_mrp"]))
    catalog_sp = Decimal(str(catalog["catalog_selling_price"]))
    gst_rate = Decimal(str(catalog["gst_rate"]))
    available_stock = int(catalog["available_stock"])
    uom = str(catalog.get("uom") or "PCS").upper().strip()

    # Discrete UOM fractional guard
    if uom in DISCRETE_UOMS and qty != qty.to_integral_value():
        return _err(idx, barcode, "SMRITI-BILL-004",
                    f"Fractional quantities are not permitted for {uom} items (barcode {barcode}). "
                    f"Please enter a whole number.")

    effective_sp = catalog_sp
    warnings: List[str] = []

    # Price resolution per format
    if fmt in ("FORMAT_3", "FORMAT_PDT") and raw_price and raw_price.strip():
        try:
            submitted = Decimal(raw_price.strip())
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-008",
                        f"Selling price '{raw_price}' for barcode {barcode} is not a valid number.")
        if submitted < 0:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"Selling price cannot be negative for barcode {barcode}.")
        if submitted > catalog_mrp:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"The entered price ₹{submitted} exceeds the legal MRP ₹{catalog_mrp} "
                        f"for barcode {barcode}. Items cannot be billed above MRP.")
        effective_sp = submitted

    elif fmt == "FORMAT_4" and raw_price and raw_price.strip():
        try:
            submitted = Decimal(raw_price.strip())
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-008",
                        f"Rate '{raw_price}' for barcode {barcode} is not a valid number.")
        if submitted < 0:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"Rate cannot be negative for barcode {barcode}.")
        if submitted > catalog_mrp:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"The entered rate ₹{submitted} exceeds the legal MRP ₹{catalog_mrp} "
                        f"for barcode {barcode}. Items cannot be billed above MRP.")
        effective_sp = submitted

    elif fmt == "FORMAT_5" and raw_disc and raw_disc.strip():
        try:
            disc_pct = Decimal(raw_disc.strip())
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-006",
                        f"Discount percent '{raw_disc}' for barcode {barcode} is not a valid number.")
        if disc_pct < 0 or disc_pct > 100:
            return _err(idx, barcode, "SMRITI-BILL-006",
                        f"Discount percent must be 0–100 for barcode {barcode}.")
        effective_sp = catalog_sp * (1 - disc_pct / 100)

    elif fmt == "FORMAT_6":
        if raw_mrp_csv and raw_mrp_csv.strip():
            try:
                csv_mrp = Decimal(raw_mrp_csv.strip())
                if csv_mrp > catalog_mrp:
                    return _err(idx, barcode, "SMRITI-BILL-002",
                                f"The MRP in your import file (₹{csv_mrp}) exceeds catalogue MRP "
                                f"(₹{catalog_mrp}) for barcode {barcode}. Statutory violation.")
            except Exception:
                pass
        if raw_price and raw_price.strip():
            try:
                submitted = Decimal(raw_price.strip())
                if submitted > catalog_mrp:
                    return _err(idx, barcode, "SMRITI-BILL-002",
                                f"Selling price ₹{submitted} exceeds MRP ₹{catalog_mrp} "
                                f"for barcode {barcode}.")
                effective_sp = submitted
            except Exception:
                pass
        # GST advisory mismatch warning — catalog wins always
        if raw_gst_csv and raw_gst_csv.strip():
            try:
                csv_gst = Decimal(raw_gst_csv.strip())
                if abs(csv_gst - gst_rate) > Decimal("0.01"):
                    warnings.append(
                        f"GST rate in your file ({csv_gst}%) differs from catalogue ({gst_rate}%). "
                        f"The catalogue rate is used for computation. [SMRITI-BILL-010]"
                    )
            except Exception:
                pass

    # Final MRP guard
    if effective_sp > catalog_mrp:
        return _err(idx, barcode, "SMRITI-BILL-002",
                    f"Effective selling price ₹{effective_sp} exceeds legal MRP ₹{catalog_mrp} "
                    f"for barcode {barcode}.")

    # Stock check (soft warn)
    status = "VALID"
    if available_stock < int(qty):
        warnings.append(
            f"Only {available_stock} unit(s) of '{catalog['item_name']}' are available. "
            f"Reduce quantity or contact the warehouse. [SMRITI-BILL-005]"
        )
        status = "WARNING"
    elif warnings:
        status = "WARNING"

    # GST computation on effective_selling_price — NEVER on MRP
    gst_result = _compute_gst(effective_sp, gst_rate, qty)

    # MRP markdown — display only, does NOT feed back into price
    markdown_pct = 0
    markdown_display = ""
    if catalog_mrp > 0 and effective_sp < catalog_mrp:
        markdown_pct = int(round((catalog_mrp - effective_sp) / catalog_mrp * 100))
        markdown_display = f"{markdown_pct}% off MRP"

    return CsvRowResult(
        row_index=idx,
        barcode=barcode,
        status=status,
        product_id=str(catalog["product_id"]) if catalog.get("product_id") else None,
        resolved_item=catalog["item_name"],
        resolved_sku=catalog["sku"],
        hsn_code=str(catalog.get("hsn_code") or "") or None,
        quantity=float(qty),
        catalog_mrp=float(catalog_mrp),
        effective_selling_price=float(effective_sp),
        mrp_markdown_pct=markdown_pct or None,
        mrp_markdown_display=markdown_display or None,
        gst_rate=float(gst_rate),
        taxable_value=gst_result["taxable_value"],
        cgst_amount=gst_result["cgst_amount"],
        sgst_amount=gst_result["sgst_amount"],
        line_total=gst_result["line_total"],
        available_stock=available_stock,
        uom=uom,
        warnings=warnings or None,
    )


# ---------------------------------------------------------------------------
# Input Parser
# ---------------------------------------------------------------------------

def _parse_input(raw_text: str, delimiter_hint: Optional[str]):
    raw_text = raw_text.lstrip("\ufeff\ufffe")
    lines = [l for l in raw_text.splitlines() if l.strip()]
    if not lines:
        return False, [], []

    first_line = lines[0]
    delimiter = delimiter_hint or _detect_delimiter(first_line)

    is_pdt = delimiter in ("~", "|") and not any(
        k in first_line.lower() for k in ("barcode", "qty", "quantity", "ean")
    )

    if is_pdt:
        data_rows = []
        for line in lines:
            parts = [p.strip() for p in line.split(delimiter)]
            if not parts or not parts[0]:
                continue
            row: Dict[str, str] = {"barcode": parts[0]}
            if len(parts) > 1:
                row["quantity"] = parts[1]
            if len(parts) > 2:
                row["selling_price"] = parts[2]
            data_rows.append(row)
        return True, list(data_rows[0].keys()) if data_rows else [], data_rows

    reader = csv.DictReader(io.StringIO(raw_text), delimiter=delimiter)
    raw_headers = reader.fieldnames or []
    canonical_headers = [_norm_header(h) for h in raw_headers]
    header_map = {raw: can for raw, can in zip(raw_headers, canonical_headers)}

    data_rows = []
    for raw_row in reader:
        can_row = {header_map.get(k, _norm_header(k or "")): v for k, v in raw_row.items() if k is not None}
        data_rows.append(can_row)

    return False, canonical_headers, data_rows


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/csv/validate",
    response_model=CsvValidateResponse,
    summary="Validate and resolve a barcode billing CSV or PDT import",
    tags=["Barcode Billing CSV Import"],
)
async def validate_billing_csv(
    req: CsvValidateRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> CsvValidateResponse:
    """
    Accepts raw CSV or PDT text. Auto-detects format tier from headers.
    Resolves barcodes against the inventory catalog.
    Returns per-row validation with HREP error codes.

    GST is computed on effective selling_price — never on MRP.
    MRP markdown display is non-cascading (display only).
    Catalog GST rate and HSN are authoritative over any CSV-supplied values.
    """
    company_id = tenant.company_id
    is_pdt, canonical_headers, data_rows = _parse_input(req.raw_text, req.delimiter_hint)
    fmt = _detect_format(canonical_headers, is_pdt)

    results: List[CsvRowResult] = []
    for idx, row in enumerate(data_rows):
        raw_id = row.get("barcode") or row.get("sku") or ""
        sku_hint = row.get("sku") if row.get("barcode") else None
        result = await _validate_row(
            idx=idx,
            raw_id=raw_id,
            raw_sku=sku_hint,
            raw_qty=row.get("quantity", "1") or "1",
            raw_price=row.get("selling_price") or row.get("rate"),
            raw_disc=row.get("discount_percent"),
            raw_mrp_csv=row.get("mrp"),
            raw_gst_csv=row.get("gst_rate"),
            fmt=fmt,
            db=db,
            company_id=company_id,
        )
        results.append(result)

    valid_rows = sum(1 for r in results if r.status == "VALID")
    warning_rows = sum(1 for r in results if r.status == "WARNING")
    rejected_rows = sum(1 for r in results if r.status == "REJECTED")

    return CsvValidateResponse(
        format_detected=fmt,
        format_label=FORMAT_LABELS.get(fmt, fmt),
        total_rows=len(results),
        valid_rows=valid_rows,
        rejected_rows=rejected_rows,
        warning_rows=warning_rows,
        can_proceed=(valid_rows + warning_rows) > 0,
        rows=results,
    )
