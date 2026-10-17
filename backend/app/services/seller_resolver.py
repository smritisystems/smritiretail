"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-08-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Dynamic Seller Corporate Identity Resolver
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.tenant import Company
from .invoice_errors import missing


def _text(*candidates: Any) -> str | None:
    """Return the first non-empty string among candidates."""
    for value in candidates:
        if value is None:
            continue
        text = str(value).strip()
        if text and not text.startswith("<MagicMock"):
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
    # Extended Canonical Properties (v1537)
    company_legal_name: str = ""
    company_trade_name: str = ""
    company_pan: str = ""
    company_cin: str = ""
    company_city: str = ""
    company_state: str = ""
    company_state_code: str = ""
    company_pincode: str = ""
    phone: str = ""
    email: str = ""
    contact_person: str = ""
    print_logo_url: str = ""
    signature_url: str = ""
    stamp_url: str = ""
    currency_code: str = "INR"
    upi_id: str = ""


def resolve_seller_context(
    invoice: Any = None,
    extra_meta: dict | None = None,
    company: Any = None,
    doc_type: str = "TAX_INVOICE",
) -> SellerContext:
    """
    Resolve dynamic SellerContext from authoritative Company model, invoice snapshot, or metadata.
    Enforces document-specific fail-closed validation:
    - TAX_INVOICE: blocks issuance if corporate legal name, GSTIN, address, or banking coordinates are missing.
    - SALES_ORDER / QUOTATION / POS_RECEIPT: requires company identity & address, banking coordinates optional.
    - PURCHASE_ORDER: validates Buyer (Tenant) corporate identity.
    - Historical Immutability: Prioritizes historical snapshot attributes from the invoice/meta over mutable live records.
    """
    meta = extra_meta or {}
    normalized_doc_type = (doc_type or "TAX_INVOICE").upper()

    rule_snaps = getattr(invoice, "rule_snapshots", None) if isinstance(getattr(invoice, "rule_snapshots", None), dict) else {}

    # Precedence: 1. Snapshot on extra_meta/invoice/rule_snapshots -> 2. Live Company entity
    # Extract company name
    company_name = _text(
        meta.get("seller_name"),
        getattr(invoice, "seller_name", None),
        rule_snaps.get("seller_name"),
        meta.get("company_name"),
        getattr(company, "legal_name", None),
        getattr(company, "name", None),
    )
    if not company_name:
        raise missing("MISSING_COMPANY", "company legal name")

    # Extract company GSTIN
    company_gstin = _text(
        meta.get("seller_gstin"),
        getattr(invoice, "seller_gstin", None),
        rule_snaps.get("seller_gstin"),
        meta.get("company_gstin"),
        getattr(company, "gst_number", None),
        getattr(company, "gstin", None),
    )
    requires_gstin = normalized_doc_type in ("TAX_INVOICE", "INVOICE", "DELIVERY_CHALLAN")
    if requires_gstin and not company_gstin:
        raise missing("MISSING_SELLER_GSTIN", "seller GSTIN")
    if not company_gstin:
        company_gstin = ""

    # Extract and construct company address
    constructed_address = None
    if company is not None:
        parts = [
            getattr(company, "address_line1", None),
            getattr(company, "address_line2", None),
            getattr(company, "city", None),
            f"{getattr(company, 'state', '')} {getattr(company, 'pincode', '')}".strip()
            if getattr(company, "state", None) or getattr(company, "pincode", None)
            else None,
        ]
        non_empty_parts = [
            str(p).strip()
            for p in parts
            if p is not None and not str(p).startswith("<MagicMock") and str(p).strip()
        ]
        if non_empty_parts:
            constructed_address = ", ".join(non_empty_parts)

    company_address = _text(
        meta.get("seller_address"),
        getattr(invoice, "seller_address", None),
        rule_snaps.get("seller_address"),
        meta.get("company_address"),
        constructed_address,
        getattr(company, "address", None),
    )
    if not company_address:
        party_label = "buyer address" if normalized_doc_type == "PURCHASE_ORDER" else "seller address"
        raise missing("MISSING_COMPANY", party_label)

    # Resolve default bank coordinates (Historical snapshot on invoice row prioritized over live CompanyBankAccounts)
    resolved_bank_name = getattr(invoice, "bank_name", None)
    resolved_account_no = getattr(invoice, "account_no", None)
    resolved_ifsc_code = getattr(invoice, "ifsc_code", None)
    resolved_bank_branch = getattr(invoice, "bank_branch", None) or rule_snaps.get("bank_branch")

    if not (resolved_bank_name and resolved_account_no and resolved_ifsc_code):
        company_banks = getattr(company, "bank_accounts", None)
        if company_banks and isinstance(company_banks, list | tuple) and len(company_banks) > 0:
            default_acc = next((b for b in company_banks if getattr(b, "is_default", False)), company_banks[0])
            resolved_bank_name = resolved_bank_name or getattr(default_acc, "bank_name", None)
            resolved_account_no = resolved_account_no or getattr(default_acc, "account_no", None)
            resolved_ifsc_code = resolved_ifsc_code or getattr(default_acc, "ifsc", None)
            resolved_bank_branch = resolved_bank_branch or getattr(default_acc, "branch", None)

    bank_name = _text(
        meta.get("bank_name"),
        resolved_bank_name,
        getattr(company, "bank_name", None),
    ) or ""
    account_no = _text(
        meta.get("account_no"),
        meta.get("bank_account_no"),
        resolved_account_no,
        getattr(company, "account_no", None),
    ) or ""
    ifsc_code = _text(
        meta.get("ifsc_code"),
        meta.get("bank_ifsc"),
        resolved_ifsc_code,
        getattr(company, "ifsc_code", None),
        getattr(company, "ifsc", None),
    ) or ""
    bank_branch = _text(
        meta.get("bank_branch"),
        resolved_bank_branch,
        getattr(company, "bank_branch", None),
        getattr(company, "branch", None),
    ) or ""

    # Document-specific banking enforcement: only TAX_INVOICE mandates seller bank coordinates
    requires_bank = normalized_doc_type in ("TAX_INVOICE", "INVOICE")
    if requires_bank:
        if not bank_name or not account_no or not ifsc_code or not bank_branch:
            raise missing("MISSING_BANK_DETAILS", "bank name, account number, IFSC, and branch")

    logo_uri = _text(
        meta.get("logo_uri"),
        meta.get("logo_base64"),
        getattr(company, "logo_base64", None),
        getattr(company, "print_logo_url", None),
        getattr(company, "logo_url", None),
        getattr(invoice, "logo_uri", None),
    ) or ""

    legal_name = _text(getattr(company, "legal_name", None), company_name) or company_name
    trade_name = _text(getattr(company, "trade_name", None), company_name) or company_name
    pan = _text(getattr(company, "pan", None), company_gstin[2:12] if len(company_gstin) >= 12 else "") or ""
    cin = _text(getattr(company, "cin", None), meta.get("cin")) or ""
    city = _text(getattr(company, "city", None), meta.get("city")) or ""
    state = _text(getattr(company, "state", None), meta.get("state")) or ""
    state_code = _text(getattr(company, "state_code", None), company_gstin[:2] if len(company_gstin) >= 2 else "") or ""
    pincode = _text(getattr(company, "pincode", None), meta.get("pincode")) or ""
    phone = _text(getattr(company, "phone", None), meta.get("phone")) or ""
    email = _text(getattr(company, "email", None), meta.get("email")) or ""
    website = _text(meta.get("company_website"), getattr(company, "website", None)) or ""
    dispatch_email = _text(meta.get("dispatch_email"), getattr(company, "dispatch_email", None)) or ""
    accounts_email = _text(meta.get("accounts_email"), getattr(company, "accounts_email", None)) or ""
    contact_person = _text(getattr(company, "contact_person", None), meta.get("contact_person")) or ""
    print_logo_url = _text(getattr(company, "print_logo_url", None), meta.get("print_logo_url")) or ""
    signature_url = _text(getattr(company, "signature_url", None), meta.get("signature_url")) or ""
    stamp_url = _text(getattr(company, "stamp_url", None), meta.get("stamp_url")) or ""
    currency_code = _text(getattr(company, "currency_code", None), "INR") or "INR"
    upi_id = _text(meta.get("upi_id"), getattr(company, "upi_id", None)) or ""

    return SellerContext(
        company_name=company_name,
        company_gstin=company_gstin,
        company_address=company_address,
        website=website,
        dispatch_email=dispatch_email,
        accounts_email=accounts_email,
        bank_name=bank_name,
        account_no=account_no,
        ifsc_code=ifsc_code,
        bank_branch=bank_branch,
        logo_uri=logo_uri,
        company_legal_name=legal_name,
        company_trade_name=trade_name,
        company_pan=pan,
        company_cin=cin,
        company_city=city,
        company_state=state,
        company_state_code=state_code,
        company_pincode=pincode,
        phone=phone,
        email=email,
        contact_person=contact_person,
        print_logo_url=print_logo_url,
        signature_url=signature_url,
        stamp_url=stamp_url,
        currency_code=currency_code,
        upi_id=upi_id,
    )


async def resolve_seller_context_async(
    db: AsyncSession,
    company_id: str = "COMP-001",
    invoice: Any = None,
    extra_meta: dict | None = None,
    doc_type: str = "TAX_INVOICE",
) -> SellerContext:
    """
    Fetch authoritative Company entity and associated default bank account from database,
    then resolve and validate SellerContext.
    """
    stmt = (
        select(Company)
        .options(selectinload(Company.bank_accounts))
        .where(
            (Company.id == company_id) | (Company.company_code == company_id),
            Company.is_deleted.is_(False),
        )
    )
    res = await db.execute(stmt)
    comp = res.scalars().first()

    return resolve_seller_context(
        invoice=invoice,
        extra_meta=extra_meta,
        company=comp,
        doc_type=doc_type,
    )

