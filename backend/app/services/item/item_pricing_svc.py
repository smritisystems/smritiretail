"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemPricingService
──────────────────
Responsibility: Contract-governed pricing evaluation and GST slab computation.
Extracted from: item_master_svc.py::_evaluate_pricing_contract (L1071–L1255)

SRP: This service ONLY evaluates what price to apply for a given customer/item pair.
It does NOT touch the database for item lookup — that is ItemCatalogService's job.
"""

from datetime import date
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...models.customer_article_mapping import CustomerArticleMapping


class ItemPricingService:
    """
    Contract-governed pricing evaluator.

    Evaluates customer commercial contracts with temporal validity,
    customer authorization, group eligibility, currency validation,
    statutory GST slab checking, and full auditability.

    Design note: This is a pure computation service. All inputs come in
    as parameters — no item lookup is performed here. Callers (BarcodeResolverService,
    ItemCatalogService) prepare the inputs and pass them in.
    """

    # Indian statutory GST slabs
    _STATUTORY_GST_SLABS = {0.0, 5.0, 12.0, 18.0, 28.0}

    @classmethod
    async def _evaluate_pricing_contract(
        cls,
        session: AsyncSession,
        cam: Optional[CustomerArticleMapping],
        customer_id: Optional[str],
        base_mrp: float,
        selling_price: float,
        tax_rate: float,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Dict[str, Any]:
        """
        Evaluates customer commercial contract pricing with full audit trail.

        Gates evaluated (in order):
        1. Customer Authorization Gate
        2. Currency Validation Gate
        3. Temporal & Status Gate
        4. Rate Resolution Gate
        5. Statutory GST Slab Validation & CGST/SGST/IGST split

        Returns a pricing_eval dict consumed by resolver services.
        """
        as_of = as_of_date or date.today()
        is_customer_authorized = False
        is_contract_active = False
        contract_status = "NO_CONTRACT"
        rejection_reason = None
        contract_rate = None
        contract_discount_pct = None
        currency = (cam.currency if cam and cam.currency else "INR").upper()
        pricing_rule_applied = "BASE_SELLING_PRICE" if selling_price > 0 else "BASE_MRP"
        effective_price = selling_price if selling_price > 0 else base_mrp

        if cam:
            # ── Gate 1: Customer Authorization ───────────────────────────
            if not customer_id:
                is_customer_authorized = False
                contract_status = "UNAUTHORIZED_CONTEXT"
                rejection_reason = "No customer context provided for contract rate evaluation"
            elif str(cam.customer_id) != str(customer_id):
                is_customer_authorized = False
                contract_status = "CUSTOMER_MISMATCH"
                rejection_reason = (
                    f"Contract belongs to customer '{cam.customer_id}', "
                    f"mismatch with requested '{customer_id}'"
                )
            else:
                from app.models.crm import Customer
                cust_stmt = select(Customer).where(
                    Customer.id == str(customer_id),
                    Customer.is_deleted == False,
                )
                cust = (await session.execute(cust_stmt)).scalar_one_or_none()
                if cust and (
                    cust.is_active is False
                    or getattr(cust, "status", "ACTIVE") in ("INACTIVE", "SUSPENDED")
                ):
                    is_customer_authorized = False
                    contract_status = "CUSTOMER_INACTIVE"
                    rejection_reason = "Customer account is inactive or suspended"
                else:
                    cam_meta = cam.metadata_json or {}
                    allowed_groups = cam_meta.get("eligible_customer_groups")
                    c_group = customer_group_id or (
                        getattr(cust, "customer_group_id", None) if cust else None
                    )
                    if allowed_groups and c_group and (c_group not in allowed_groups):
                        is_customer_authorized = False
                        contract_status = "CUSTOMER_GROUP_MISMATCH"
                        rejection_reason = (
                            f"Customer group '{c_group}' is not eligible for this contract "
                            f"(allowed: {allowed_groups})"
                        )
                    else:
                        is_customer_authorized = True

            # ── Gate 2: Currency Validation ───────────────────────────────
            tx_curr = (transaction_currency or "INR").strip().upper()
            if is_customer_authorized and tx_curr != currency:
                is_customer_authorized = False
                contract_status = "CURRENCY_MISMATCH"
                rejection_reason = (
                    f"Transaction currency '{tx_curr}' does not match "
                    f"contract currency '{currency}'"
                )

            # ── Gate 3: Temporal & Status ─────────────────────────────────
            if is_customer_authorized:
                if not cam.is_active or cam.is_deleted:
                    contract_status = "INACTIVE"
                    rejection_reason = "Contract mapping is inactive or deleted"
                elif cam.status != "ACTIVE":
                    contract_status = cam.status
                    rejection_reason = f"Contract status is {cam.status}"
                elif cam.effective_from and cam.effective_to and cam.effective_from > cam.effective_to:
                    contract_status = "INVALID_DATE_RANGE"
                    rejection_reason = (
                        f"Contract effective_from ({cam.effective_from}) is "
                        f"greater than effective_to ({cam.effective_to})"
                    )
                elif cam.effective_from and as_of < cam.effective_from:
                    contract_status = "FUTURE_CONTRACT"
                    rejection_reason = f"Contract effective date ({cam.effective_from}) is in the future"
                elif cam.effective_to and as_of > cam.effective_to:
                    contract_status = "EXPIRED"
                    rejection_reason = f"Contract expired on ({cam.effective_to})"
                else:
                    contract_status = "ACTIVE"
                    is_contract_active = True

            # ── Gate 4: Rate Resolution ───────────────────────────────────
            if is_contract_active:
                if cam.contract_rate and float(cam.contract_rate) > 0:
                    contract_rate = float(cam.contract_rate)
                    effective_price = contract_rate
                    pricing_rule_applied = "CUSTOMER_CONTRACT_RATE"
                elif cam.contract_discount_pct and float(cam.contract_discount_pct) > 0:
                    contract_discount_pct = float(cam.contract_discount_pct)
                    discount_factor = 1.0 - (contract_discount_pct / 100.0)
                    effective_price = round(base_mrp * discount_factor, 2)
                    pricing_rule_applied = "CUSTOMER_CONTRACT_DISCOUNT"
                else:
                    pricing_rule_applied = "BASE_SELLING_PRICE"
            else:
                if cam.contract_rate:
                    contract_rate = float(cam.contract_rate)
                if cam.contract_discount_pct:
                    contract_discount_pct = float(cam.contract_discount_pct)

        # ── Gate 5: Statutory GST Slab & CGST/SGST/IGST Split ────────────
        tax_rate_f = float(tax_rate or 0.0)
        is_standard_slab = round(tax_rate_f, 2) in cls._STATUTORY_GST_SLABS
        pos = (place_of_supply or "").strip()
        c_state = (company_state or "27").strip()
        tax_amount = round(effective_price * (tax_rate_f / 100.0), 2)

        if pos and pos == c_state:
            # Intra-state: CGST (50%) + SGST (50%)
            cgst_rate = tax_rate_f / 2.0
            sgst_rate = tax_rate_f / 2.0
            igst_rate = 0.0
            cgst_amount = round(effective_price * (cgst_rate / 100.0), 2)
            sgst_amount = round(effective_price * (sgst_rate / 100.0), 2)
            igst_amount = 0.0
        elif pos and pos != c_state:
            # Inter-state: IGST (100%)
            cgst_rate = 0.0
            sgst_rate = 0.0
            igst_rate = tax_rate_f
            cgst_amount = 0.0
            sgst_amount = 0.0
            igst_amount = tax_amount
        else:
            # Default intra-state split
            cgst_rate = tax_rate_f / 2.0
            sgst_rate = tax_rate_f / 2.0
            igst_rate = 0.0
            cgst_amount = round(tax_amount / 2.0, 2)
            sgst_amount = round(tax_amount - cgst_amount, 2)
            igst_amount = 0.0

        effective_price_inclusive = round(effective_price + tax_amount, 2)

        return {
            "effective_price": effective_price,
            "effective_price_inclusive": effective_price_inclusive,
            "tax_treatment": "TAXABLE_EXCLUSIVE",
            "tax_rate": tax_rate_f,
            "tax_amount": tax_amount,
            "currency": currency,
            "contract_rate": contract_rate,
            "contract_discount_pct": contract_discount_pct,
            "pricing_audit": {
                "contract_id": cam.id if cam else None,
                "customer_id": customer_id,
                "as_of_date": str(as_of),
                "effective_from": str(cam.effective_from) if (cam and cam.effective_from) else None,
                "effective_to": str(cam.effective_to) if (cam and cam.effective_to) else None,
                "contract_status": contract_status,
                "is_contract_active": is_contract_active,
                "customer_authorized": is_customer_authorized,
                "pricing_rule_applied": pricing_rule_applied,
                "effective_rate": effective_price,
                "currency": currency,
                "transaction_currency": transaction_currency,
                "rejection_reason": rejection_reason,
                "source_system": cam.source_system if cam else "DEFAULT_PRICE_LIST",
                "verification_status": cam.verification_status if cam else "UNMAPPED",
                "statutory_gst": {
                    "hsn_code": cam.buyer_hsn if (cam and cam.buyer_hsn) else None,
                    "tax_rate": tax_rate_f,
                    "is_standard_slab": is_standard_slab,
                    "place_of_supply": pos or None,
                    "company_state": c_state,
                    "is_inter_state": bool(pos and pos != c_state),
                    "cgst_rate": cgst_rate,
                    "sgst_rate": sgst_rate,
                    "igst_rate": igst_rate,
                    "cgst_amount": cgst_amount,
                    "sgst_amount": sgst_amount,
                    "igst_amount": igst_amount,
                    "total_tax": tax_amount,
                },
            },
        }
