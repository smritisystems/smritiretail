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
from ..models.pricing import CustomerPriceTier
from ..models.item_master import ItemBarcode
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

            branch_state_code = "27"
            branch_gstin = getattr(branch_obj, "gstin", None)
            if branch_gstin and len(branch_gstin) >= 2 and branch_gstin[:2].isdigit():
                branch_state_code = branch_gstin[:2]
            elif comp_obj and comp_obj.gst_number and len(comp_obj.gst_number) >= 2 and comp_obj.gst_number[:2].isdigit():
                branch_state_code = comp_obj.gst_number[:2]

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

            # Statutory GST rate resolution
            gst_rate = item.gst_rate
            if gst_rate is None:
                gst_rate = Decimal("18.00")

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
            )
            calculated_lines.append(line_res)

            if not item.is_fee_line and identity.legacy_product_id:
                batch_deductions.append({
                    "product_id": identity.legacy_product_id,
                    "batch_no": item.batch_no or "DEFAULT",
                    "quantity": qty,
                    "line_no": line_no,
                })

        # 6. Header Aggregation & Round-Off Delta
        subtotal = sum(l.total_amount for l in calculated_lines)
        net_rounded = round_currency(subtotal)
        round_off = net_rounded - subtotal
        discounted_base = total_gross - total_discount

        # 7. Customer Discount Policy Validation
        validate_customer_discount_policy(customer_discount_policy, total_discount, total_gross)

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
