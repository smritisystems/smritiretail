"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless Billing Core & Universal Statutory Engine (Phase 2)
"""

import logging
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..schemas.canonical_posting import (
    CanonicalPostingRequest,
    BillingCalculatedLine,
    BillingCalculationResult,
)
from ..core.gst_engine import (
    calculate_line_item_tax,
    round_currency,
    extract_state_code_from_gstin,
    GST_STATE_CODES,
)
from ..models.crm import Customer, CustomerGroup
from ..models.pricing import CustomerPriceTier, CustomerPriceAssignment, PriceBook
from ..models.item_master import ItemBarcode, ItemVariant, Item
from ..models.inventory import Product
from ..models.tenant import Company, Branch
from .canonical_transaction_writer import CanonicalTransactionWriter, DualKeyWriteIdentity
from .customer_discount_policy import (
    CustomerDiscountPolicy,
    resolve_customer_discount_policy,
    validate_customer_discount_policy,
)

logger = logging.getLogger("smriti.headless_billing")


class HeadlessBillingCore:
    """
    Authoritative Headless Billing Calculation Engine.
    Statutory financial authority for pricing, commercial discounts, GST tax resolution,
    and deterministic commercial ROUND_HALF_UP arithmetic.
    
    Guarantees 100% calculation parity between read-only Preview and final Checkout.
    Zero transactional mutations (no DB inserts/updates, no stock deductions, no ledger mutations).
    """

    @classmethod
    async def calculate_billing(
        cls,
        session: AsyncSession,
        req: CanonicalPostingRequest,
        db_customer: Optional[Customer] = None,
        customer_discount_policy: Optional[CustomerDiscountPolicy] = None,
        is_interstate: Optional[bool] = None,
        promotion_result: Optional[Any] = None,
    ) -> BillingCalculationResult:
        """
        Executes the canonical billing calculation sequence:
        Line Input -> Validation -> Dual-Key Resolution -> Tax Inclusivity ->
        Discounts -> Statutory GST -> Line Totals -> Header Aggregation -> Round-Off -> Net Amount.
        """
        company_id = req.context.company_id
        branch_id = req.context.branch_id

        # 0. Resolve Authoritative Transaction Timestamp
        # Explicit contract: Naive client timestamps are canonically treated as UTC
        raw_posting_dt = getattr(req.context, "posting_date", None) or getattr(req, "posting_date", None)
        if isinstance(raw_posting_dt, date) and not isinstance(raw_posting_dt, datetime):
            posting_dt = datetime.combine(raw_posting_dt, datetime.min.time(), tzinfo=timezone.utc)
        elif raw_posting_dt is None:
            posting_dt = datetime.now(timezone.utc)
        elif raw_posting_dt.tzinfo is None:
            posting_dt = raw_posting_dt.replace(tzinfo=timezone.utc)
        else:
            posting_dt = raw_posting_dt.astimezone(timezone.utc)

        # 1. Resolve Customer if not pre-resolved
        if db_customer is None and req.customer_id and req.customer_id != "CUST-WALKIN":
            q_cust = select(Customer).where(
                Customer.id == req.customer_id,
                Customer.is_deleted == False,
            )
            res_cust = await session.execute(q_cust)
            db_customer = res_cust.scalars().first()
            if db_customer and db_customer.company_id != company_id:
                raise HTTPException(
                    status_code=403,
                    detail=f"SMRITI-CUST-002: Cross-tenant customer access forbidden. Customer '{req.customer_id}' does not belong to company '{company_id}'.",
                )

        # 1b. Resolve Applicable Price Book and Customer Tier from Server-Side Trusted Models
        applicable_price_book_code = getattr(req.context, "price_book_code", None)
        raw_context_tier = getattr(req.context, "customer_tier_code", None)
        applicable_customer_tier_code = None

        if req.customer_id and req.customer_id != "CUST-WALKIN":
            stmt_assign = (
                select(CustomerPriceAssignment, CustomerPriceTier)
                .join(CustomerPriceTier, CustomerPriceAssignment.price_tier_id == CustomerPriceTier.id)
                .where(
                    CustomerPriceAssignment.customer_id == req.customer_id,
                    CustomerPriceAssignment.status == "ACTIVE",
                    CustomerPriceAssignment.is_deleted == False,
                    CustomerPriceTier.is_active == True,
                    CustomerPriceTier.is_deleted == False,
                )
            )
            if company_id:
                stmt_assign = stmt_assign.where(
                    CustomerPriceAssignment.company_id == company_id,
                    CustomerPriceTier.company_id == company_id,
                )
            assign_row = (await session.execute(stmt_assign)).first()
            if assign_row:
                cust_assign, authoritative_tier = assign_row
                # Check assignment temporal validity against posting_dt
                is_assign_valid = True
                if cust_assign.valid_from and posting_dt < cust_assign.valid_from:
                    is_assign_valid = False
                if cust_assign.valid_to and posting_dt > cust_assign.valid_to:
                    is_assign_valid = False

                if is_assign_valid:
                    if raw_context_tier:
                        if raw_context_tier == authoritative_tier.code:
                            applicable_customer_tier_code = authoritative_tier.code
                        else:
                            logger.warning(
                                f"Customer '{req.customer_id}' supplied tier '{raw_context_tier}' does not match authoritative assignment '{authoritative_tier.code}'. Overriding with authoritative tier."
                            )
                            applicable_customer_tier_code = authoritative_tier.code
                    else:
                        applicable_customer_tier_code = authoritative_tier.code

                    # Inherit tier price book if unassigned
                    if not applicable_price_book_code and authoritative_tier.price_book_id:
                        stmt_pb = select(PriceBook).where(
                            PriceBook.id == authoritative_tier.price_book_id,
                            PriceBook.status == "ACTIVE",
                            PriceBook.is_deleted == False,
                        )
                        if company_id:
                            stmt_pb = stmt_pb.where(PriceBook.company_id == company_id)
                        pb_match = (await session.execute(stmt_pb)).scalars().first()
                        if pb_match:
                            applicable_price_book_code = pb_match.code
                elif raw_context_tier:
                    logger.warning(
                        f"Customer '{req.customer_id}' assignment to '{authoritative_tier.code}' is not valid as of '{posting_dt}'. Discarding tier."
                    )
            elif raw_context_tier:
                logger.warning(
                    f"Customer '{req.customer_id}' has no active tier assignment for company '{company_id}'. Discarding unauthorized context tier '{raw_context_tier}'."
                )
        elif raw_context_tier:
            # Walk-in customers cannot claim customer tiers
            logger.warning(
                f"Walk-in customer '{req.customer_id}' cannot claim customer price tier '{raw_context_tier}'. Discarding tier."
            )

        # Validate context price book if passed explicitly
        if applicable_price_book_code:
            stmt_check_pb = select(PriceBook).where(
                PriceBook.code == applicable_price_book_code,
                PriceBook.status == "ACTIVE",
                PriceBook.is_deleted == False,
            )
            if company_id:
                stmt_check_pb = stmt_check_pb.where(PriceBook.company_id == company_id)
            valid_pb = (await session.execute(stmt_check_pb)).scalars().first()
            if not valid_pb:
                logger.warning(f"Price Book '{applicable_price_book_code}' not active for company '{company_id}'. Ignoring context override.")
                applicable_price_book_code = None
            else:
                # Check date validity of price book against posting_dt
                if valid_pb.valid_from and posting_dt < valid_pb.valid_from:
                    logger.warning(f"Price Book '{applicable_price_book_code}' not yet valid as of '{posting_dt}'. Ignoring context override.")
                    applicable_price_book_code = None
                elif valid_pb.valid_to and posting_dt > valid_pb.valid_to:
                    logger.warning(f"Price Book '{applicable_price_book_code}' expired as of '{posting_dt}'. Ignoring context override.")
                    applicable_price_book_code = None

        # Fallback to default company price book if unassigned
        if not applicable_price_book_code:
            stmt_def_pb = select(PriceBook).where(
                PriceBook.is_default == True,
                PriceBook.status == "ACTIVE",
                PriceBook.is_deleted == False,
            )
            if company_id:
                stmt_def_pb = stmt_def_pb.where(PriceBook.company_id == company_id)
            def_pb_match = (await session.execute(stmt_def_pb)).scalars().first()
            if def_pb_match:
                # Check default price book date validity
                is_def_valid = True
                if def_pb_match.valid_from and posting_dt < def_pb_match.valid_from:
                    is_def_valid = False
                if def_pb_match.valid_to and posting_dt > def_pb_match.valid_to:
                    is_def_valid = False
                if is_def_valid:
                    applicable_price_book_code = def_pb_match.code

        # 2. Resolve Customer Discount Policy if not pre-resolved
        if customer_discount_policy is None:
            customer_discount_policy = await resolve_customer_discount_policy(
                session=session,
                customer_id=req.customer_id,
                company_id=company_id,
                branch_id=branch_id,
            )

        # 3. Resolve Jurisdiction / Interstate Tax Status if not pre-resolved
        place_of_supply_code = None
        if is_interstate is None:
            comp_obj = await session.get(Company, company_id)
            branch_obj = await session.get(Branch, branch_id) if branch_id else None
            branch_state_code = None
            branch_gstin = getattr(branch_obj, "gstin", None) or getattr(branch_obj, "gst_number", None)
            if branch_gstin and len(branch_gstin) >= 2 and branch_gstin[:2].isdigit():
                branch_state_code = branch_gstin[:2]
            elif branch_obj and getattr(branch_obj, "state_code", None):
                branch_state_code = str(branch_obj.state_code).zfill(2)
            elif comp_obj and comp_obj.gst_number and len(comp_obj.gst_number) >= 2 and comp_obj.gst_number[:2].isdigit():
                branch_state_code = comp_obj.gst_number[:2]
            elif comp_obj and getattr(comp_obj, "state_code", None):
                branch_state_code = str(comp_obj.state_code).zfill(2)

            if not branch_state_code:
                from .system_parameter import SystemParameterService
                state_param = await SystemParameterService.resolve_parameter(
                    db=session,
                    param_code="SMRITI.TAX.DEFAULT_STATE_CODE",
                    company_id=company_id,
                    branch_id=branch_id,
                )
                if state_param and state_param.effective_value:
                    branch_state_code = str(state_param.effective_value).zfill(2)

            if not branch_state_code:
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-JURISDICTION-001: Seller tax jurisdiction cannot be resolved for billing. Company/Branch GSTIN, state code, or SMRITI.TAX.DEFAULT_STATE_CODE must be configured.",
                )

            customer_state_code = branch_state_code
            cust_gst = req.customer_gstin or (getattr(db_customer, "gst_number", None) or getattr(db_customer, "gstin", None) if db_customer else None)
            if cust_gst:
                extracted_sc = extract_state_code_from_gstin(cust_gst)
                if extracted_sc:
                    customer_state_code = extracted_sc
            elif req.place_of_supply:
                customer_state_code = req.place_of_supply[:2]

            place_of_supply_code = customer_state_code
            is_interstate = (customer_state_code != branch_state_code)
        else:
            place_of_supply_code = req.place_of_supply[:2] if req.place_of_supply else None

        # 4. Calculation Variables
        calculated_lines: List[BillingCalculatedLine] = []
        batch_deductions: List[Dict[str, Any]] = []

        total_gross = Decimal("0.00")
        total_discount = Decimal("0.00")
        total_taxable = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")
        total_tax = Decimal("0.00")
        total_quantity = Decimal("0.0000")

        cart_gross_total = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in req.items
        )

        # 5. Process Line Items Sequentially
        for idx, item in enumerate(req.items):
            line_no = idx + 1
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.unit_price))

            # Input Validations
            if qty <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-002: Line item '{item.code}' has non-positive quantity ({item.quantity}). Quantity must be greater than zero.",
                )
            if rate < Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-003: Line item '{item.code}' has negative unit price ({item.unit_price}). Unit price cannot be negative.",
                )
            is_free = bool(getattr(item, "is_free_item", False) or item.is_fee_line)
            if rate <= Decimal("0.00") and not is_free:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-PRICE-002: Line item '{item.code}' has zero or missing unit price ({item.unit_price}). Valid price is required.",
                )
            if item.mrp and Decimal(str(item.mrp)) > Decimal("0.00") and rate > Decimal(str(item.mrp)):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-PRICE-001: Selling price (₹{rate:,.2f}) cannot exceed statutory MRP (₹{Decimal(str(item.mrp)):,.2f}) for item '{item.name or item.code}'.",
                )

            # Centralized Product Resolution & Validation
            from .product_resolution_service import ProductResolutionService
            from ..schemas.product_resolution import TransactionLineItemInput

            line_res = await ProductResolutionService.validate_line(
                session=session,
                company_id=company_id,
                line=TransactionLineItemInput(
                    line_no=line_no,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    item_id=item.item_id,
                    code=item.code,
                    sku=item.code,
                    barcode=item.code,
                    quantity=qty,
                    is_fee_line=item.is_fee_line,
                ),
                allow_inactive=False,
            )
            if not line_res.success and not item.is_fee_line:
                err = line_res.error_detail
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": line_res.code or "PRODUCT_NOT_FOUND",
                        "title": err.title if err else "Product Not Found",
                        "explanation": f"Line {line_no}: {err.explanation if err else 'Product identity resolution failed.'}",
                        "suggested_action": err.suggested_action if err else "Please add the product to Product List before continuing.",
                        "line_no": line_no,
                        "identifier": item.code or item.product_id or item.variant_id,
                    },
                )

            # Dual-Key Item Identity Resolution
            identity = await CanonicalTransactionWriter.resolve_dual_key_for_line(
                session=session,
                company_id=company_id,
                variant_id=item.variant_id or line_res.variant_id,
                item_id=item.item_id or line_res.item_id,
                product_id=item.product_id or line_res.product_id,
                code_or_barcode=item.code,
                is_fee_line=item.is_fee_line,
            )

            if not identity.is_valid and not item.is_fee_line and line_res.success:
                identity = DualKeyWriteIdentity(
                    canonical_variant_id=line_res.variant_id,
                    canonical_item_id=line_res.item_id,
                    legacy_product_id=line_res.product_id,
                    sku=line_res.sku,
                    name=line_res.name,
                    line_type="PHYSICAL_INVENTORY",
                    is_valid=True,
                    is_quarantined=False,
                    is_consistent=(line_res.product_id is not None and line_res.variant_id is not None),
                )

            if not identity.is_valid and not item.is_fee_line:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": identity.error_code or "PRODUCT_NOT_FOUND",
                        "title": "Product Validation Failed",
                        "explanation": f"Line {line_no}: {identity.error_message or 'Item identity resolution failed.'}",
                        "suggested_action": "Please verify product identity before submitting transaction.",
                        "line_no": line_no,
                        "identifier": item.code or item.product_id,
                    },
                )

            # Authoritative Backend Price Resolution & Statutory Verification
            # Route strictly through PricingEngine.calculate_effective_price (Single Authoritative Resolver)
            from .pricing_engine import PricingEngine
            resolved_price_info = None
            if not item.is_fee_line and not is_free:
                target_item_id = identity.canonical_item_id or identity.legacy_product_id or item.item_id or item.product_id
                target_variant_id = identity.canonical_variant_id or item.variant_id
                if target_variant_id and not target_item_id:
                    stmt_v = select(ItemVariant.item_id).where(ItemVariant.id == target_variant_id)
                    target_item_id = (await session.execute(stmt_v)).scalar_one_or_none()
                elif target_item_id and not target_variant_id:
                    stmt_first_v = select(ItemVariant.id).where(ItemVariant.item_id == target_item_id)
                    target_variant_id = (await session.execute(stmt_first_v)).scalars().first()

                # Authoritative posting_dt was normalized at function start
                try:
                    resolved_price_info = await PricingEngine.calculate_effective_price(
                        session=session,
                        item_id=target_item_id or target_variant_id,
                        variant_id=target_variant_id,
                        quantity=qty,
                        price_book_code=applicable_price_book_code,
                        customer_tier_code=applicable_customer_tier_code,
                        as_of_date=posting_dt,
                        company_id=company_id,
                    )
                except Exception as pe_err:
                    logger.error(f"PricingEngine resolution failed for line {line_no} ({item.code}): {pe_err}")
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "SMRITI-PRICE-RESOLVE-FAILED",
                            "title": "Authoritative Price Resolution Failed",
                            "explanation": f"Line {line_no} ({item.name or item.code}): Unable to resolve authoritative catalog price or statutory MRP ({str(pe_err)}).",
                            "suggested_action": "Verify catalog price setup for this item or consult store manager.",
                            "line_no": line_no,
                            "identifier": item.code or item.product_id or target_item_id,
                        },
                    )

                if (
                    not resolved_price_info
                    or resolved_price_info.get("effective_unit_price") is None
                    or resolved_price_info.get("base_mrp") is None
                ):
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "SMRITI-PRICE-RESOLVE-FAILED",
                            "title": "Authoritative Price Missing",
                            "explanation": f"Line {line_no} ({item.name or item.code}): Authoritative catalog price or statutory MRP is missing in system of record.",
                            "suggested_action": "Please configure a valid selling price and MRP in item master before billing.",
                            "line_no": line_no,
                            "identifier": item.code or item.product_id or target_item_id,
                        },
                    )

                auth_mrp = Decimal(str(resolved_price_info["base_mrp"]))
                auth_sp = Decimal(str(resolved_price_info["effective_unit_price"]))

                # 1. Statutory MRP ceiling check: Rate cannot exceed authoritative MRP
                if rate > auth_mrp:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-PRICE-001: Selling price (₹{rate:,.2f}) cannot exceed statutory MRP (₹{auth_mrp:,.2f}) for item '{item.name or item.code}'.",
                    )

                # 2. Rate Deviation Check: requires supervisor override if different from authoritative rate
                if rate != auth_sp:
                    has_supervisor_override = bool(getattr(req.context, "supervisor_override_code", None))
                    if not has_supervisor_override:
                        raise HTTPException(
                            status_code=400,
                            detail={
                                "code": "SMRITI-PRICE-OVERRIDE-REQ",
                                "title": "Supervisor Price Override Required",
                                "explanation": f"Line {line_no} ({item.name or item.code}): Unit price ₹{rate:,.2f} deviates from authoritative rate ₹{auth_sp:,.2f}.",
                                "suggested_action": "Enter supervisor authorization code to apply custom rate, or use standard catalog price.",
                                "line_no": line_no,
                                "authoritative_price": float(auth_sp),
                                "submitted_price": float(rate),
                            },
                        )

            # Determine Tax Inclusivity via 5-tier statutory hierarchy:
            # 1. Line Item Override
            # 2. Barcode level (actual sellable unit)
            # 3. Customer level (customer commercial contract)
            # 4. Customer Group / Price Group level
            # 5. Source channel default (POS_RETAIL -> True, other -> False)
            if item.is_tax_inclusive is not None:
                tax_inc = item.is_tax_inclusive
            else:
                barcode_tax_inc = None
                code_to_check = str(item.code or "").strip()
                if code_to_check:
                    bc_tax = await session.scalar(
                        select(ItemBarcode.is_tax_inclusive).where(
                            ItemBarcode.company_id == company_id,
                            ItemBarcode.barcode == code_to_check,
                            ItemBarcode.is_deleted == False,
                        ).limit(1)
                    )
                    if bc_tax is not None:
                        barcode_tax_inc = bc_tax

                if barcode_tax_inc is None and identity.canonical_variant_id:
                    bc_tax = await session.scalar(
                        select(ItemBarcode.is_tax_inclusive).where(
                            ItemBarcode.variant_id == identity.canonical_variant_id,
                            ItemBarcode.is_tax_inclusive.is_not(None),
                            ItemBarcode.is_deleted == False,
                        ).limit(1)
                    )
                    if bc_tax is not None:
                        barcode_tax_inc = bc_tax

                customer_tax_inc = getattr(db_customer, "is_tax_inclusive", None) if db_customer else None

                price_group_tax_inc = None
                if db_customer:
                    if getattr(db_customer, "customer_group_id", None):
                        cg_tax = await session.scalar(
                            select(CustomerGroup.is_tax_inclusive).where(
                                CustomerGroup.id == db_customer.customer_group_id,
                                CustomerGroup.is_deleted == False,
                            )
                        )
                        if cg_tax is not None:
                            price_group_tax_inc = cg_tax
                    elif getattr(db_customer, "price_tier_id", None):
                        cpt_tax = await session.scalar(
                            select(CustomerPriceTier.is_tax_inclusive).where(
                                CustomerPriceTier.id == db_customer.price_tier_id,
                                CustomerPriceTier.is_deleted == False,
                            )
                        )
                        if cpt_tax is not None:
                            price_group_tax_inc = cpt_tax

                if barcode_tax_inc is not None:
                    tax_inc = barcode_tax_inc
                elif customer_tax_inc is not None:
                    tax_inc = customer_tax_inc
                elif price_group_tax_inc is not None:
                    tax_inc = price_group_tax_inc
                elif req.context.source_channel == "POS_RETAIL":
                    tax_inc = True
                else:
                    tax_inc = False

            # Statutory GST rate resolution (P0-5)
            gst_rate = item.gst_rate
            if gst_rate is None:
                if line_res and line_res.success and line_res.tax_rate is not None:
                    gst_rate = Decimal(str(line_res.tax_rate))
                elif item.is_fee_line or getattr(item, "is_free_item", False):
                    gst_rate = Decimal("0.00")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "SMRITI-TAX-001",
                            "title": "Missing Statutory GST Rate",
                            "explanation": f"Line {line_no}: Item '{item.name or item.code}' has no valid GST tax rate specified or resolved from item master.",
                            "suggested_action": "Please specify a statutory GST rate or configure the item tax rate in the master catalog.",
                            "line_no": line_no,
                        },
                    )

            if gst_rate is not None and Decimal(str(gst_rate)) < Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-TAX-004: Line item '{item.code}' has negative GST tax rate ({gst_rate}). Valid tax classification required.",
                )

            # Gross base & Line discount
            gross_base = qty * rate
            disc_amount = Decimal("0.00")

            if promotion_result:
                promo_total = Decimal(str(promotion_result.total_promotional_discount))
                disc_amount = round_currency(promo_total * gross_base / cart_gross_total) if cart_gross_total > 0 else Decimal("0.00")
            else:
                if item.disc_pct and item.disc_pct > 0:
                    disc_amount += round_currency(gross_base * Decimal(str(item.disc_pct)) / Decimal("100.00"))
                if item.disc_amt and item.disc_amt > 0:
                    disc_amount += Decimal(str(item.disc_amt))
            disc_amount = min(disc_amount, gross_base)

            # Statutory Tax Engine Calculation
            tax_dict = calculate_line_item_tax(
                unit_price=rate,
                quantity=qty,
                discount_amount=disc_amount,
                gst_rate=Decimal(str(gst_rate)),
                is_tax_inclusive=tax_inc,
                is_interstate=is_interstate,
            )

            # Accumulate Header Totals
            total_gross += gross_base
            total_discount += disc_amount
            total_taxable += tax_dict["taxable_value"]
            total_cgst += tax_dict["cgst_amount"]
            total_sgst += tax_dict["sgst_amount"]
            total_igst += tax_dict["igst_amount"]
            total_tax += tax_dict["tax_amount"]
            total_quantity += qty

            line_res = BillingCalculatedLine(
                line_no=line_no,
                variant_id=identity.canonical_variant_id,
                item_id=identity.canonical_item_id,
                product_id=identity.legacy_product_id,
                code=item.code,
                name=item.name or identity.name or "Item",
                quantity=qty,
                unit_price=rate,
                disc_pct=(disc_amount / gross_base * Decimal("100.00")) if gross_base > 0 else Decimal("0.00"),
                discount_amount=disc_amount,
                taxable_value=tax_dict["taxable_value"],
                gst_rate=gst_rate,
                cgst_amount=tax_dict["cgst_amount"],
                sgst_amount=tax_dict["sgst_amount"],
                igst_amount=tax_dict["igst_amount"],
                tax_amount=tax_dict["tax_amount"],
                total_amount=tax_dict["total_amount"],
                is_tax_inclusive=tax_inc,
                batch_no=item.batch_no or "DEFAULT",
                hsn_code=item.hsn_code or "9999",
                mrp=Decimal(str(item.mrp)) if item.mrp else None,
                customer_po_line_id=item.customer_po_line_id,
                source_line_type=item.source_line_type or ("CUSTOMER_PO" if item.customer_po_line_id else "DIRECT"),
                source_line_id=item.source_line_id,
                salesperson_id=getattr(item, "salesperson_id", None) or getattr(req, "salesperson_id", None) or getattr(req.context, "cashier_id", None),
                salesperson_name=getattr(item, "salesperson_name", None) or getattr(req, "salesperson_name", None),
                batch_id=getattr(item, "batch_id", None),
                serial_id=getattr(item, "serial_id", None),
                warehouse_location_id=getattr(item, "warehouse_location_id", None),
            )
            calculated_lines.append(line_res)

            if not item.is_fee_line and identity.legacy_product_id:
                batch_deductions.append({
                    "product_id": identity.legacy_product_id,
                    "batch_no": item.batch_no or "DEFAULT",
                    "quantity": qty,
                    "line_no": line_no,
                    "batch_id": getattr(item, "batch_id", None),
                    "serial_id": getattr(item, "serial_id", None),
                    "warehouse_location_id": getattr(item, "warehouse_location_id", None),
                })

        # 6. Header Aggregation & Round-Off Delta
        subtotal = sum(l.total_amount for l in calculated_lines)
        net_rounded = round_currency(subtotal)
        round_off = net_rounded - subtotal
        discounted_base = total_gross - total_discount

        # 7. Customer Discount Policy Validation
        # Skip when supervisor_override_code is present (bulk import / B2B contracted pricing)
        has_supervisor_override = bool(getattr(req.context, "supervisor_override_code", None))
        if not has_supervisor_override:
            validate_customer_discount_policy(customer_discount_policy, total_discount, total_gross)

        # 7.5 Server-Authoritative Invoice Maximum Discount Ceiling (P0-3)
        # Skipped when supervisor override is present (bulk import / B2B contracted pricing)
        if not has_supervisor_override:
            from .system_parameter import SystemParameterService
            max_disc_param = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT",
                company_id=company_id,
                terminal_id=getattr(req.context, "terminal_id", "COMMON") or "COMMON",
                branch_id=branch_id,
            )
            if max_disc_param and max_disc_param.effective_value is not None:
                configured_max_cap = Decimal(str(max_disc_param.effective_value))
                if configured_max_cap > 0 and total_gross > 0:
                    actual_discount_pct = (total_discount / total_gross) * Decimal("100.00")
                    if actual_discount_pct > configured_max_cap:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"SMRITI-PRICING-001: Invoice discount of {actual_discount_pct:.2f}% exceeds the maximum "
                                f"configured ceiling of {configured_max_cap:.2f}% (governed by SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT)."
                            ),
                        )

        return BillingCalculationResult(
            gross_amount=total_gross,
            discount_amount=total_discount,
            discounted_base=discounted_base,
            taxable_amount=total_taxable,
            cgst_amount=total_cgst,
            sgst_amount=total_sgst,
            igst_amount=total_igst,
            tax_total=total_tax,
            subtotal=subtotal,
            round_off=round_off,
            net_amount=net_rounded,
            items_count=len(calculated_lines),
            total_quantity=total_quantity,
            is_interstate=is_interstate,
            place_of_supply=place_of_supply_code,
            customer_id=db_customer.id if db_customer else req.customer_id,
            customer_name=req.customer_name or (db_customer.name if db_customer else "Walk-in Customer"),
            lines=calculated_lines,
            batch_deductions=batch_deductions,
        )
