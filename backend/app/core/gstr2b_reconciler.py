"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Statutory Accounting Core Layer - GST GSTR-2B Automated ITC Reconciliation Engine
Conforms to Section 16(2)(aa) of CGST Act, 2017 & Rule 36(4).

Reconciles Purchase Register entries (books of accounts) against GSTR-2B auto-drafted statement.
Categorizes invoices into:
1. MATCHED: Full match on GSTIN, Invoice No, Taxable Value, and Tax Amount (within tolerance).
2. TAX_MISMATCH: GSTIN & Invoice No match, but Taxable Value or Tax Amount differs.
3. MISSING_IN_GSTR2B: Invoice in books but supplier has not filed in GSTR-1 (Ineligible ITC).
4. MISSING_IN_BOOKS: Invoice in GSTR-2B but not recorded in purchase register.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Tuple, Optional


class ReconciliationStatus(str, Enum):
    MATCHED = "MATCHED"
    TAX_MISMATCH = "TAX_MISMATCH"
    MISSING_IN_GSTR2B = "MISSING_IN_GSTR2B"
    MISSING_IN_BOOKS = "MISSING_IN_BOOKS"


@dataclass
class PurchaseInvoiceRecord:
    invoice_number: str
    supplier_gstin: str
    invoice_date: str
    taxable_value: float
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0

    @property
    def total_tax(self) -> float:
        return round(self.igst + self.cgst + self.sgst, 2)


@dataclass
class Gstr2bRecord:
    invoice_number: str
    supplier_gstin: str
    invoice_date: str
    taxable_value: float
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    itc_availability: str = "Y"  # Y or N

    @property
    def total_tax(self) -> float:
        return round(self.igst + self.cgst + self.sgst, 2)


@dataclass
class ReconciliationItemResult:
    status: ReconciliationStatus
    supplier_gstin: str
    invoice_number: str
    books_taxable_val: Optional[float] = None
    books_tax: Optional[float] = None
    gstr2b_taxable_val: Optional[float] = None
    gstr2b_tax: Optional[float] = None
    difference_tax: float = 0.0
    remarks: str = ""


@dataclass
class ReconciliationSummary:
    matched_count: int = 0
    matched_itc: float = 0.0
    tax_mismatch_count: int = 0
    missing_in_gstr2b_count: int = 0
    missing_in_gstr2b_itc: float = 0.0
    missing_in_books_count: int = 0
    eligible_itc_claimable: float = 0.0
    items: List[ReconciliationItemResult] = field(default_factory=list)


class GstReconciliationEngine:
    """
    Canonical GST Input Tax Credit (ITC) Reconciliation Engine for GSTR-2B vs Books.
    """

    def __init__(self, tolerance: float = 1.0):
        # Tolerance in rupees to handle decimal rounding differences
        self.tolerance = tolerance

    def reconcile(
        self,
        purchase_books: List[PurchaseInvoiceRecord],
        gstr2b_records: List[Gstr2bRecord],
    ) -> ReconciliationSummary:
        summary = ReconciliationSummary()

        # Map by (supplier_gstin, invoice_number)
        books_map: Dict[Tuple[str, str], PurchaseInvoiceRecord] = {
            (rec.supplier_gstin.upper(), rec.invoice_number.upper()): rec for rec in purchase_books
        }
        gstr2b_map: Dict[Tuple[str, str], Gstr2bRecord] = {
            (rec.supplier_gstin.upper(), rec.invoice_number.upper()): rec for rec in gstr2b_records
        }

        all_keys = set(books_map.keys()).union(set(gstr2b_map.keys()))

        for key in sorted(all_keys):
            gstin, inv_no = key
            in_books = books_map.get(key)
            in_gstr2b = gstr2b_map.get(key)

            if in_books and in_gstr2b:
                # Check match
                taxable_diff = abs(in_books.taxable_value - in_gstr2b.taxable_value)
                tax_diff = abs(in_books.total_tax - in_gstr2b.total_tax)

                if taxable_diff <= self.tolerance and tax_diff <= self.tolerance:
                    res_item = ReconciliationItemResult(
                        status=ReconciliationStatus.MATCHED,
                        supplier_gstin=gstin,
                        invoice_number=inv_no,
                        books_taxable_val=in_books.taxable_value,
                        books_tax=in_books.total_tax,
                        gstr2b_taxable_val=in_gstr2b.taxable_value,
                        gstr2b_tax=in_gstr2b.total_tax,
                        difference_tax=0.0,
                        remarks="Matched successfully with GSTR-2B",
                    )
                    summary.matched_count += 1
                    summary.matched_itc += in_books.total_tax
                    summary.eligible_itc_claimable += in_books.total_tax
                else:
                    res_item = ReconciliationItemResult(
                        status=ReconciliationStatus.TAX_MISMATCH,
                        supplier_gstin=gstin,
                        invoice_number=inv_no,
                        books_taxable_val=in_books.taxable_value,
                        books_tax=in_books.total_tax,
                        gstr2b_taxable_val=in_gstr2b.taxable_value,
                        gstr2b_tax=in_gstr2b.total_tax,
                        difference_tax=round(in_books.total_tax - in_gstr2b.total_tax, 2),
                        remarks=f"Mismatch: Taxable diff {taxable_diff:.2f}, Tax diff {tax_diff:.2f}",
                    )
                    summary.tax_mismatch_count += 1
                    # Eligible ITC is capped at lower of books vs GSTR-2B under Sec 16(2)(aa)
                    summary.eligible_itc_claimable += min(in_books.total_tax, in_gstr2b.total_tax)

            elif in_books and not in_gstr2b:
                res_item = ReconciliationItemResult(
                    status=ReconciliationStatus.MISSING_IN_GSTR2B,
                    supplier_gstin=gstin,
                    invoice_number=inv_no,
                    books_taxable_val=in_books.taxable_value,
                    books_tax=in_books.total_tax,
                    gstr2b_taxable_val=None,
                    gstr2b_tax=None,
                    difference_tax=in_books.total_tax,
                    remarks="Supplier has not uploaded invoice in GSTR-1 (Ineligible ITC)",
                )
                summary.missing_in_gstr2b_count += 1
                summary.missing_in_gstr2b_itc += in_books.total_tax

            else:  # in_gstr2b and not in_books
                res_item = ReconciliationItemResult(
                    status=ReconciliationStatus.MISSING_IN_BOOKS,
                    supplier_gstin=gstin,
                    invoice_number=inv_no,
                    books_taxable_val=None,
                    books_tax=None,
                    gstr2b_taxable_val=in_gstr2b.taxable_value,
                    gstr2b_tax=in_gstr2b.total_tax,
                    difference_tax=-in_gstr2b.total_tax,
                    remarks="Present in GSTR-2B but missing in purchase register",
                )
                summary.missing_in_books_count += 1

            summary.items.append(res_item)

        summary.matched_itc = round(summary.matched_itc, 2)
        summary.missing_in_gstr2b_itc = round(summary.missing_in_gstr2b_itc, 2)
        summary.eligible_itc_claimable = round(summary.eligible_itc_claimable, 2)

        return summary
