"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.13.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - Indian GST Report Engines

Provides business logic for compiling tax returns and generating readiness scores:
1. HSN/SAC Summary compiler (GSTR-1 Table 12 & 13 format)
2. GST Audit Trail recorder and log structure
3. E-Way Bill Readiness Score engine (evaluates invoice for transport parameters)
4. E-Invoice Readiness Score engine (evaluates invoice for IRN schema compatibility)
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any


@dataclass
class HSNLineSummary:
    hsn_code: str
    description: str
    uom: str                      # Unit of Quantity (e.g. NOS, KGS, BOX)
    total_quantity: Decimal
    total_value: Decimal          # Gross value (taxable + taxes)
    taxable_value: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    cess_amount: Decimal = Decimal("0")


@dataclass
class GSTAuditLogEntry:
    timestamp: datetime
    user_id: str
    action: str                   # CREATE, UPDATE, DELETE, VOID
    field_name: str               # e.g., "gstin", "hsn_code", "tax_rate"
    old_value: Optional[str]
    new_value: str
    reason: str


@dataclass
class EWayBillReadiness:
    score: int                    # 0 to 100
    is_ready: bool
    missing_fields: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class EInvoiceReadiness:
    score: int                    # 0 to 100
    is_ready: bool
    missing_fields: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


def compile_hsn_sac_summary(
    line_items: List[Dict[str, Any]]
) -> Dict[str, HSNLineSummary]:
    """
    Compile HSN/SAC summary for GSTR-1 return filing (Table 12/13).
    Groups line items by (hsn_code, uom).
    
    Each line item dict should contain:
      - hsn_code: str
      - description: str
      - uom: str
      - quantity: Decimal
      - taxable_value: Decimal
      - igst: Decimal
      - cgst: Decimal
      - sgst: Decimal
      - cess: Optional[Decimal]
    """
    summary: Dict[tuple, HSNLineSummary] = {}

    for item in line_items:
        hsn = str(item.get("hsn_code", "")).strip()
        if not hsn:
            continue
        uom = str(item.get("uom", "NOS")).strip().upper()
        desc = str(item.get("description", ""))
        qty = Decimal(str(item.get("quantity", "0")))
        taxable = Decimal(str(item.get("taxable_value", "0")))
        igst = Decimal(str(item.get("igst", "0")))
        cgst = Decimal(str(item.get("cgst", "0")))
        sgst = Decimal(str(item.get("sgst", "0")))
        cess = Decimal(str(item.get("cess", "0")))
        
        gross = taxable + igst + cgst + sgst + cess
        key = (hsn, uom)

        if key not in summary:
            summary[key] = HSNLineSummary(
                hsn_code=hsn,
                description=desc,
                uom=uom,
                total_quantity=qty,
                total_value=gross,
                taxable_value=taxable,
                igst_amount=igst,
                cgst_amount=cgst,
                sgst_amount=sgst,
                cess_amount=cess
            )
        else:
            exist = summary[key]
            exist.total_quantity += qty
            exist.total_value += gross
            exist.taxable_value += taxable
            exist.igst_amount += igst
            exist.cgst_amount += cgst
            exist.sgst_amount += sgst
            exist.cess_amount += cess

    return {f"{k[0]}_{k[1]}": v for k, v in summary.items()}


