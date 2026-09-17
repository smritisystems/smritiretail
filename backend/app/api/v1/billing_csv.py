"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-15
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Barcode Billing CSV Import Engine & Persistent Audit Logging
"""

from __future__ import annotations

import csv
import hashlib
import io
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...core.gst_engine import calculate_line_item_tax, round_currency
from ...models.auth import User
from ...models.billing_csv import BillingCsvTemplate, BillingCsvImportLog

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
    "FORMAT_6": "Full Statutory Billing Import",
    "FORMAT_PDT": "PDT Tilde/Pipe Delimited",
    "FORMAT_B2B_RATE": "B2B Wholesale Rate & Tax Mode",
    "FORMAT_COMMERCIAL_DISC": "Commercial Dual-Discount & Tax Mode",
}

# Header alias normalisation map
HEADER_ALIASES: Dict[str, str] = {
    # Barcode / SKU
    "barcode": "barcode", "ean": "barcode", "upc": "barcode",
    "barcode_no": "barcode", "code": "barcode", "ean13": "barcode",
    "scan_code": "barcode", "bar_code": "barcode",
    "sku": "sku", "sku_code": "sku", "item_code": "sku",
    "stock_no": "sku", "article_no": "sku",

    # Quantity
    "quantity": "quantity", "qty": "quantity", "pcs": "quantity",
    "units": "quantity", "count": "quantity", "nos": "quantity",

    # Price / Rate
    "selling_price": "selling_price", "price": "selling_price",
    "sp": "selling_price", "sale_price": "selling_price", "sell_price": "selling_price",
    "rate": "rate", "unit_rate": "rate", "invoice_rate": "rate", "base_rate": "rate",
    "base_price": "rate",

    # Discounts
    "discount_percent": "discount_percent", "discount": "discount_percent",
    "disc": "discount_percent", "disc_pct": "discount_percent",
    "off%": "discount_percent", "disc%": "discount_percent",
    "discount_amount": "discount_amount", "disc_amt": "discount_amount",
    "disc_val": "discount_amount", "discount_val": "discount_amount",

    # Statutory & Catalog
    "mrp": "mrp", "max_price": "mrp", "mrp_price": "mrp", "list_price": "mrp",
    "gst_rate": "gst_rate", "gst": "gst_rate", "tax_rate": "gst_rate",
    "hsn_code": "hsn_code", "hsn": "hsn_code", "hsn_no": "hsn_code",
    "tariff_code": "hsn_code",

    # Tax Inclusive / Exclusive Policy
    "is_tax_inclusive": "is_tax_inclusive", "tax_inclusive": "is_tax_inclusive",
    "tax_mode": "is_tax_inclusive", "inclusive": "is_tax_inclusive",
    "price_type": "is_tax_inclusive", "tax_type": "is_tax_inclusive",
    "tax_inc": "is_tax_inclusive",

    # Batch, Expiry & Salesperson Attribution
    "batch_no": "batch_no", "batch": "batch_no", "lot": "batch_no",
    "expiry_date": "expiry_date", "exp_date": "expiry_date", "expiry": "expiry_date",
    "salesperson_id": "salesperson_id", "salesperson": "salesperson_id",
    "attendant": "salesperson_id", "staff": "salesperson_id",
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
    if "is_tax_inclusive" in h:
        if "discount_amount" in h or "discount_percent" in h:
            return "FORMAT_COMMERCIAL_DISC"
        return "FORMAT_B2B_RATE"
    if "mrp" in h or "gst_rate" in h or "hsn_code" in h:
        return "FORMAT_6"
    if "discount_percent" in h or "discount_amount" in h:
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


def _parse_tax_mode(raw: Optional[str], default_mode: Optional[bool] = None) -> Tuple[Optional[bool], Optional[str]]:
    """
    Parses tax mode aliases into a strict boolean.
    Returns (boolean_result, error_message).
    """
    if raw is None or not str(raw).strip():
        return default_mode if default_mode is not None else True, None

    v = str(raw).strip().lower()
    if v in ("1", "true", "yes", "y", "inc", "inclusive", "mrp", "tax_inc"):
        return True, None
    if v in ("0", "false", "no", "n", "exc", "exclusive", "base", "tax_exc"):
        return False, None

    return None, f"Invalid tax mode '{raw}'. Expected 'Inclusive' (INC) or 'Exclusive' (EXC)."


# ---------------------------------------------------------------------------
# GST Computation Helper (Canonical Math)
# ---------------------------------------------------------------------------

def _compute_gst(selling_price: Decimal, gst_rate: Decimal, qty: Decimal, is_tax_inclusive: bool = True) -> Dict[str, float]:
    tax_res = calculate_line_item_tax(
        unit_price=selling_price,
        quantity=qty,
        discount_amount=Decimal("0.00"),
        gst_rate=gst_rate,
        is_tax_inclusive=is_tax_inclusive,
        is_interstate=False,
    )
    return {
        "taxable_value": float(tax_res["taxable_value"]),
        "cgst_amount": float(tax_res["cgst_amount"]),
        "sgst_amount": float(tax_res["sgst_amount"]),
        "line_total": float(tax_res["total_amount"]),
    }


# ---------------------------------------------------------------------------
# Catalog Lookup — Barcode or SKU strictly verified against database
# ---------------------------------------------------------------------------


async def _lookup_catalog(
    db: AsyncSession, company_id: Optional[str], identifier: str, sku_hint: Optional[str] = None
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
        WHERE (p.company_id = CAST(:company_id AS VARCHAR) OR CAST(:company_id AS VARCHAR) IS NULL)
          AND p.is_deleted = FALSE
          AND (
            p.barcode = :identifier
            OR :identifier = ANY(p.secondary_barcodes)
            OR p.code = :identifier
            OR p.sku = :identifier
            OR (CAST(:sku_hint AS VARCHAR) IS NOT NULL AND (p.code = CAST(:sku_hint AS VARCHAR) OR p.sku = CAST(:sku_hint AS VARCHAR)))
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
    tax_inclusive_default: Optional[bool] = Field(None, description="Default tax policy override (true=MRP/Inclusive, false=Base/Exclusive)")
    register_id: Optional[str] = Field(None, description="Active POS register identifier")
    shift_id: Optional[str] = Field(None, description="Active POS shift identifier")
    file_name: Optional[str] = Field("uploaded.csv", description="Imported filename")


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
    is_tax_inclusive: bool = True
    tax_mode_display: str = "INCLUSIVE"
    mrp_markdown_pct: Optional[int] = None
    mrp_markdown_display: Optional[str] = None
    gst_rate: Optional[float] = None
    taxable_value: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    line_total: Optional[float] = None
    available_stock: Optional[int] = None
    uom: Optional[str] = None
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    salesperson_id: Optional[str] = None
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
    import_log_id: Optional[str] = None
    rows: List[CsvRowResult]


class CsvTemplateDTO(BaseModel):
    id: str
    template_code: str
    name: str
    description: Optional[str] = None
    delimiter: str
    has_header: bool
    default_tax_inclusive: bool
    column_mappings: Dict[str, Any]
    is_system: bool


class CsvTemplateCreate(BaseModel):
    template_code: str
    name: str
    description: Optional[str] = None
    delimiter: str = ","
    has_header: bool = True
    default_tax_inclusive: bool = True
    column_mappings: Dict[str, Any]


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
    raw_tax_inc: Optional[str] = None, raw_disc_amt: Optional[str] = None,
    raw_batch: Optional[str] = None, raw_exp: Optional[str] = None,
    raw_staff: Optional[str] = None, default_tax_inclusive: Optional[bool] = None,
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

    # Tax policy resolution
    is_tax_inclusive, tax_mode_err = _parse_tax_mode(raw_tax_inc, default_tax_inclusive)
    if tax_mode_err:
        return _err(idx, identifier, "SMRITI-VAL-TAX-001", tax_mode_err)
    if is_tax_inclusive is None:
        is_tax_inclusive = True

    tax_mode_display = "INCLUSIVE" if is_tax_inclusive else "EXCLUSIVE"

    # Strict Database Catalog lookup
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
    if fmt in ("FORMAT_3", "FORMAT_PDT", "FORMAT_B2B_RATE", "FORMAT_COMMERCIAL_DISC") and raw_price and raw_price.strip():
        try:
            submitted = Decimal(raw_price.strip())
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-008",
                        f"Price '{raw_price}' for barcode {barcode} is not a valid number.")
        if submitted < 0:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"Price cannot be negative for barcode {barcode}.")
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

    # Discount calculations
    disc_amount = Decimal("0.00")
    if raw_disc and raw_disc.strip() and fmt in ("FORMAT_COMMERCIAL_DISC", "FORMAT_5"):
        try:
            dp = Decimal(raw_disc.strip())
            if dp < 0 or dp > 100:
                return _err(idx, barcode, "SMRITI-BILL-006", f"Discount percent must be 0–100 for barcode {barcode}.")
            disc_amount += (effective_sp * qty * dp / Decimal("100.00"))
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-006", f"Discount percent '{raw_disc}' is invalid.")

    if raw_disc_amt and raw_disc_amt.strip():
        try:
            da = Decimal(raw_disc_amt.strip())
            if da < 0:
                return _err(idx, barcode, "SMRITI-BILL-006", f"Discount amount cannot be negative.")
            disc_amount += da
        except Exception:
            return _err(idx, barcode, "SMRITI-BILL-006", f"Discount amount '{raw_disc_amt}' is invalid.")

    disc_amount = min(disc_amount, effective_sp * qty)

    # Statutory MRP Guard:
    # 1. If Tax Inclusive: effective_sp <= catalog_mrp
    # 2. If Tax Exclusive: (effective_sp * (1 + gst_rate / 100)) <= catalog_mrp
    if is_tax_inclusive:
        if effective_sp > catalog_mrp:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"Effective selling price ₹{effective_sp:.2f} exceeds legal MRP ₹{catalog_mrp:.2f} "
                        f"for barcode {barcode}.")
    else:
        post_tax_unit = effective_sp * (Decimal("1.00") + (gst_rate / Decimal("100.00")))
        if post_tax_unit.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) > catalog_mrp:
            return _err(idx, barcode, "SMRITI-BILL-002",
                        f"Tax-Exclusive base rate ₹{effective_sp:.2f} + {gst_rate}% GST yields ₹{post_tax_unit:.2f}, "
                        f"exceeding legal MRP ₹{catalog_mrp:.2f} for barcode {barcode}. Statutory violation.")

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

    # Canonical GST Computation via gst_engine
    tax_result = calculate_line_item_tax(
        unit_price=effective_sp,
        quantity=qty,
        discount_amount=disc_amount,
        gst_rate=gst_rate,
        is_tax_inclusive=is_tax_inclusive,
        is_interstate=False,
    )

    # MRP markdown — display only, does NOT feed back into price
    markdown_pct = 0
    markdown_display = ""
    unit_consumer_price = (tax_result["total_amount"] / qty) if qty > 0 else Decimal("0.00")
    if catalog_mrp > 0 and unit_consumer_price < catalog_mrp:
        markdown_pct = int(round((catalog_mrp - unit_consumer_price) / catalog_mrp * 100))
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
        is_tax_inclusive=is_tax_inclusive,
        tax_mode_display=tax_mode_display,
        mrp_markdown_pct=markdown_pct or None,
        mrp_markdown_display=markdown_display or None,
        gst_rate=float(gst_rate),
        taxable_value=float(tax_result["taxable_value"]),
        cgst_amount=float(tax_result["cgst_amount"]),
        sgst_amount=float(tax_result["sgst_amount"]),
        igst_amount=float(tax_result["igst_amount"]),
        line_total=float(tax_result["total_amount"]),
        available_stock=available_stock,
        uom=uom,
        batch_no=raw_batch.strip() if raw_batch else None,
        expiry_date=raw_exp.strip() if raw_exp else None,
        salesperson_id=raw_staff.strip() if raw_staff else None,
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
            if len(parts) > 3:
                row["is_tax_inclusive"] = parts[3]
            data_rows.append(row)
        return True, list(data_rows[0].keys()) if data_rows else [], data_rows

    # Check if first line is a header row or data row
    first_cells = next(csv.reader(io.StringIO(first_line), delimiter=delimiter), [])
    first_cells_norm = [_norm_header(c) for c in first_cells]
    has_header = any(c in set(HEADER_ALIASES.values()) for c in first_cells_norm)

    if not has_header:
        # Headerless CSV (positional: barcode, quantity[, selling_price, discount_percent, is_tax_inclusive])
        reader = csv.reader(io.StringIO(raw_text), delimiter=delimiter)
        data_rows = []
        max_cols = 0
        for parts in reader:
            parts = [p.strip() for p in parts]
            if not parts or not parts[0]:
                continue
            max_cols = max(max_cols, len(parts))
            row: Dict[str, str] = {"barcode": parts[0]}
            if len(parts) > 1:
                row["quantity"] = parts[1]
            if len(parts) > 2:
                row["selling_price"] = parts[2]
            if len(parts) > 3:
                row["discount_percent"] = parts[3]
            if len(parts) > 4:
                row["is_tax_inclusive"] = parts[4]
            data_rows.append(row)

        canonical_headers = ["barcode"]
        if max_cols > 1:
            canonical_headers.append("quantity")
        if max_cols > 2:
            canonical_headers.append("selling_price")
        if max_cols > 3:
            canonical_headers.append("discount_percent")
        if max_cols > 4:
            canonical_headers.append("is_tax_inclusive")
        return False, canonical_headers, data_rows

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
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/csv/validate",
    response_model=CsvValidateResponse,
    summary="Validate and resolve a barcode billing CSV or PDT import with statutory tax modes",
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

    Supports Tax-Inclusive (MRP / Retail) and Tax-Exclusive (Base Rate + GST) pricing.
    Enforces statutory MRP ceiling guards across both tax modes.
    Saves validation audit log into billing_csv_import_logs.
    """
    company_id = tenant.company_id
    is_pdt, canonical_headers, data_rows = _parse_input(req.raw_text, req.delimiter_hint)
    fmt = _detect_format(canonical_headers, is_pdt)

    results: List[CsvRowResult] = []
    total_gross = Decimal("0.00")
    total_tax = Decimal("0.00")
    tax_modes_seen = set()

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
            raw_tax_inc=row.get("is_tax_inclusive"),
            raw_disc_amt=row.get("discount_amount"),
            raw_batch=row.get("batch_no"),
            raw_exp=row.get("expiry_date"),
            raw_staff=row.get("salesperson_id"),
            default_tax_inclusive=req.tax_inclusive_default,
        )
        results.append(result)

        if result.status != "REJECTED":
            total_gross += Decimal(str(result.line_total or 0))
            tax_amount = (Decimal(str(result.cgst_amount or 0)) + Decimal(str(result.sgst_amount or 0)) + Decimal(str(result.igst_amount or 0)))
            total_tax += tax_amount
            tax_modes_seen.add(result.tax_mode_display)

    valid_rows = sum(1 for r in results if r.status == "VALID")
    warning_rows = sum(1 for r in results if r.status == "WARNING")
    rejected_rows = sum(1 for r in results if r.status == "REJECTED")

    tax_mode_applied = "MIXED" if len(tax_modes_seen) > 1 else (list(tax_modes_seen)[0] if tax_modes_seen else "INCLUSIVE")

    # Record statutory audit log entry in billing_csv_import_logs
    import_log_id = f"log-csv-{uuid.uuid4().hex[:12]}"
    file_hash = hashlib.sha256(req.raw_text.encode("utf-8")).hexdigest()

    audit_entry = BillingCsvImportLog(
        id=import_log_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=tenant.branch_id,
        register_id=req.register_id,
        shift_id=req.shift_id,
        cashier_id=current_user.id if current_user else None,
        file_name=req.file_name or "uploaded.csv",
        file_sha256=file_hash,
        format_detected=fmt,
        total_rows=len(results),
        valid_rows=valid_rows,
        warning_rows=warning_rows,
        rejected_rows=rejected_rows,
        total_gross_amount=round_currency(total_gross),
        total_tax_amount=round_currency(total_tax),
        tax_mode_applied=tax_mode_applied,
        created_by=current_user.username if current_user else "system",
        updated_by=current_user.username if current_user else "system",
    )

    try:
        db.add(audit_entry)
        await db.commit()
    except Exception:
        await db.rollback()
        import_log_id = None

    return CsvValidateResponse(
        format_detected=fmt,
        format_label=FORMAT_LABELS.get(fmt, fmt),
        total_rows=len(results),
        valid_rows=valid_rows,
        rejected_rows=rejected_rows,
        warning_rows=warning_rows,
        can_proceed=(valid_rows + warning_rows) > 0,
        import_log_id=import_log_id,
        rows=results,
    )


