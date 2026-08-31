"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from dataclasses import dataclass
from typing import Any, Optional

from .invoice_errors import missing


def _text(*candidates: Any) -> Optional[str]:
    for value in candidates:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


@dataclass
class SellerContext:
    company_name: str
    company_gstin: str
    company_address: str
    website: str
    dispatch_email: str
    accounts_email: str
    bank_name: str
    account_no: str
    ifsc_code: str
    bank_branch: str
    logo_uri: str


def resolve_seller_context(
    invoice: Any,
    extra_meta: Optional[dict] = None,
    company: Any = None,
) -> SellerContext:
    meta = extra_meta or {}

    company_name = _text(
        meta.get("company_name"),
        meta.get("seller_name"),
        getattr(company, "legal_name", None),
        getattr(company, "name", None),
    )
    if not company_name:
        raise missing("MISSING_COMPANY", "company name")

    company_gstin = _text(
        meta.get("company_gstin"),
        meta.get("seller_gstin"),
        getattr(company, "gst_number", None),
        getattr(invoice, "seller_gstin", None),
    )
    if not company_gstin:
        raise missing("MISSING_SELLER_GSTIN", "seller GSTIN")

    company_address = _text(
        meta.get("company_address"),
        meta.get("seller_address"),
        getattr(company, "address", None),
        getattr(invoice, "seller_address", None),
    )
    if not company_address:
        raise missing("MISSING_COMPANY", "seller address")

    bank_name = _text(
        meta.get("bank_name"),
        getattr(company, "bank_name", None),
        getattr(invoice, "bank_name", None),
    )
    account_no = _text(
        meta.get("account_no"),
        meta.get("bank_account_no"),
        getattr(company, "account_no", None),
        getattr(invoice, "account_no", None),
    )
    ifsc_code = _text(
        meta.get("ifsc_code"),
        meta.get("bank_ifsc"),
        getattr(company, "ifsc_code", None),
        getattr(invoice, "ifsc_code", None),
    )
    bank_branch = _text(
        meta.get("bank_branch"),
        getattr(company, "bank_branch", None),
        getattr(invoice, "bank_branch", None),
    )
    if not bank_name or not account_no or not ifsc_code or not bank_branch:
        raise missing("MISSING_BANK_DETAILS", "bank name, account number, IFSC, and branch")

    logo_uri = _text(
        meta.get("logo_uri"),
        meta.get("logo_base64"),
        getattr(company, "logo_base64", None),
        getattr(invoice, "logo_uri", None),
    ) or ""

    return SellerContext(
        company_name=company_name,
        company_gstin=company_gstin,
        company_address=company_address,
        website=_text(meta.get("company_website"), getattr(company, "website", None)) or "",
        dispatch_email=_text(meta.get("dispatch_email"), getattr(company, "dispatch_email", None)) or "",
        accounts_email=_text(meta.get("accounts_email"), getattr(company, "accounts_email", None)) or "",
        bank_name=bank_name,
        account_no=account_no,
        ifsc_code=ifsc_code,
        bank_branch=bank_branch,
        logo_uri=logo_uri,
    )