def evaluate_eway_bill_readiness(
    invoice_amount: Decimal,
    is_interstate: bool,
    from_pincode: str,
    to_pincode: str,
    transporter_id: Optional[str],
    vehicle_number: Optional[str],
    distance_km: Optional[int],
    mode_of_transport: Optional[str], # ROAD, RAIL, AIR, SHIP
) -> EWayBillReadiness:
    """
    Evaluate invoice data for E-Way Bill generation readiness under GST rules.
    E-Way Bill is mandatory if invoice value > Rs 50,000 (usually Rs 1,00,000 in some states
    for intrastate, but Rs 50,000 is the national interstate limit).
    """
    missing = []
    warnings = []
    suggestions = []
    
    # 1. Check statutory limit
    limit = Decimal("50000.00")
    requires_eway = invoice_amount > limit

    if not requires_eway:
        warnings.append(f"Invoice amount Rs {invoice_amount} is below the national threshold of Rs 50,000. E-Way Bill may be optional.")

    # 2. Check pin codes
    if not from_pincode or not re_match_pincode(from_pincode):
        missing.append("Dispatch PIN Code (from_pincode)")
    if not to_pincode or not re_match_pincode(to_pincode):
        missing.append("Delivery PIN Code (to_pincode)")

    # 3. Check transport mode
    if not mode_of_transport:
        missing.append("Mode of Transport")
    else:
        mode_upper = mode_of_transport.upper()
        if mode_upper not in ("ROAD", "RAIL", "AIR", "SHIP"):
            warnings.append(f"Unknown Mode of Transport '{mode_of_transport}'. Expected: ROAD, RAIL, AIR, SHIP.")
        
        # If ROAD, vehicle number or transporter ID is required (Part B parameters)
        if mode_upper == "ROAD":
            if not vehicle_number and not transporter_id:
                missing.append("Vehicle Number or Transporter ID (GSTIN/transporter code)")

    # 4. Check distance
    if distance_km is None or distance_km <= 0:
        missing.append("Distance in Kilometers")
    elif distance_km > 4000:
        warnings.append(f"Distance {distance_km} km seems high for Indian domestic transport.")

    # Calculate Score
    score = 100
    deduction_weights = {
        "Dispatch PIN Code (from_pincode)": 20,
        "Delivery PIN Code (to_pincode)": 20,
        "Mode of Transport": 15,
        "Distance in Kilometers": 15,
        "Vehicle Number or Transporter ID (GSTIN/transporter code)": 30
    }

    for item in missing:
        score -= deduction_weights.get(item, 10)

    score = max(0, score)
    is_ready = len(missing) == 0 and (requires_eway or invoice_amount > 0)

    # Provide suggestions
    if "Vehicle Number or Transporter ID (GSTIN/transporter code)" in missing:
        suggestions.append("Assign a transporter by adding their Transporter GSTIN (Lrn) or add the delivery vehicle registration number.")
    if "Distance in Kilometers" in missing:
        suggestions.append("Input the approximate highway distance between supplier and buyer pin codes.")

    return EWayBillReadiness(
        score=score,
        is_ready=is_ready,
        missing_fields=missing,
        warnings=warnings,
        suggestions=suggestions
    )


def evaluate_einvoice_readiness(
    buyer_gstin: Optional[str],
    supplier_gstin: str,
    invoice_date: str,
    hsn_codes: List[str],
    is_b2b: bool,
    total_amount: Decimal,
) -> EInvoiceReadiness:
    """
    Evaluate invoice data for E-Invoicing (IRN generation) compatibility.
    E-Invoicing is mandatory in India for B2B transactions for businesses above specific turnover limits.
    """
    missing = []
    warnings = []
    suggestions = []

    # 1. B2B Check
    if not is_b2b:
        warnings.append("This is marked as a B2C transaction. E-Invoicing is only mandatory for B2B, Exports, and Deemed Exports.")
    else:
        if not buyer_gstin:
            missing.append("Buyer GSTIN (mandatory for B2B E-Invoice)")

    # 2. Supplier GSTIN
    if not supplier_gstin:
        missing.append("Supplier GSTIN")

    # 3. HSN Validity check
    if not hsn_codes:
        missing.append("HSN/SAC line items")
    else:
        for idx, hsn in enumerate(hsn_codes):
            if not hsn or len(hsn) not in (4, 6, 8):
                warnings.append(f"Line item {idx+1}: HSN code '{hsn}' is not exactly 4, 6, or 8 digits. Might be rejected by IRP portal.")

    # 4. Check date
    try:
        parsed_date = datetime.strptime(invoice_date, "%Y-%m-%d").date()
        days_diff = (datetime.now().date() - parsed_date).days
        if days_diff > 30:
            warnings.append(f"Invoice is {days_diff} days old. GST portal has a 30-day reporting window limit for e-invoices.")
    except ValueError:
        missing.append("Valid Invoice Date (YYYY-MM-DD)")

    # Calculate Score
    score = 100
    if not supplier_gstin:
        score -= 30
    if is_b2b and not buyer_gstin:
        score -= 30
    if not hsn_codes:
        score -= 20
    if any(len(hsn) not in (4, 6, 8) for hsn in hsn_codes if hsn):
        score -= 10
    if "Valid Invoice Date (YYYY-MM-DD)" in missing:
        score -= 10

    score = max(0, score)
    is_ready = len(missing) == 0

    if is_ready and score >= 90:
        suggestions.append("Schema looks complete. Submit to IRP portal to obtain signed IRN QR code.")
    elif buyer_gstin and not is_b2b:
        suggestions.append("If this transaction is with a registered GSTIN holder, ensure the invoice document type is set to B2B.")

    return EInvoiceReadiness(
        score=score,
        is_ready=is_ready,
        missing_fields=missing,
        warnings=warnings,
        suggestions=suggestions
    )


def re_match_pincode(pincode: str) -> bool:
    """Helper to check if pincode is a valid 6-digit Indian Pin Code."""
    import re
    return bool(re.match(r"^[1-9][0-9]{5}$", pincode.strip()))
