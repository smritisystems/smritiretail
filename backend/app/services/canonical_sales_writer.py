"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.35
Created      : 2026-09-08
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Sales Posting Writer & Universal Financial Engine (Phase 2C Step 2)
"""

import uuid
import logging
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload


from ..schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingResult,
    CanonicalPostingLineResult,
)
from ..schemas.payments import PaymentTenderItem, ProcessPaymentRequest
from ..core.gst_engine import (
    calculate_line_item_tax,
    round_currency,
    extract_state_code_from_gstin,
    validate_gstin,
    GST_STATE_CODES,
)
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.pos import Shift
from ..models.crm import Customer, CustomerGroup, CustomerPolicy, CustomerCompanyRelationship, CustomerCreditLedgerEntry, CustomerGSTRegistration, CustomerDeliveryLocation, CustomerBillingLocation
from ..models.customer_po import CustomerPurchaseOrder, CustomerPurchaseOrderLine, CustomerPOInvoiceAllocation
from ..models.pricing import CustomerPriceTier
from ..models.item_master import ItemBarcode, ItemPrice
from ..models.inventory import Product, Warehouse
from ..models.tenant import Company, Branch
from ..core.sales_channels import channel_requires_store_location
from .canonical_transaction_writer import CanonicalTransactionWriter
from .inventory_wms import InventoryWmsService
from .payments_engine import PaymentsEngine
from .outbox_service import OutboxService
from .numbering import NumberingService
from .identity.engine import IdentityEngine
from .customer_discount_policy import resolve_customer_discount_policy, validate_customer_discount_policy
from .system_parameter import SystemParameterService
from .promotions_engine import PromotionsEngine
from ..schemas.promotions import PromotionCartItem, PromotionEvaluationRequest, PromotionRedemptionRequest
from ..api.deps import TenantContext

logger = logging.getLogger("smriti.canonical_sales_writer")


class CanonicalSalesPostingWriter:
    """
    Sole authoritative transaction writer for all Sales and Billing postings across SMRITI Retail OS.
    Ingresses from POS, B2B Tax Invoicing, Customer PO, and Sales Orders converge here.
    
    Invariants:
    1. Caller-controlled AsyncSession: DOES NOT commit unless commit=True is explicitly passed.
    2. Idempotency: Duplicate idempotency_key yields cached/replayed result.
    3. Dual-Key Parity: Enforces canonical variant_id + legacy product_id consistency.
    4. Statutory GST: calculate_line_item_tax with inclusive/exclusive modes.
    5. Physical Stock: Mutates batch inventory and writes immutable StockMovement.
    6. Payments: Atomic multi-tender payment recording via PaymentsEngine.
    7. Outbox: Atomic IntegrationOutboxEvent in same database transaction.
    """

    @classmethod
    async def post_sales_transaction(
        cls,
        session: AsyncSession,
        req: CanonicalPostingRequest,
        idempotency_key: Optional[str] = None,
        commit: bool = False,
        authorized_credit_override: bool = False,
        credit_override_actor: Optional[str] = None,
        authorized_transaction_mode_change: bool = False,
        authorized_price_override: bool = False,
        authorized_discount_override: bool = False,
        authorized_adjustment_override: bool = False,
    ) -> CanonicalPostingResult:
        """
        Executes an atomic sales transaction posting under caller session control.
        """
        company_id = req.context.company_id
        branch_id = req.context.branch_id
        warehouse_id = req.context.warehouse_id
        shift_id = req.context.shift_id
        idempotency_key = idempotency_key or req.context.idempotency_key

        from .billing_profile_service import BillingProfileService
        billing_configuration = await BillingProfileService.resolve_transaction_configuration(
            session, company_id, branch_id
        )
        context_channel = (
            req.context.source_channel
            if req.context.source_channel in billing_configuration["allowed_sales_channels"]
            else None
        )
        sales_channel = (
            req.sales_channel
            or req.context.sales_channel
            or billing_configuration.get("default_sales_channel")
            or context_channel
        )
        source_type = (
            req.source_document_type
            or ("CUSTOMER_PO" if req.customer_po_id else None)
            or ("SALES_ORDER" if req.so_reference_no else None)
            or billing_configuration.get("default_source_type")
            or "DIRECT"
        )
        sales_channel = sales_channel or "B2B_WHOLESALE"
        incoming_billing_snapshot = req.billing_configuration_snapshot or {}
        bill_type = (
            incoming_billing_snapshot.get("bill_type")
            or billing_configuration.get("default_bill_type")
        )
        allowed_bill_types = {
            str(value).strip().casefold(): str(value).strip()
            for value in billing_configuration["allowed_bill_types"]
        }
        if sales_channel not in billing_configuration["allowed_sales_channels"]:
            raise HTTPException(status_code=422, detail="The selected sales channel is not permitted by company or branch billing policy.")
        if source_type not in billing_configuration["allowed_source_types"]:
            raise HTTPException(status_code=422, detail="The selected billing source is not permitted by company or branch billing policy.")
        if str(bill_type).strip().casefold() not in allowed_bill_types:
            raise HTTPException(status_code=422, detail="The selected bill type is not permitted by company or branch billing policy.")
        bill_type = allowed_bill_types[str(bill_type).strip().casefold()]
        transaction_type = (
            "CREDIT"
            if (req.payment_mode or "").strip().upper() in {"CREDIT", "ON_ACCOUNT"}
            or any(tender.tender_type.strip().upper() == "CREDIT" for tender in req.tenders)
            else "CASH"
        )
        has_credit_tender = (
            (req.payment_mode or "").strip().upper() in {"CREDIT", "ON_ACCOUNT"}
            or any(tender.tender_type.strip().upper() == "CREDIT" for tender in req.tenders)
        )
        has_cash_tender = (
            any(tender.tender_type.strip().upper() != "CREDIT" for tender in req.tenders)
            if req.tenders
            else (req.payment_mode or "").strip().upper() not in {"CREDIT", "ON_ACCOUNT"}
        )
        required_transactions = {
            kind for kind, required in (("CREDIT", has_credit_tender), ("CASH", has_cash_tender)) if required
        }
        if not required_transactions.issubset(set(billing_configuration["allowed_transactions"])):
            raise HTTPException(status_code=422, detail="The selected cash or credit transaction type is not permitted by company or branch billing policy.")

        # 0. Authoritative Input & Identity Validations
        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-VAL-001: Sales transaction must contain at least one line item.",
            )

        # 0A. Authoritative Company and Seller Identity Validation
        q_comp = select(Company).where(Company.id == company_id)
        res_comp = await session.execute(q_comp)
        comp_obj = res_comp.scalars().first()

        if not comp_obj or not comp_obj.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-TENANT-002: Authoritative company identity '{company_id}' is missing or inactive. Invoice issuance blocked.",
            )

        q_branch = select(Branch).where(Branch.company_id == company_id)
        if branch_id:
            q_branch = q_branch.where((Branch.id == branch_id) | (Branch.code == branch_id))
        res_br = await session.execute(q_branch)
        branch_obj = res_br.scalars().first()

        seller_gstin = (branch_obj and getattr(branch_obj, "gst_number", None)) or (comp_obj and comp_obj.gst_number)
        
        # Statutory Tax Invoice vs Retail Receipt / Bill of Supply Determination
        is_b2b = bool(
            req.customer_gstin
            or getattr(req, "billed_party_gstin_id", None)
            or req.context.source_channel == "B2B_WHOLESALE"
            or sales_channel == "B2B_WHOLESALE"
        )
        req_doc_type = getattr(req, "document_type", None) or getattr(req.context, "document_type", None)
        has_positive_tax = any(
            item.gst_rate is not None and Decimal(str(item.gst_rate)) > Decimal("0.00")
            for item in req.items
        )

        if not seller_gstin:
            if is_b2b or req_doc_type == "TAX_INVOICE" or has_positive_tax:
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-TAX-002: Authoritative seller GSTIN is missing. Statutory tax invoice issuance blocked.",
                )
            gst_sc = None
        else:
            val_gst, gst_sc, _ = validate_gstin(seller_gstin)
            if not val_gst:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-TAX-003: Authoritative seller GSTIN '{seller_gstin}' is invalid. Statutory tax invoice issuance blocked.",
                )

        for t in req.tenders:
            if Decimal(str(t.amount)) <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-004: Tender amount for mode '{t.tender_type}' must be greater than zero.",
                )
            if t.tender_type.upper() == "CASH" and Decimal(str(t.amount)) >= Decimal("200000.00"):
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-TAX-269ST: Cash receipt of ₹2,00,000 or more in a single transaction is prohibited under Section 269ST of the Income Tax Act.",
                )

        # 0B. Authoritative Company Billing Profile Policy Verification
        from .billing_profile_service import BillingProfileService
        prof_res = await BillingProfileService.get_effective_profile(session, company_id, branch_id)
        if prof_res.get("configured"):
            eff_prof = prof_res.get("effective_configuration") or {}
            # B2B Registered Customer Selection Check
            if eff_prof.get("customer_selection_required"):
                cust_id = (req.customer_id or "").strip().upper()
                if not cust_id or cust_id in ("CUST-WALKIN", "WALKIN"):
                    raise HTTPException(
                        status_code=400,
                        detail="SMRITI-VAL-CUST-001: Registered business customer selection is required under company B2B billing policy.",
                    )
            # B2B Mandatory Customer PO Check
            if eff_prof.get("customer_po_reference") == "REQUIRED":
                if not (req.po_reference_no or req.customer_po_id):
                    raise HTTPException(
                        status_code=400,
                        detail="SMRITI-VAL-PO-001: Customer PO Reference is mandatory under current company B2B billing policy.",
                    )
            # Shift Enforcement Check for POS Retail Transactions
            if eff_prof.get("shift_management") == "ENABLED":
                if req.context.source_channel in ("POS_RETAIL", "RETAIL", "POS") and not shift_id:
                    raise HTTPException(
                        status_code=400,
                        detail="SMRITI-POS-003: An open cashier shift is required to process POS retail transactions under current company policy.",
                    )

            # 0C. Price Level Resolution & Authoritative Per-Line Price Enforcement
            # ── Tier resolution ────────────────────────────────────────────────
            customer_pricing_basis = None
            if db_customer:
                customer_pricing_basis = getattr(db_customer, "pricing_basis", None)
            # Rec 6: cashier_price_level_override is now a typed Literal on CanonicalPostingContext
            cashier_override_level = req.context.cashier_price_level_override  # None | MRP | SELLING_PRICE | WHOLESALE_PRICE | PRICE_BOOK

            # AUTHORIZED_ONLY gate: cashier override requires a supervisor_override_code
            if (cashier_override_level and
                    str(eff_prof.get("cashier_price_override", "DISABLED")).upper() == "AUTHORIZED_ONLY" and
                    not req.context.supervisor_override_code):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "SMRITI-PRICE-AUTH-001: Changing the billing price level to "
                        f"'{cashier_override_level}' requires a supervisor authorization code "
                        "under current company policy (cashier_price_override = AUTHORIZED_ONLY). "
                        "Please obtain a supervisor code and retry."
                    ),
                )

            price_level_ctx = BillingProfileService.resolve_effective_price_level(
                effective_config=eff_prof,
                customer_pricing_basis=customer_pricing_basis,
                cashier_override_level=cashier_override_level,
            )
            effective_level = price_level_ctx["effective_price_level"]
            cashier_override_permitted = price_level_ctx["cashier_override_permitted"]

            # Attach resolved context for downstream audit
            if hasattr(req, "context") and req.context is not None:
                try:
                    object.__setattr__(req.context, "_resolved_price_level", price_level_ctx)
                except (AttributeError, TypeError):
                    pass

            # ── Authoritative per-line price enforcement ────────────────────
            # For each non-fee line, fetch authoritative price from item_prices.
            # Enforce:
            #   1. Statutory MRP ceiling: unit_price MUST NOT exceed item_prices.mrp — always.
            #   2. DISABLED override: unit_price must not exceed the authoritative price
            #      for the effective_level (SELLING_PRICE.selling_price, WHOLESALE_PRICE.wholesale_price).
            #   MRP level needs no further check beyond ceiling (billing at MRP is the ceiling itself).
            #   PRICE_BOOK level: server-side resolution via PriceBookEntry; skip field enforcement here.
            for line_item in req.items:
                if getattr(line_item, "is_fee_line", False) or getattr(line_item, "is_free_item", False):
                    continue  # Fee/free lines are exempt from price level enforcement

                client_price = Decimal(str(getattr(line_item, "unit_price", None) or 0))

                # Determine variant_id: prefer explicit variant_id, fall back to product_id
                vid = (getattr(line_item, "variant_id", None) or
                       getattr(line_item, "product_id", None))

                # Fetch authoritative price row (single index lookup on primary key + company)
                auth_price: Optional[ItemPrice] = None
                if vid:
                    ip_stmt = select(ItemPrice).where(
                        ItemPrice.item_variant_id == vid,
                        ItemPrice.company_id == company_id,
                    )
                    auth_price = (await session.execute(ip_stmt)).scalar_one_or_none()

                # Fall back to client-supplied mrp if no authoritative row found
                auth_mrp = Decimal(str(auth_price.mrp or 0)) if auth_price and auth_price.mrp else \
                           Decimal(str(getattr(line_item, "mrp", None) or 0))

                # ── Gate 1: Statutory MRP ceiling (absolute — Legal Metrology Act) ──
                if auth_mrp > Decimal("0") and client_price > auth_mrp:
                    item_label = getattr(line_item, "name", None) or vid or "UNKNOWN"
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"SMRITI-PRICE-MRP-001: Item '{item_label}' has unit price "
                            f"\u20b9{client_price} which exceeds the statutory MRP \u20b9{auth_mrp}. "
                            "Billing above MRP is prohibited under the Legal Metrology Act. "
                            "Please correct the price and retry."
                        ),
                    )

                # ── Gate 2: Price level ceiling (only when override is DISABLED) ──
                if not cashier_override_permitted and auth_price is not None:
                    if effective_level == "SELLING_PRICE":
                        auth_ceil = Decimal(str(auth_price.selling_price or 0))
                        level_label = "standard selling price"
                        code = "SMRITI-PRICE-SELL-001"
                    elif effective_level == "WHOLESALE_PRICE":
                        auth_ceil = Decimal(
                            str(auth_price.wholesale_price or auth_price.selling_price or 0)
                        )
                        level_label = "wholesale price"
                        code = "SMRITI-PRICE-WHSL-001"
                    else:
                        auth_ceil = Decimal("0")  # MRP handled above; PRICE_BOOK skipped
                        code = ""
                        level_label = ""

                    if code and auth_ceil > Decimal("0") and client_price > auth_ceil:
                        item_label = getattr(line_item, "name", None) or vid or "UNKNOWN"
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"{code}: Item '{item_label}' has unit price \u20b9{client_price} "
                                f"which exceeds the authoritative {level_label} \u20b9{auth_ceil}. "
                                "Price overrides are not permitted under current billing policy "
                                "(cashier_price_override = DISABLED). "
                                "Contact a supervisor to authorise a price override."
                            ),
                        )

        # 1. POS Shift row lock & validation (if shift_id provided)
        shift_obj: Optional[Shift] = None
        if shift_id:
            q_shift = (
                select(Shift)
                .where(
                    Shift.id == shift_id,
                    Shift.company_id == company_id,
                    Shift.is_deleted == False,
                )
                .with_for_update()
            )
            res_shift = await session.execute(q_shift)
            shift_obj = res_shift.scalars().first()
            if not shift_obj:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-POS-001: Shift '{shift_id}' not found for company '{company_id}'.",
                )
            if shift_obj.status != "OPEN":
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-POS-002: The shift is not open (status: {shift_obj.status}). Please open a shift before processing sales.",
                )

        # Resolve canonical warehouse via InventoryWarehouseResolver
        from .inventory_warehouse_resolver import InventoryWarehouseResolver
        wh = None  # initialise so the variable is always in scope even if resolution fails
        try:
            resolver = InventoryWarehouseResolver(session)
            wh = await resolver.resolve(
                company_id=company_id,
                branch_id=branch_id,
                register_id=shift_obj.register_id if shift_obj else None,
                warehouse_id=warehouse_id,
            )
            if wh:
                warehouse_id = wh.id
        except Exception as e:
            logger.warning("Warehouse resolution fallback: %s", e)

        # 2. Idempotency Check & Replay Protection (STIE Integration)
        from .transaction_integrity_engine import TransactionIntegrityEngine, compute_payload_hash
        from ..models.transaction_integrity import TransactionIdempotencyRecord

        req_hash = compute_payload_hash(req)
        lock_key = idempotency_key or req.context.client_invoice_no
        if lock_key:
            acquired = await TransactionIntegrityEngine.try_acquire_advisory_lock(
                session=session,
                company_id=company_id,
                entity_type="SALES_INVOICE",
                lock_identifier=lock_key,
            )
            if not acquired:
                raise HTTPException(
                    status_code=409,
                    detail=f"SMRITI-CONC-001: Concurrent execution locked for SALES_INVOICE '{lock_key}'. Another transaction is actively in progress.",
                )

        idemp_record: Optional[TransactionIdempotencyRecord] = None
        if idempotency_key:
            stmt_rec = select(TransactionIdempotencyRecord).where(
                TransactionIdempotencyRecord.company_id == company_id,
                TransactionIdempotencyRecord.entity_type == "SALES_INVOICE",
                TransactionIdempotencyRecord.idempotency_key == idempotency_key,
            )
            existing_rec = (await session.execute(stmt_rec)).scalars().first()
            if existing_rec:
                if existing_rec.status == "COMMITTED":
                    if existing_rec.request_hash == req_hash:
                        logger.info("STIE Idempotent Replay for invoice %s (key %s)", existing_rec.document_no or existing_rec.document_id, idempotency_key)
                        q_rep = select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(
                            SalesInvoice.id == existing_rec.document_id,
                            SalesInvoice.company_id == company_id,
                            SalesInvoice.is_deleted == False,
                        )
                        replayed_inv = (await session.execute(q_rep)).scalars().first()
                        if replayed_inv:
                            return cls._build_replayed_result(replayed_inv)
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail=f"SMRITI-IDEMP-001: Idempotency key collision. Key '{idempotency_key}' was previously committed with a different request fingerprint.",
                        )
                elif existing_rec.status == "IN_FLIGHT":
                    raise HTTPException(
                        status_code=409,
                        detail=f"SMRITI-IDEMP-002: Concurrent transaction in progress for idempotency key '{idempotency_key}'. Please wait or retry.",
                    )
                elif existing_rec.status == "FAILED":
                    logger.info("STIE Clean retry on previously failed idempotency key '%s'", idempotency_key)
                    existing_rec.status = "IN_FLIGHT"
                    existing_rec.request_hash = req_hash
                    existing_rec.error_detail = None
                    existing_rec.completed_at = None
                    existing_rec.created_at = datetime.now(timezone.utc)
                    idemp_record = existing_rec

            if not idemp_record:
                # Insert in-flight record
                record_id = f"tx_idemp_{uuid.uuid4().hex[:16]}"
                idemp_record = TransactionIdempotencyRecord(
                    id=record_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    entity_type="SALES_INVOICE",
                    idempotency_key=idempotency_key,
                    request_hash=req_hash,
                    status="IN_FLIGHT",
                    created_by=req.context.cashier_id or "SYSTEM",
                )
                session.add(idemp_record)
                try:
                    await session.flush()
                except IntegrityError as exc:
                    await session.rollback()
                    raise HTTPException(
                        status_code=409,
                        detail=f"SMRITI-CONC-002: Concurrent transaction collision on idempotency key '{idempotency_key}'.",
                    )

        # Check rule_snapshots JSONB for idempotency_key or direct invoice_no
        q_idem = select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.is_deleted == False,
            (
                (SalesInvoice.invoice_no == (req.context.client_invoice_no or idempotency_key))
                | (text("rule_snapshots->>'idempotency_key' = :ikey").params(ikey=idempotency_key))
            ),
        )
        res_idem = await session.execute(q_idem)
        existing_inv = res_idem.scalars().first()
        if existing_inv:
            stored_hash = (existing_inv.rule_snapshots or {}).get("request_hash")
            if stored_hash and stored_hash != req_hash:
                raise HTTPException(
                    status_code=409,
                    detail=f"SMRITI-IDEMP-001: Idempotency key collision. Key '{idempotency_key}' was previously committed with a different request fingerprint.",
                )
            logger.info("Idempotent replay detected for invoice %s (key %s)", existing_inv.invoice_no, idempotency_key)
            return cls._build_replayed_result(existing_inv)

        # 3. Customer & Credit Validation
        branch_candidates = {branch_id, "MAIN", "BR-MAIN-001", "BR-001"} if branch_id in ("MAIN", "BR-MAIN-001", "BR-001") else {branch_id}
        db_customer: Optional[Customer] = None
        credit_tender_amount = Decimal("0.00")
        for t in req.tenders:
            if t.tender_type.upper() == "CREDIT":
                credit_tender_amount += Decimal(str(t.amount))

        if req.customer_id:
            q_cust = select(Customer).where(
                Customer.id == req.customer_id,
                Customer.company_id == company_id,
                (Customer.branch_id.in_(branch_candidates)) | Customer.branch_id.is_(None),
                Customer.is_deleted == False,
            ).options(
                selectinload(Customer.group),
                selectinload(Customer.policy),
                selectinload(Customer.company_relationships).selectinload(CustomerCompanyRelationship.customer_group),
            ).with_for_update()
            res_cust = await session.execute(q_cust)
            db_customer = res_cust.scalars().first()
            if not db_customer:
                raise HTTPException(
                    status_code=404,
                    detail=f"SMRITI-CRM-001: Customer '{req.customer_id}' not found for company '{company_id}'.",
                )

        customer_relation = next(
            (
                relation for relation in (db_customer.company_relationships if db_customer else [])
                if relation.company_id == company_id and relation.status == "Active" and not relation.is_deleted
            ),
            None,
        )
        customer_group = (
            customer_relation.customer_group
            if customer_relation and customer_relation.customer_group
            else (db_customer.group if db_customer else None)
        )
        customer_policy = db_customer.policy if db_customer else None
        payment_options = BillingProfileService.resolve_customer_payment_options(
            configuration=billing_configuration,
            customer=db_customer,
            group=customer_group,
            relationship=customer_relation,
            can_override_credit=bool(
                authorized_credit_override
                and customer_group
                and customer_group.allow_override
            ),
        )
        if not required_transactions.issubset(set(payment_options["allowed_transactions"])):
            raise HTTPException(
                status_code=403,
                detail=payment_options["configuration_warning"]
                or "The requested cash or credit mode is not permitted for this customer and branch.",
            )
        configured_default = payment_options["default_transaction"]
        transaction_mode_changed = transaction_type != configured_default
        if configured_default and transaction_type != configured_default and not authorized_transaction_mode_change:
            raise HTTPException(
                status_code=403,
                detail="Changing the customer's configured billing mode requires explicit transaction-mode permission.",
            )
        if not configured_default and not authorized_transaction_mode_change:
            raise HTTPException(
                status_code=409,
                detail=payment_options["configuration_warning"]
                or "No valid customer billing mode is configured; an authorized user must select one.",
            )
        configured_po_requirement = (
            customer_policy.require_po_number
            if customer_policy and customer_policy.require_po_number is not None
            else bool(customer_group and customer_group.require_po_number)
        )
        require_po_number = (
            billing_configuration.get("customer_po_reference") == "REQUIRED"
            or bool(configured_po_requirement)
        )
        if require_po_number and not (req.po_reference_no or req.customer_po_id):
            raise HTTPException(
                status_code=422,
                detail="A customer purchase-order reference is required by the active billing policy.",
            )

        customer_discount_policy = await resolve_customer_discount_policy(
            session,
            req.customer_id,
            company_id,
            branch_id,
        )

        promotion_result = None
        if req.promotion_campaign_id or req.promotion_coupon_code or req.promotion_coupon_id:
            promotion_result = await PromotionsEngine.evaluate_promotions(
                session=session,
                company_id=company_id,
                req=PromotionEvaluationRequest(
                    items=[PromotionCartItem(
                        item_id=item.item_id or item.product_id or item.code,
                        variant_id=item.variant_id,
                        product_name=item.name,
                        category=item.category,
                        brand=item.brand,
                        unit_price=float(item.unit_price),
                        quantity=float(item.quantity),
                    ) for item in req.items],
                    campaign_id=req.promotion_campaign_id,
                    coupon_code=req.promotion_coupon_code,
                    coupon_id=req.promotion_coupon_id,
                    customer_id=req.customer_id,
                    customer_group_id=getattr(db_customer, "customer_group_id", None),
                    branch_id=branch_id,
                    store_id=branch_id,
                    channel=req.context.source_channel,
                ),
            )
            if not promotion_result.applied_promotions:
                raise HTTPException(status_code=400, detail="Requested promotion is not eligible for this transaction.")

        # 3.5 B2B Customer Registrations & Delivery Locations Validation
        resolved_customer_id = db_customer.id if db_customer else req.customer_id

        billing_loc_record = None
        snapshot_billing_store_code = getattr(req, "billing_store_code", None)
        snapshot_billing_address = req.billing_address
        if getattr(req, "billing_location_id", None):
            b_stmt = select(CustomerBillingLocation).filter(
                CustomerBillingLocation.id == req.billing_location_id,
                CustomerBillingLocation.is_deleted == False,
            )
            billing_loc_record = (await session.execute(b_stmt)).scalars().first()
            if not billing_loc_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Billing location '{req.billing_location_id}' not found."
                )
            if billing_loc_record.company_id != company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company billing location access is prohibited."
                )
            if billing_loc_record.branch_id and billing_loc_record.branch_id not in branch_candidates:
                raise HTTPException(status_code=403, detail="Cross-branch billing location access is prohibited.")
            if billing_loc_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Billing location does not belong to the selected customer."
                )
            if billing_loc_record.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected billing location is inactive."
                )
            if not snapshot_billing_store_code:
                snapshot_billing_store_code = billing_loc_record.billing_store_code
            if not snapshot_billing_address:
                parts = [billing_loc_record.address_line1, billing_loc_record.address_line2, billing_loc_record.city, f"{billing_loc_record.state} - {billing_loc_record.pincode}"]
                snapshot_billing_address = ", ".join(p for p in parts if p)

        billed_reg_record = None
        if getattr(req, "billed_party_gstin_id", None):
            reg_stmt = select(CustomerGSTRegistration).filter(
                CustomerGSTRegistration.id == req.billed_party_gstin_id,
                CustomerGSTRegistration.is_deleted == False,
            )
            billed_reg_record = (await session.execute(reg_stmt)).scalars().first()
            if not billed_reg_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Billed GST registration '{req.billed_party_gstin_id}' not found."
                )
            if billed_reg_record.company_id != company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company GST registration access is prohibited."
                )
            if billed_reg_record.branch_id and billed_reg_record.branch_id not in branch_candidates:
                raise HTTPException(status_code=403, detail="Cross-branch GST registration access is prohibited.")
            if billed_reg_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Billed GST registration does not belong to the selected customer."
                )
            if not billed_reg_record.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Selected Billed GST registration is inactive."
                )
            req.customer_gstin = billed_reg_record.gstin

        delivery_loc_record = None
        delivery_store_code = getattr(req, "delivery_store_code", None)
        delivery_gstin = getattr(req, "delivery_gstin", None)
        delivery_location_snapshot = getattr(req, "delivery_location_snapshot", None)

        if getattr(req, "delivery_location_id", None):
            loc_stmt = select(CustomerDeliveryLocation).filter(
                CustomerDeliveryLocation.id == req.delivery_location_id,
                CustomerDeliveryLocation.is_deleted == False,
            )
            delivery_loc_record = (await session.execute(loc_stmt)).scalars().first()
            if not delivery_loc_record:
                raise HTTPException(
                    status_code=404,
                    detail=f"Delivery location '{req.delivery_location_id}' not found."
                )
            if delivery_loc_record.company_id != company_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cross-company delivery location access is prohibited."
                )
            if delivery_loc_record.branch_id and delivery_loc_record.branch_id not in branch_candidates:
                raise HTTPException(status_code=403, detail="Cross-branch delivery location access is prohibited.")
            if delivery_loc_record.customer_id != resolved_customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Delivery location does not belong to the selected customer."
                )
            if not delivery_loc_record.is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Selected delivery location is inactive."
                )

            if delivery_loc_record.gst_registration_id:
                linked_reg_stmt = select(CustomerGSTRegistration).filter(
                    CustomerGSTRegistration.id == delivery_loc_record.gst_registration_id,
                    CustomerGSTRegistration.is_deleted == False,
                )
                linked_reg = (await session.execute(linked_reg_stmt)).scalars().first()
                if linked_reg:
                    if linked_reg.company_id != company_id:
                        raise HTTPException(
                            status_code=403,
                            detail="Delivery location linked GST registration belongs to a different company."
                        )
                    if linked_reg.branch_id and linked_reg.branch_id not in branch_candidates:
                        raise HTTPException(status_code=403, detail="Delivery location linked GST registration belongs to a different branch.")
                    if linked_reg.customer_id != resolved_customer_id:
                        raise HTTPException(
                            status_code=400,
                            detail="Delivery location linked GST registration does not belong to the selected customer."
                        )

            eff_del_gstin = req.delivery_gstin or delivery_loc_record.gstin
            if eff_del_gstin:
                val_ok, del_st_code, _ = validate_gstin(eff_del_gstin)
                if not val_ok:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN '{eff_del_gstin}' is invalid."
                    )
                if del_st_code != delivery_loc_record.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN state '{del_st_code}' does not match delivery location state '{delivery_loc_record.state_code}'."
                    )

            delivery_store_code = delivery_loc_record.store_code
            delivery_gstin = req.delivery_gstin or delivery_loc_record.gstin
            if not delivery_location_snapshot:
                delivery_location_snapshot = {
                    "id": delivery_loc_record.id,
                    "store_code": delivery_loc_record.store_code,
                    "location_name": delivery_loc_record.location_name,
                    "address_line1": delivery_loc_record.address_line1,
                    "address_line2": delivery_loc_record.address_line2,
                    "city": delivery_loc_record.city,
                    "state_code": delivery_loc_record.state_code,
                    "state_name": delivery_loc_record.state,
                    "pincode": delivery_loc_record.pincode,
                    "delivery_gstin": delivery_gstin,
                    "contact_person": delivery_loc_record.contact_person,
                    "phone": delivery_loc_record.phone,
                    "metadata_json": delivery_loc_record.metadata_json,
                }

        # 3.6 Enforce Modern Trade Store Location Requirement
        effective_channel = (
            getattr(req, "sales_channel", None)
            or getattr(req.context, "sales_channel", None)
            or req.context.source_channel
            or "B2B_WHOLESALE"
        )
        if channel_requires_store_location(effective_channel):
            if not getattr(req, "delivery_location_id", None) or not delivery_store_code:
                raise HTTPException(
                    status_code=400,
                    detail="Modern Trade billing requires both delivery location and store code. (SMRITI-VAL-004: Delivery Location / Store Code is mandatory when billing under Modern Trade or store-tracked sales channel.)",
                )

        # 3.7 Customer PO Ingress Validation & Row Locking
        po_obj = None
        po_lines_map = {}
        po_policy = "BLOCK"
        if getattr(req, "customer_po_id", None):
            q_po = select(CustomerPurchaseOrder).where(
                CustomerPurchaseOrder.id == req.customer_po_id,
                CustomerPurchaseOrder.company_id == company_id,
                CustomerPurchaseOrder.is_deleted == False,
            ).with_for_update()
            res_po = await session.execute(q_po)
            po_obj = res_po.scalars().first()
            if not po_obj:
                raise HTTPException(status_code=404, detail="Customer PO not found.")
            if po_obj.status in {"CANCELLED", "CLOSED", "FULLY_BILLED"}:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Customer PO '{po_obj.po_number}' is {po_obj.status} and cannot accept further billing. "
                        f"All authorized quantity has been consumed. To bill additional units, "
                        f"create a new PO or request re-opening of this one. (SMRITI-CPO-003)"
                    ),
                )
            if resolved_customer_id and resolved_customer_id not in (None, po_obj.customer_id, "CUST-WALKIN"):
                raise HTTPException(
                    status_code=400,
                    detail="Invoice customer does not match the Customer PO customer.",
                )

            q_lines = select(CustomerPurchaseOrderLine).where(
                CustomerPurchaseOrderLine.customer_po_id == po_obj.id,
                CustomerPurchaseOrderLine.company_id == company_id,
                CustomerPurchaseOrderLine.is_deleted == False,
            ).with_for_update()
            res_lines = await session.execute(q_lines)
            po_lines_map = {l.id: l for l in res_lines.scalars().all()}

            from .customer_po import CustomerPOService
            cpo_svc = CustomerPOService(session, TenantContext(company_id=company_id, branch_id=branch_id))
            po_policy, _ = await cpo_svc._policy()
            if po_obj.billing_policy_snapshot and isinstance(po_obj.billing_policy_snapshot, dict):
                po_policy = str(po_obj.billing_policy_snapshot.get("overbilling_policy", po_policy)).upper()

            for item in req.items:
                if getattr(item, "customer_po_line_id", None):
                    po_line = po_lines_map.get(item.customer_po_line_id)
                    if not po_line or po_line.customer_po_id != po_obj.id:
                        raise HTTPException(
                            status_code=400,
                            detail="PO line does not belong to the selected Customer PO.",
                        )
                    if Decimal(str(item.quantity)) <= Decimal("0.00"):
                        raise HTTPException(
                            status_code=400,
                            detail="Billing quantity must be greater than zero.",
                        )
                    if Decimal(str(item.quantity)) > po_line.quantity_remaining:
                        override_code = req.context.supervisor_override_code or getattr(req, "supervisor_override_code", None)
                        if po_policy == "BLOCK":
                            raise HTTPException(
                                status_code=409,
                                detail=f"Overbilling blocked: Item {po_line.code} ordered {po_line.quantity_ordered} remaining {po_line.quantity_remaining}.",
                            )
                        elif po_policy == "ALLOW_WITH_AUTHORIZATION" and not override_code:
                            raise HTTPException(
                                status_code=409,
                                detail=f"Supervisor override required for overbilling PO line {po_line.line_number}: ordered {po_line.quantity_ordered} remaining {po_line.quantity_remaining}.",
                            )

        # 4. Resolve Interstate / Tax Jurisdiction
        branch_state_code = gst_sc
        if not branch_state_code and branch_obj and getattr(branch_obj, "state_code", None):
            branch_state_code = str(branch_obj.state_code).zfill(2)
        if not branch_state_code and comp_obj and getattr(comp_obj, "state_code", None):
            branch_state_code = str(comp_obj.state_code).zfill(2)
        if not branch_state_code:
            state_param = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.TAX.DEFAULT_STATE_CODE",
                company_id=company_id,
                branch_id=branch_id,
            )
            branch_state_code = str(state_param.effective_value).zfill(2) if state_param and state_param.effective_value else None

        if not branch_state_code and wh and getattr(wh, "state", None):
            wh_st_norm = str(wh.state).strip().upper()
            for code, name in GST_STATE_CODES.items():
                if name == wh_st_norm or wh_st_norm in name:
                    branch_state_code = code
                    break

        if not branch_state_code and req.place_of_supply:
            pos_digits = "".join(ch for ch in str(req.place_of_supply) if ch.isdigit())
            if len(pos_digits) >= 2 and pos_digits[:2] in GST_STATE_CODES:
                branch_state_code = pos_digits[:2]

        if not branch_state_code:
            # Unregistered sellers (no GSTIN) issuing a Bill of Supply / Retail Receipt with 0% GST
            # are not required to determine tax jurisdiction — no interstate computation applies.
            is_unregistered_zero_tax = not seller_gstin and not has_positive_tax
            if not is_unregistered_zero_tax:
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-JURISDICTION-001: Seller tax jurisdiction cannot be resolved. Branch/Company GSTIN, state code, or SMRITI.TAX.DEFAULT_STATE_CODE must be configured.",
                )

        pos_state_code = None
        pos_state_name = None
        if delivery_loc_record:
            pos_state_code = delivery_loc_record.state_code
            pos_state_name = delivery_loc_record.state or GST_STATE_CODES.get(pos_state_code, "Delivery State")
        elif req.place_of_supply:
            pos_state_code = req.place_of_supply[:2]
            pos_state_name = GST_STATE_CODES.get(pos_state_code, "Transaction POS")
        elif billed_reg_record:
            pos_state_code = billed_reg_record.state_code
            pos_state_name = billed_reg_record.state_name or GST_STATE_CODES.get(pos_state_code, "Billed State")
        elif req.customer_gstin:
            extracted_sc = extract_state_code_from_gstin(req.customer_gstin)
            if extracted_sc:
                pos_state_code = extracted_sc
                pos_state_name = GST_STATE_CODES.get(pos_state_code, "Customer State")

        if not pos_state_code:
            pos_state_code = branch_state_code
            pos_state_name = GST_STATE_CODES.get(branch_state_code, "Home State")

        customer_state_code = pos_state_code
        is_interstate = (pos_state_code != branch_state_code)

        # 5. Dual-Key Item Resolution & Statutory Tax Calculation via HeadlessBillingCore
        from .headless_billing import HeadlessBillingCore
        calc_result = await HeadlessBillingCore.calculate_billing(
            session=session,
            req=req,
            db_customer=db_customer,
            customer_discount_policy=customer_discount_policy,
            is_interstate=is_interstate,
            promotion_result=promotion_result,
            authorized_price_override=authorized_price_override,
            authorized_discount_override=authorized_discount_override,
            authorized_adjustment_override=authorized_adjustment_override,
        )

        total_gross = calc_result.gross_amount
        total_discount = calc_result.discount_amount
        total_taxable = calc_result.taxable_amount
        total_cgst = calc_result.cgst_amount
        total_sgst = calc_result.sgst_amount
        total_igst = calc_result.igst_amount
        total_tax = calc_result.tax_total
        raw_net = calc_result.subtotal
        net_rounded = calc_result.net_amount
        round_off = calc_result.round_off
        calculated_lines = calc_result.lines
        batch_deductions = calc_result.batch_deductions

        credit_override_applied = False
        if "CREDIT" in required_transactions:
            credit_exposure = (
                credit_tender_amount
                if credit_tender_amount > Decimal("0.00")
                else net_rounded
            )
            final_payment_options = BillingProfileService.resolve_customer_payment_options(
                configuration=billing_configuration,
                customer=db_customer,
                group=customer_group,
                relationship=customer_relation,
                can_override_credit=bool(
                    authorized_credit_override
                    and customer_group
                    and customer_group.allow_override
                ),
                credit_exposure=credit_exposure,
            )
            if "CREDIT" not in final_payment_options["allowed_transactions"]:
                if final_payment_options["credit_override_required"]:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"SMRITI-CREDIT-003: Credit exposure of ₹{credit_exposure:,.2f} exceeds "
                            f"available credit of ₹{final_payment_options['available_credit'] or 0:,.2f}."
                        ),
                    )
                raise HTTPException(
                    status_code=403,
                    detail=final_payment_options["configuration_warning"]
                    or "Credit billing is not permitted for this customer and branch.",
                )
            if final_payment_options["credit_override_required"]:
                if not (req.credit_override_reason or "").strip():
                    raise HTTPException(
                        status_code=422,
                        detail="A business justification is required for a credit-limit override.",
                    )
                credit_override_applied = True
                logger.warning("Authorized credit limit override for customer %s", db_customer.id)

        # 7. Invoice Numbering Allocation
        # Policy: the client MUST NOT supply a pre-constructed invoice_no as an
        # authoritative allocation.  client_invoice_no is reserved ONLY for
        # true offline/POS transactions where a number was already printed and
        # committed at the terminal (e.g. thermal receipt already issued).
        # For all online B2B / credit invoices the backend allocates atomically.
        invoice_no = req.context.client_invoice_no
        if not invoice_no:
            try:
                num_svc = NumberingService(session)
                # Determine canonical document type from payment mode
                _pay_mode = (req.payment_mode or "").strip().upper()
                _has_credit = _pay_mode in {"CREDIT", "ON_ACCOUNT"} or any(
                    t.tender_type.strip().upper() == "CREDIT" for t in req.tenders
                )
                _tx_type = "SALES_CREDIT" if _has_credit else "SALES_CASH"
                # Resolve the live series from Document Series & Numbering Studio
                _resolved = await num_svc.resolve_bill_prefix(
                    company_id=company_id,
                    branch_id=branch_id,
                    terminal_id=req.context.terminal_id or "COMMON",
                    transaction_type=_tx_type,
                )
                _series_id = _resolved.get("seriesId")
                if _series_id and not _series_id.startswith("SER-AUTO-"):
                    # Atomically allocate next number under FOR UPDATE lock
                    invoice_no = await num_svc.allocate_voucher_number(
                        series_id=_series_id,
                        branch=branch_id or "MAIN",
                        fy=_resolved.get("financialYear") or f"{date.today().year}-{date.today().year + 1}",
                        username=req.context.cashier_id or "SYSTEM",
                    )
                else:
                    # Auto-instantiated fallback series: use the preview number but
                    # advance the counter on the auto series too.
                    _auto_id = _series_id or ""
                    if _auto_id:
                        invoice_no = await num_svc.allocate_voucher_number(
                            series_id=_auto_id,
                            branch=branch_id or "MAIN",
                            fy=_resolved.get("financialYear") or f"{date.today().year}-{date.today().year + 1}",
                            username=req.context.cashier_id or "SYSTEM",
                        )
                    else:
                        # Last-resort deterministic UUID fallback (no series at all)
                        invoice_no = f"INV-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            except HTTPException:
                raise
            except Exception as _num_err:
                logger.warning(
                    "Numbering service allocation failed for %s; using UUID fallback: %s",
                    company_id, _num_err,
                )
                # Deterministic fallback: INV-<YYYYMMDD>-<UUID4_SHORT>
                invoice_no = f"INV-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # 8. Resolve and validate Dispatch From physical origin location
        raw_dispatch_id = req.dispatch_from_location_id or req.context.dispatch_from_location_id or warehouse_id
        dispatch_from_snapshot: Optional[Dict[str, Any]] = None
        dispatch_from_location_id: Optional[str] = None

        if batch_deductions and not raw_dispatch_id:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-LOC-006: Dispatch From location is required for physical goods fulfillment.",
            )

        if raw_dispatch_id:
            # First check if warehouse exists within tenant company
            q_disp = select(Warehouse).where(
                (Warehouse.id == raw_dispatch_id) | (Warehouse.code == raw_dispatch_id),
                Warehouse.company_id == company_id,
            )
            res_disp = await session.execute(q_disp)
            disp_wh = res_disp.scalars().first()

            if not disp_wh:
                # Cross-tenant check: if warehouse belongs to another company
                q_cross = select(Warehouse).where(
                    (Warehouse.id == raw_dispatch_id) | (Warehouse.code == raw_dispatch_id)
                )
                res_cross = await session.execute(q_cross)
                cross_wh = res_cross.scalars().first()
                if cross_wh and cross_wh.company_id != company_id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"SMRITI-LOC-001: Cross-tenant dispatch location reference forbidden. Warehouse '{raw_dispatch_id}' belongs to another company.",
                    )
                if req.dispatch_from_location_id or req.context.dispatch_from_location_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-002: Dispatch location '{raw_dispatch_id}' not found for company '{company_id}'.",
                    )

            if disp_wh:
                if disp_wh.is_deleted or not disp_wh.is_active:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-003: Dispatch location '{disp_wh.name}' ({disp_wh.code}) is inactive or decommissioned.",
                    )

                disp_pin = str(disp_wh.pincode or "").strip()
                if not disp_pin or not disp_pin.isdigit() or len(disp_pin) != 6:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-004: Dispatch location '{disp_wh.code}' has missing or invalid 6-digit Indian PIN code '{disp_wh.pincode}'.",
                    )
                if not disp_wh.state:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-005: Dispatch location '{disp_wh.code}' is missing state information.",
                    )

                from ..models.localization import StateRef
                st_res = await session.execute(
                    select(StateRef).where(
                        StateRef.country_code == "IN",
                        (func.lower(StateRef.name) == disp_wh.state.strip().lower())
                        | (func.upper(StateRef.state_code) == disp_wh.state.strip().upper()),
                        StateRef.is_active == True,
                    )
                )
                st_ref = st_res.scalars().first()
                disp_state_code = st_ref.gst_state_code if st_ref and st_ref.gst_state_code else None
                if not disp_state_code:
                    if comp_obj and comp_obj.gst_number and len(comp_obj.gst_number) >= 2 and comp_obj.gst_number[:2].isdigit():
                        disp_state_code = comp_obj.gst_number[:2]
                    elif branch_state_code:
                        disp_state_code = branch_state_code
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"SMRITI-JURISDICTION-001: Dispatch location '{disp_wh.code}' state jurisdiction cannot be resolved.",
                        )

                seller_legal_name = (
                    getattr(comp_obj, "name", None)
                    or getattr(branch_obj, "name", None)
                    or disp_wh.name
                    or "Company Dispatch Location"
                )
                seller_gstin = (
                    getattr(comp_obj, "gst_number", None)
                    or getattr(branch_obj, "gst_number", None)
                    or ""
                )

                dispatch_from_location_id = disp_wh.id
                dispatch_from_snapshot = {
                    "location_id": disp_wh.id,
                    "code": disp_wh.code,
                    "name": seller_legal_name,
                    "location_name": disp_wh.name,
                    "address_line1": disp_wh.address or "",
                    "address_line2": "",
                    "city": disp_wh.city or "",
                    "district": disp_wh.city or "",
                    "state": disp_wh.state or (getattr(comp_obj, "state", None) or ""),
                    "state_code": disp_state_code,
                    "pincode": disp_pin,
                    "gstin": seller_gstin,
                    "contact_person": disp_wh.contact_person,
                    "phone": disp_wh.phone,
                }

        # 9. Persist SalesInvoice
        tech_id, identity_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="SALES_INVOICE",
            tenant_id=company_id,
            company_id=company_id,
            branch_id=branch_obj.id if branch_obj else branch_id,
            purpose="ENTITY_CREATION",
        )
        invoice_id = tech_id
        db_invoice = SalesInvoice(
            id=invoice_id,
            identity_code=identity_code,
            company_id=company_id,
            branch_id=branch_obj.id if branch_obj else branch_id,
            invoice_no=invoice_no,
            date=getattr(req, "invoice_date", None) or date.today(),
            customer_id=db_customer.id if db_customer else req.customer_id,
            customer_name=req.customer_name or (db_customer.name if db_customer else "Walk-in Customer"),
            customer_gstin=req.customer_gstin or (getattr(db_customer, "gst_number", None) or getattr(db_customer, "gstin", None) if db_customer else None),
            billed_party_gstin_id=getattr(req, "billed_party_gstin_id", None),
            billing_address=snapshot_billing_address or (getattr(db_customer, "address", None) if db_customer else None),
            shipping_address=req.shipping_address or snapshot_billing_address,
            billing_location_id=req.billing_location_id,
            billing_store_code=snapshot_billing_store_code,
            delivery_location_id=req.delivery_location_id,
            delivery_store_code=delivery_store_code,
            sis_code=delivery_store_code,
            delivery_gstin=delivery_gstin,
            delivery_location_snapshot=delivery_location_snapshot,
            warehouse_id=warehouse_id,
            dispatch_from_location_id=dispatch_from_location_id,
            dispatch_from_snapshot=dispatch_from_snapshot,
            shift_id=shift_id,
            terminal_id=req.context.terminal_id,
            counter_id=req.context.counter_id,
            salesperson_id=req.context.cashier_id,
            taxable_value=total_taxable,
            tax_total=total_tax,
            grand_total=net_rounded,
            net_amount=net_rounded,
            discount_amount=total_discount,
            rounding_amount=round_off,
            is_interstate=is_interstate,
            reverse_charge=req.reverse_charge,
            place_of_supply_code=pos_state_code,
            pos_state=pos_state_name,
            payment_mode=(req.payment_mode or ("SPLIT" if len(req.tenders) > 1 else (req.tenders[0].tender_type if req.tenders else "CREDIT"))).upper(),
            status="Draft" if req.is_draft else "Submitted",
            po_reference=req.po_reference_no or (po_obj.po_number if po_obj else None),
            customer_po_id=req.customer_po_id,
            customer_po_number_snapshot=po_obj.po_number if po_obj else getattr(req, "customer_po_number_snapshot", None),
            customer_po_date_snapshot=po_obj.po_date if po_obj else getattr(req, "customer_po_date_snapshot", None),
            sales_channel=(
                getattr(req, "sales_channel", None)
                or getattr(req.context, "sales_channel", None)
                or (req.context.source_channel if req.context.source_channel in ["MODERN_TRADE", "GENERAL_TRADE", "B2B_WHOLESALE", "POS_RETAIL", "ECOMMERCE"] else None)
                or "B2B_WHOLESALE"
            ),
            source_document_type=source_type,
            source_document_id=req.source_document_id or req.customer_po_id or req.so_reference_no,
            rule_snapshots={
                "document_type": ("TAX_INVOICE" if seller_gstin else "RETAIL_RECEIPT"),
                "idempotency_key": idempotency_key,
                "request_hash": req_hash,
                "source_channel": req.context.source_channel,
                "sales_channel": (
                    sales_channel
                ),
                "billing_policy": {
                    "bill_type": bill_type,
                    "transaction_type": transaction_type,
                    "allowed_transactions": payment_options["allowed_transactions"],
                    "default_transaction": configured_default,
                    "transaction_mode_changed": transaction_mode_changed,
                    "sales_channel": sales_channel,
                    "source_document_type": source_type,
                    "require_po_number": require_po_number,
                    "configuration": billing_configuration,
                    "credit_override_applied": credit_override_applied,
                    "credit_override_reason": req.credit_override_reason if credit_override_applied else None,
                    "credit_override_actor": credit_override_actor if credit_override_applied else None,
                },
                "supervisor_override_requested": bool(req.context.supervisor_override_code),
                "overrides": {
                    "authorized_credit_override": authorized_credit_override,
                    "authorized_transaction_mode_change": authorized_transaction_mode_change,
                    "authorized_price_override": authorized_price_override,
                    "authorized_discount_override": authorized_discount_override,
                    "authorized_adjustment_override": authorized_adjustment_override,
                },
                "adjustments": calc_result.adjustments,
                "total_addons": float(calc_result.total_addons),
                "total_deductions": float(calc_result.total_deductions),
                "calculated_at": datetime.now(timezone.utc).isoformat(),
                "promotion_evaluation": promotion_result.model_dump(mode="json") if promotion_result else None,
                # Rec 10 — price level audit trail for Z-report breakdown
                "_resolved_price_level_effective": (
                    price_level_ctx["effective_price_level"] if "price_level_ctx" in dir() else None
                ),
                "_resolved_price_level_source": (
                    price_level_ctx["source"] if "price_level_ctx" in dir() else None
                ),
            },
        )
        session.add(db_invoice)

        # 9. Persist SalesInvoiceItem records
        db_items_list = []
        for l in calculated_lines:
            db_item = SalesInvoiceItem(
                invoice_id=db_invoice.id,
                company_id=company_id,
                branch_id=branch_id,
                product_id=l.product_id,
                item_id=l.item_id,
                variant_id=l.variant_id,
                code=l.code,
                name=l.name,
                quantity=l.quantity,
                price=l.unit_price,
                mrp=l.mrp,
                disc_pct=l.disc_pct,
                taxable_value=l.taxable_value,
                hsn_code=l.hsn_code,
                gst_rate=l.gst_rate,
                cgst_amount=l.cgst_amount,
                sgst_amount=l.sgst_amount,
                igst_amount=l.igst_amount,
                tax_amount=l.tax_amount,
                total_amount=l.total_amount,
                batch_no=l.batch_no,
                line_no=l.line_no,
                customer_po_line_id=l.customer_po_line_id,
                source_line_type=l.source_line_type,
                source_line_id=l.source_line_id,
                is_tax_inclusive=l.is_tax_inclusive,
                salesperson_id=l.salesperson_id,
                salesperson_name=l.salesperson_name,
                batch_id=l.batch_id,
                serial_id=l.serial_id,
                warehouse_location_id=l.warehouse_location_id,
            )
            session.add(db_item)
            db_items_list.append(db_item)

        try:
            await session.flush()
        except IntegrityError as _flush_err:
            await session.rollback()
            _orig = str(getattr(_flush_err, "orig", _flush_err))
            if "uq_sales_invoices_company_invoice_no" in _orig or "invoice_no" in _orig.lower():
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "SMRITI-INV-DUP-001",
                        "invoice_no": invoice_no,
                        "message": (
                            f"Invoice number '{invoice_no}' is already assigned to another invoice. "
                            "Your invoice has not been saved. "
                            "Please select 'Fix and Select Next Number' to obtain a valid number from "
                            "the Document Series & Numbering Studio, or keep as Draft."
                        ),
                    },
                )
            raise HTTPException(
                status_code=409,
                detail=f"Invoice could not be saved because of a data conflict. {_orig}",
            )

        # 9B. Update Customer PO Balances & Create Allocations Atomically

        if po_obj and po_lines_map and not req.is_draft:
            total_po_allocated_qty = Decimal("0")
            total_po_allocated_val = Decimal("0")
            for db_item in db_items_list:
                if getattr(db_item, "customer_po_line_id", None) and db_item.customer_po_line_id in po_lines_map:
                    po_line = po_lines_map[db_item.customer_po_line_id]
                    item_qty = Decimal(str(db_item.quantity))
                    item_val = Decimal(str(db_item.total_amount or "0.00"))

                    # Cap stored quantity_billed at the DB check constraint ceiling
                    # (ck_customer_po_line_billed_qty_bounded: quantity_billed <= ordered + cancelled).
                    # Under ALLOW_WITH_AUTHORIZATION the excess is captured in allocation_metadata
                    # for audit; the CPO line itself stores no more than the ceiling.
                    line_qty_ceiling = po_line.quantity_ordered + po_line.quantity_cancelled
                    new_line_billed = min(po_line.quantity_billed + item_qty, line_qty_ceiling)
                    line_overrun_qty = max(Decimal("0"), (po_line.quantity_billed + item_qty) - line_qty_ceiling)
                    po_line.quantity_billed = new_line_billed
                    po_line.quantity_remaining = max(Decimal("0"), line_qty_ceiling - po_line.quantity_billed)
                    po_line.billed_value += item_val
                    po_line.remaining_value = max(Decimal("0"), po_line.ordered_value - po_line.billed_value)
                    po_line.line_status = "FULLY_BILLED" if po_line.quantity_remaining <= Decimal("0") else "PARTIALLY_BILLED"
                    session.add(po_line)

                    session.add(CustomerPOInvoiceAllocation(
                        id=f"cpoa-{uuid.uuid4().hex[:16]}",
                        company_id=company_id,
                        branch_id=branch_id,
                        created_by=req.context.cashier_id,
                        customer_po_id=po_obj.id,
                        customer_po_line_id=po_line.id,
                        invoice_id=db_invoice.id,
                        invoice_item_id=db_item.id,
                        customer_po_number=po_obj.po_number,
                        invoice_number=db_invoice.invoice_no,
                        allocated_quantity=item_qty,
                        allocated_value=item_val,
                        status="ALLOCATED",
                        allocation_metadata={
                            "policy": po_policy,
                            **({"authorized_overrun_qty": str(line_overrun_qty)} if line_overrun_qty > Decimal("0") else {}),
                        },
                    ))
                    total_po_allocated_qty += item_qty
                    total_po_allocated_val += item_val

            # Cap header-level billed_quantity at DB check constraint ceiling
            # (ck_customer_po_billed_qty_bounded: billed_quantity <= ordered + cancelled).
            po_qty_ceiling = po_obj.ordered_quantity + po_obj.cancelled_quantity
            po_obj.billed_quantity = min(po_obj.billed_quantity + total_po_allocated_qty, po_qty_ceiling)
            po_obj.remaining_quantity = max(Decimal("0"), po_qty_ceiling - po_obj.billed_quantity)
            po_obj.billed_value += total_po_allocated_val
            po_obj.remaining_value = max(Decimal("0"), po_obj.ordered_value - po_obj.cancelled_value - po_obj.billed_value)
            po_obj.status = "FULLY_BILLED" if po_obj.remaining_quantity <= Decimal("0") else "PARTIALLY_BILLED"
            session.add(po_obj)

        if promotion_result and not req.is_draft:
            for applied in promotion_result.applied_promotions:
                await PromotionsEngine.record_redemption(
                    session=session,
                    company_id=company_id,
                    req=PromotionRedemptionRequest(
                        campaign_id=applied.campaign_id,
                        coupon_id=applied.coupon_id,
                        customer_id=req.customer_id,
                        reference_invoice_id=db_invoice.id,
                        discount_applied=applied.discount_amount,
                        items=[PromotionCartItem(
                            item_id=item.item_id or item.product_id or item.code,
                            variant_id=item.variant_id,
                            product_name=item.name,
                            category=item.category,
                            brand=item.brand,
                            unit_price=float(item.unit_price),
                            quantity=float(item.quantity),
                        ) for item in req.items],
                        customer_group_id=getattr(db_customer, "customer_group_id", None),
                        branch_id=branch_id,
                        store_id=branch_id,
                        channel=req.context.source_channel,
                    ),
                )

        # 10. Update Customer Outstanding if Credit Tender
        effective_credit_amount = credit_tender_amount
        if (req.payment_mode or "").upper() == "CREDIT" and effective_credit_amount == Decimal("0.00"):
            effective_credit_amount = net_rounded

        if effective_credit_amount > 0 and db_customer and not req.is_draft:
            prev_outstanding = Decimal(str(db_customer.outstanding or "0.00"))
            db_customer.outstanding = prev_outstanding + effective_credit_amount
            db_customer.modified_at = datetime.now(timezone.utc)
            session.add(db_customer)

            credit_entry = CustomerCreditLedgerEntry(
                id=f"ccle-{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_obj.id if branch_obj else branch_id,
                customer_id=db_customer.id,
                entry_date=datetime.now(timezone.utc),
                entry_type="DEBIT",
                amount=effective_credit_amount,
                balance_after=db_customer.outstanding,
                reference_type="SALES_INVOICE",
                reference_id=db_invoice.id,
                notes=f"Sales invoice {db_invoice.invoice_no} credit tender",
            )
            session.add(credit_entry)

        # 11. Physical Stock Mutation via WMS
        if warehouse_id and batch_deductions and not req.is_draft:
            tenant_ctx = TenantContext(
                company_id=company_id,
                branch_id=branch_id or "MAIN",
            )
            wms_svc = InventoryWmsService(session, tenant_ctx)

            # Resolve server-authoritative negative stock policy via SystemParameterService (P0-2)
            # Scope hierarchy: TERMINAL > BRANCH > COMPANY > GLOBAL
            allow_neg_param = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
                company_id=company_id,
                terminal_id=getattr(req.context, "terminal_id", "COMMON") or "COMMON",
                branch_id=branch_id,
            )
            server_allows_negative = bool(allow_neg_param.effective_value) if allow_neg_param else False

            for ded in batch_deductions:
                try:
                    await wms_svc.atomic_mutate_batch_stock(
                        product_id=ded["product_id"],
                        warehouse_id=warehouse_id,
                        batch_no=ded["batch_no"],
                        qty_delta=-ded["quantity"],
                        movement_type="OUTWARD_SALE",
                        reference_doc_type="Sales Invoice",
                        reference_doc_id=db_invoice.id,
                        remarks=f"Stock deducted for sales invoice: {db_invoice.invoice_no}",
                        user=req.context.cashier_id,
                        batch_id=ded.get("batch_id"),
                        serial_id=ded.get("serial_id"),
                        location_id=ded.get("warehouse_location_id"),
                    )
                except HTTPException as he:
                    if server_allows_negative:
                        logger.warning(
                            "Negative stock override permitted by server policy SMRITI.STOCK.ALLOW_NEGATIVE_STOCK on line %d: %s",
                            ded["line_no"],
                            he.detail,
                        )
                    else:
                        if commit:
                            await session.rollback()
                        raise
                except Exception:
                    if commit:
                        await session.rollback()
                    raise

        # 12. Payments Engine Multi-Tender Recording
        # POS does not send a client-derived tender amount. Create the tender
        # from the final server-calculated total only after all pricing rules,
        # promotions, tax, and rounding have been applied.
        tenders_to_process = list(req.tenders)
        if (
            req.context.source_channel == "POS_RETAIL"
            and (req.payment_mode or "CASH").upper() != "CREDIT"
            and not tenders_to_process
            and net_rounded > Decimal("0.00")
        ):
            from ..schemas.canonical_posting import CanonicalTenderItem
            tenders_to_process = [CanonicalTenderItem(
                tender_type=(req.payment_mode or "CASH").upper(),
                amount=net_rounded,
            )]

        total_paid = Decimal("0.00")
        payment_tenders_to_send = [
            t for t in tenders_to_process 
            if t.tender_type.upper() != "CREDIT" and Decimal(str(t.amount)) > Decimal("0.00")
        ]
        if payment_tenders_to_send and not req.is_draft:
            payment_tenders: List[PaymentTenderItem] = []
            for t in payment_tenders_to_send:
                t_amt = Decimal(str(t.amount))
                total_paid += t_amt
                payment_tenders.append(
                    PaymentTenderItem(
                        tender_type=t.tender_type.upper(),
                        amount=float(t_amt),
                        gateway_reference=t.reference_no,
                        notes=t.notes,
                    )
                )

            proc_payment_req = ProcessPaymentRequest(
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=db_invoice.id,
                party_id=db_customer.id if db_customer else None,
                tenders=payment_tenders,
                idempotency_key=f"PAY-{idempotency_key}",
                branch_id=branch_id or "BR-001",
                auto_allocate=True,
            )
            await PaymentsEngine.process_payment(
                session=session,
                company_id=company_id,
                req=proc_payment_req,
                created_by=req.context.cashier_id or "SYSTEM",
                commit=False,
            )

        db_invoice.paid_amount = total_paid
        db_invoice.balance_amount = max(Decimal("0.00"), net_rounded - total_paid)
        change_amount = max(Decimal("0.00"), total_paid - net_rounded)

        # 12b. Real-Time POS Sales Commission Accrual Hook
        from .sales_hook import write_commission_accrual
        await write_commission_accrual(
            db=session,
            company_id=company_id,
            branch_id=branch_id,
            invoice_id=db_invoice.id,
            invoice_no=db_invoice.invoice_no,
            grand_total=db_invoice.grand_total,
            items=calculated_lines,
            header_salesperson_id=req.context.cashier_id,
            creator=req.context.cashier_id or "SYSTEM",
        )

        # 13. Transactional Outbox Event Publication
        outbox_event = await OutboxService.record_event(
            session=session,
            target_channel="SALES_POSTING",
            payload={
                "event_type": "CanonicalSalesInvoicePostedEvent",
                "invoice_id": db_invoice.id,
                "invoice_no": db_invoice.invoice_no,
                "company_id": company_id,
                "branch_id": branch_id,
                "grand_total": str(db_invoice.grand_total),
                "customer_id": db_invoice.customer_id,
                "shift_id": shift_id,
                "items_count": len(calculated_lines),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            correlation_id=idempotency_key,
            event_type="SALES_INVOICE_POSTED",
            aggregate_type="SALES_INVOICE",
            aggregate_id=db_invoice.id,
            company_id=company_id,
            branch_id=branch_id,
        )

        if idemp_record:
            idemp_record.status = "COMMITTED"
            idemp_record.document_id = db_invoice.id
            idemp_record.document_no = db_invoice.invoice_no
            idemp_record.completed_at = datetime.now(timezone.utc)
            idemp_record.response_payload = {
                "invoice_id": db_invoice.id,
                "invoice_no": db_invoice.invoice_no,
                "grand_total": str(db_invoice.grand_total),
                "net_amount": str(db_invoice.net_amount or db_invoice.grand_total),
            }
            session.add(idemp_record)

        # Flush to persist db_invoice and its items to session
        await session.flush()

        # Automatic PSV Preparation (Immediate visibility in PSV workspace as Ready for Receiving)
        try:
            from .psv_projection import PSVProjectionService
            async with session.begin_nested():
                await PSVProjectionService.project_posted_invoice(
                    session=session,
                    invoice_id=db_invoice.id,
                    company_id=company_id,
                    branch_id=branch_id,
                )
        except Exception as psv_exc:
            logger.warning(
                "Automatic PSV preparation encountered notice for invoice %s: %s",
                db_invoice.id,
                psv_exc,
            )

        if commit:
            await session.commit()
        else:
            await session.flush()

        result_lines = [
            CanonicalPostingLineResult(
                line_no=l.line_no,
                variant_id=l.variant_id,
                item_id=l.item_id,
                product_id=l.product_id,
                code=l.code,
                name=l.name,
                quantity=l.quantity,
                unit_price=l.unit_price,
                discount_amount=l.discount_amount,
                taxable_value=l.taxable_value,
                gst_rate=l.gst_rate,
                cgst_amount=l.cgst_amount,
                sgst_amount=l.sgst_amount,
                igst_amount=l.igst_amount,
                tax_amount=l.tax_amount,
                total_amount=l.total_amount,
                batch_no=l.batch_no,
                hsn_code=l.hsn_code,
                mrp=l.mrp,
            )
            for l in calculated_lines
        ]

        return CanonicalPostingResult(
            success=True,
            invoice_id=db_invoice.id,
            invoice_no=db_invoice.invoice_no,
            invoice_date=db_invoice.date,
            gross_amount=total_gross,
            discount_amount=total_discount,
            taxable_amount=total_taxable,
            cgst_amount=total_cgst,
            sgst_amount=total_sgst,
            igst_amount=total_igst,
            tax_total=total_tax,
            round_off=round_off,
            net_amount=net_rounded,
            paid_amount=total_paid,
            balance_amount=db_invoice.balance_amount,
            change_amount=change_amount,
            is_replayed=False,
            items_count=len(result_lines),
            outbox_event_id=outbox_event.id if outbox_event else None,
            shift_id=shift_id,
            customer_id=db_invoice.customer_id,
            customer_name=db_invoice.customer_name,
            lines=result_lines,
        )

    @classmethod
    def _build_replayed_result(cls, existing_inv: SalesInvoice) -> CanonicalPostingResult:
        """Constructs an authoritative CanonicalPostingResult from a previously committed SalesInvoice."""
        replayed_lines = [
            CanonicalPostingLineResult(
                line_no=item.line_no or idx + 1,
                variant_id=item.variant_id,
                item_id=item.item_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=Decimal(str(item.quantity)),
                unit_price=Decimal(str(item.price)),
                discount_amount=Decimal(str(getattr(item, "discount_amount", None) or ((item.disc_pct or Decimal("0.00")) * item.price * item.quantity / Decimal("100.00")))),
                taxable_value=Decimal(str(item.taxable_value or "0.00")),
                gst_rate=Decimal(str(item.gst_rate or "0.00")),
                cgst_amount=Decimal(str(item.cgst_amount or "0.00")),
                sgst_amount=Decimal(str(item.sgst_amount or "0.00")),
                igst_amount=Decimal(str(item.igst_amount or "0.00")),
                tax_amount=Decimal(str(item.tax_amount or "0.00")),
                total_amount=Decimal(str(item.total_amount or "0.00")),
                batch_no=item.batch_no,
                hsn_code=item.hsn_code,
                mrp=Decimal(str(item.mrp)) if item.mrp else None,
            )
            for idx, item in enumerate(existing_inv.items)
        ]
        return CanonicalPostingResult(
            success=True,
            invoice_id=existing_inv.id,
            invoice_no=existing_inv.invoice_no,
            invoice_date=existing_inv.date,
            gross_amount=Decimal(str(existing_inv.grand_total)),
            discount_amount=Decimal(str(existing_inv.discount_amount or "0.00")),
            taxable_amount=Decimal(str(existing_inv.taxable_value or "0.00")),
            cgst_amount=sum(l.cgst_amount for l in replayed_lines),
            sgst_amount=sum(l.sgst_amount for l in replayed_lines),
            igst_amount=sum(l.igst_amount for l in replayed_lines),
            tax_total=Decimal(str(existing_inv.tax_total or "0.00")),
            round_off=Decimal(str(existing_inv.rounding_amount or "0.00")),
            net_amount=Decimal(str(existing_inv.net_amount or existing_inv.grand_total)),
            paid_amount=Decimal(str(existing_inv.paid_amount or "0.00")),
            balance_amount=Decimal(str(existing_inv.balance_amount or "0.00")),
            change_amount=Decimal("0.00"),
            is_replayed=True,
            items_count=len(replayed_lines),
            shift_id=existing_inv.shift_id,
            customer_id=existing_inv.customer_id,
            customer_name=existing_inv.customer_name,
            lines=replayed_lines,
        )
