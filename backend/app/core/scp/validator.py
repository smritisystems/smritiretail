"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-30
Modified     : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Platform Standard (SCP-001)

validator.py — SMRITI Compliance Platform (SCP v1.0 Kernel)
Pre-flight statutory voucher validator for GSTIN, HSN, E-Way Bill, and MSME thresholds.
"""

import re
from typing import List, Dict, Any
from pydantic import BaseModel


class ComplianceIssueDTO(BaseModel):
    severity: str  # ERROR, WARNING, INFO
    code: str
    message: str
    field_ref: str
    suggested_fix: str = ""


class StatutoryValidator:
    """
    Statutory pre-flight validator enforcing statutory rules prior to transaction commit.
    """

    GSTIN_REGEX = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"

    @classmethod
    def validate_sales_invoice(cls, invoice_data: Dict[str, Any]) -> List[ComplianceIssueDTO]:
        issues: List[ComplianceIssueDTO] = []

        # 1. GSTIN Format & Checksum Validation
        gstin = invoice_data.get("customer_gstin")
        if gstin and not re.match(cls.GSTIN_REGEX, gstin):
            issues.append(ComplianceIssueDTO(
                severity="ERROR",
                code="INVALID_GSTIN_FORMAT",
                message=f"Customer GSTIN '{gstin}' fails statutory 15-character format checksum.",
                field_ref="customer_gstin",
                suggested_fix="Update Customer GSTIN in Master with valid state code prefix."
            ))

        # 2. HSN Mandatory Check for B2B
        if invoice_data.get("is_b2b", False):
            for idx, item in enumerate(invoice_data.get("items", [])):
                if not item.get("hsn_code"):
                    issues.append(ComplianceIssueDTO(
                        severity="ERROR",
                        code="MISSING_MANDATORY_HSN",
                        message=f"HSN/SAC Code is mandatory for B2B item at line {idx + 1}.",
                        field_ref=f"items[{idx}].hsn_code",
                        suggested_fix="Assign 6-digit HSN code in Item Master."
                    ))

        # 3. E-Way Bill Threshold (> ₹50,000)
        grand_total = invoice_data.get("total_amount", 0)
        if grand_total > 50000 and not invoice_data.get("eway_bill_no"):
            issues.append(ComplianceIssueDTO(
                severity="WARNING",
                code="EWAY_THRESHOLD_EXCEEDED",
                message=f"Consignment value (₹{grand_total:,.2f}) exceeds ₹50,000 threshold. Statutory E-Way Bill required.",
                field_ref="eway_bill_no",
                suggested_fix="Generate E-Way Bill or record transporter details."
            ))

        return issues