@router.get(
    "/csv/templates",
    response_model=List[CsvTemplateDTO],
    summary="List available Barcode Billing CSV import templates",
    tags=["Barcode Billing CSV Import"],
)
async def list_csv_templates(
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> List[CsvTemplateDTO]:
    """
    Returns registered system and custom user-defined CSV import templates.
    """
    stmt = (
        select(BillingCsvTemplate)
        .where(BillingCsvTemplate.is_deleted == False)
        .order_by(BillingCsvTemplate.is_system.desc(), BillingCsvTemplate.template_code)
    )
    res = await db.execute(stmt)
    templates = res.scalars().all()

    return [
        CsvTemplateDTO(
            id=t.id,
            template_code=t.template_code,
            name=t.name,
            description=t.description,
            delimiter=t.delimiter,
            has_header=t.has_header,
            default_tax_inclusive=t.default_tax_inclusive,
            column_mappings=t.column_mappings or {},
            is_system=t.is_system,
        )
        for t in templates
    ]


@router.post(
    "/csv/templates",
    response_model=CsvTemplateDTO,
    status_code=201,
    summary="Create a custom Barcode Billing CSV template",
    tags=["Barcode Billing CSV Import"],
)
async def create_csv_template(
    req: CsvTemplateCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> CsvTemplateDTO:
    """
    Registers a custom CSV import template with user-defined mappings.
    """
    # Check uniqueness
    stmt = select(BillingCsvTemplate).where(BillingCsvTemplate.template_code == req.template_code)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail=f"Template code '{req.template_code}' already exists.")

    new_id = f"tmpl-{uuid.uuid4().hex[:10]}"
    tmpl = BillingCsvTemplate(
        id=new_id,
        uuid=str(uuid.uuid4()),
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        template_code=req.template_code.strip().upper(),
        name=req.name.strip(),
        description=req.description,
        delimiter=req.delimiter,
        has_header=req.has_header,
        default_tax_inclusive=req.default_tax_inclusive,
        column_mappings=req.column_mappings,
        is_system=False,
        created_by=current_user.username if current_user else "system",
        updated_by=current_user.username if current_user else "system",
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)

    return CsvTemplateDTO(
        id=tmpl.id,
        template_code=tmpl.template_code,
        name=tmpl.name,
        description=tmpl.description,
        delimiter=tmpl.delimiter,
        has_header=tmpl.has_header,
        default_tax_inclusive=tmpl.default_tax_inclusive,
        column_mappings=tmpl.column_mappings or {},
        is_system=tmpl.is_system,
    )
