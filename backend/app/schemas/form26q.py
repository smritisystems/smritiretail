"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Statutory Compliance / Taxation DTOs
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class Form26QDeducteeLine(BaseModel):
    """Individual deductee line item in Form 26Q statement."""
    deductee_code: str = Field(..., description="01 for Company, 02 for Non-Company / Individual")
    pan: str = Field(..., description="PAN of Deductee (or PANINVALID / PANNOTAVBL)")
    pan_valid: bool = Field(..., description="True if 10-digit PAN passes statutory regex")
    vendor_name: str = Field(..., description="Legal name of deductee supplier")
    section: str = Field(..., description="Income Tax Act Section (e.g. 194Q, 194C, 194J)")
    document_no: Optional[str] = Field(None, description="Bill No or Payment Reference")
    transaction_date: str = Field(..., description="Date of payment or credit (YYYY-MM-DD)")
    deduction_date: str = Field(..., description="Date of tax deduction (YYYY-MM-DD)")
    gross_amount: float = Field(..., description="Total commercial invoice or payment amount")
    tds_rate: float = Field(..., description="Rate of deduction (e.g. 0.10, 1.00, 2.00, 5.00)")
    tds_amount: float = Field(..., description="Tax Deducted at Source (INR)")
    reason_code: Optional[str] = Field(
        None, 
        description="Reason code: 'C' = Higher rate under 206AA (invalid/no PAN), 'B' = Threshold limit under 194Q, 'Y' = Lower deduction"
    )


class Form26QChallanLine(BaseModel):
    """Challan ITNS 281 deposit record included in Form 26Q."""
    voucher_no: str
    challan_no: str
    bsr_code: str
    challan_date: str
    minor_head: str
    tax_amount: float
    surcharge: float
    cess: float
    interest: float
    fee: float
    penalty: float
    total_amount: float
    cheque_dd_no: Optional[str] = None


class Form26QSummaryResponse(BaseModel):
    """Complete quarterly Form 26Q reconciliation statement."""
    financial_year: str
    quarter: str
    from_date: str
    to_date: str
    company_name: str
    company_tan: str
    company_pan: str
    total_deductees_count: int
    total_gross_amount: float
    total_tds_deducted: float
    total_challans_count: int
    total_tds_deposited: float
    unallocated_shortfall: float
    deductees: List[Form26QDeducteeLine] = []
    challans: List[Form26QChallanLine] = []


class Form26QExportResponse(BaseModel):
    """Standardized ASCII text file export payload for Form 26Q e-TDS return."""
    financial_year: str
    quarter: str
    filename: str
    content_type: str = "text/plain"
    file_content: str
    total_records: int
    total_challans: int
    total_deductees: int
    total_tax_deposited: float
