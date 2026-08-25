"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import hmac
import hashlib
import base64
import json
import uuid
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ecom import (
    EcomChannel,
    EcomSkuMapping,
    EcomOrderImport,
    EcomStockSyncLog,
    EcomReconciliation,
)
from ..models.item_master import Item, ItemVariant
from ..models.inventory import Product, StockMovement
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.crm import Customer
from ..services.ecom_reservation import EcomInventoryReservationService
from ..services.outbox_service import OutboxService
from ..schemas.ecom import (
    ChannelCreateReq,
    SkuMappingReq,
    InboundOrderPayload,
    OrderImportResponse,
    OrderConvergenceResponse,
    StockBroadcastReq,
    StockBroadcastResponse,
    ReconciliationRunReq,
    ReconciliationReportResponse,
    DlqRetryReq,
    DlqRetryResponse,
)


# ---------------------------------------------------------------------------
# 1. 6 Channel Adapters
# ---------------------------------------------------------------------------
class BaseEcomAdapter:
    """Base Adapter defining standardized marketplace contract."""

    @classmethod
    def verify_signature(cls, raw_body: bytes, secret: str, received_signature: Optional[str]) -> bool:
        if not secret or not received_signature:
            return True  # Open or dev mode fallback
        computed = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, received_signature)

    @classmethod
    def normalize_payload(cls, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        return raw_payload


class InternalStoreAdapter(BaseEcomAdapter):
    """Adapter for SMRITI Native Online Storefront & B2B Web Portal."""
    pass


class ShopifyAdapter(BaseEcomAdapter):
    """Adapter for Shopify Webhooks (orders/create, inventory/update)."""

    @classmethod
    def verify_signature(cls, raw_body: bytes, secret: str, received_signature: Optional[str]) -> bool:
        if not secret or not received_signature:
            return True
        computed = base64.b64encode(hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()).decode("utf-8")
        return hmac.compare_digest(computed, received_signature) or hmac.compare_digest(
            hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest(), received_signature
        )


class WooCommerceAdapter(BaseEcomAdapter):
    """Adapter for WooCommerce Webhook payloads."""
    pass


class AmazonAdapter(BaseEcomAdapter):
    """Adapter for Amazon Seller Central SP-API order imports."""
    pass


class FlipkartAdapter(BaseEcomAdapter):
    """Adapter for Flipkart Marketplace Seller API."""
    pass


class CustomerPortalAdapter(BaseEcomAdapter):
    """Adapter for Customer Self-Service B2B / B2C Orders."""
    pass


# ---------------------------------------------------------------------------
# 2. eCommerce Engine
# ---------------------------------------------------------------------------
class EcomGrowthEngine:
    """
    Authoritative eCommerce & Omnichannel Engine (Section 8).
    Governs multi-channel order imports, signature validation, idempotency deduplication,
    SKU mapping, stock reservations, sales invoice convergence, DLQ retries, and financial reconciliation.
    """

    ADAPTER_MAP = {
        "INTERNAL_STORE": InternalStoreAdapter,
        "SHOPIFY": ShopifyAdapter,
        "WOOCOMMERCE": WooCommerceAdapter,
        "AMAZON": AmazonAdapter,
        "FLIPKART": FlipkartAdapter,
        "CUSTOMER_PORTAL": CustomerPortalAdapter,
    }

    # -----------------------------------------------------------------------
    # Channel & SKU Mapping
    # -----------------------------------------------------------------------
    @classmethod
    async def configure_channel(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ChannelCreateReq,
        user_id: Optional[str] = None,
    ) -> EcomChannel:
        stmt = select(EcomChannel).where(
            EcomChannel.company_id == company_id,
            EcomChannel.channel_code == req.channel_code,
            EcomChannel.is_deleted == False,
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            existing.name = req.name
            existing.channel_type = req.channel_type
            existing.store_url = req.store_url
            existing.webhook_secret = req.webhook_secret
            existing.sync_inventory = req.sync_inventory
            existing.sync_pricing = req.sync_pricing
            existing.auto_converge_orders = req.auto_converge_orders
            existing.settings = req.settings or {}
            existing.updated_by = user_id
            await session.commit()
            await session.refresh(existing)
            return existing

        channel = EcomChannel(
            id=f"ech_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            channel_code=req.channel_code,
            name=req.name,
            channel_type=req.channel_type,
            store_url=req.store_url,
            credential_ref=req.credential_ref,
            webhook_secret=req.webhook_secret,
            sync_inventory=req.sync_inventory,
            sync_pricing=req.sync_pricing,
            auto_converge_orders=req.auto_converge_orders,
            settings=req.settings or {},
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(channel)
        await session.commit()
        await session.refresh(channel)
        return channel

    @classmethod
    async def map_sku(
        cls,
        session: AsyncSession,
        company_id: str,
        req: SkuMappingReq,
        user_id: Optional[str] = None,
    ) -> EcomSkuMapping:
        stmt = select(EcomSkuMapping).where(
            EcomSkuMapping.company_id == company_id,
            EcomSkuMapping.channel_code == req.channel_code,
            EcomSkuMapping.external_sku == req.external_sku,
            EcomSkuMapping.is_deleted == False,
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            existing.smriti_sku = req.smriti_sku
            existing.item_id = req.item_id
            existing.variant_id = req.variant_id
            existing.external_product_id = req.external_product_id
            existing.is_active = True
            await session.commit()
            await session.refresh(existing)
            return existing

        mapping = EcomSkuMapping(
            id=f"esm_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            channel_code=req.channel_code,
            external_sku=req.external_sku,
            external_product_id=req.external_product_id,
            smriti_sku=req.smriti_sku,
            item_id=req.item_id,
            variant_id=req.variant_id,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(mapping)
        await session.commit()
        await session.refresh(mapping)
        return mapping

    # -----------------------------------------------------------------------
    # Inbound Webhook Processing with Idempotency & Stock Reservation
    # -----------------------------------------------------------------------
    @classmethod
    async def process_inbound_order(
        cls,
        session: AsyncSession,
        company_id: str,
        payload: InboundOrderPayload,
        raw_body: Optional[bytes] = None,
        signature: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> EcomOrderImport:
        """
        Receives external marketplace order, validates signature, prevents duplicate imports,
        resolves internal SKUs, and reserves inventory atomically.
        """
        # 1. Fetch channel config
        stmt_c = select(EcomChannel).where(
            EcomChannel.company_id == company_id,
            EcomChannel.channel_code == payload.channel_code,
            EcomChannel.is_deleted == False,
        )
        channel = (await session.execute(stmt_c)).scalars().first()
        if not channel:
            raise ValueError(f"Channel '{payload.channel_code}' is not registered.")

        # 2. Verify signature
        adapter_cls = cls.ADAPTER_MAP.get(channel.channel_type.upper(), BaseEcomAdapter)
        if raw_body and channel.webhook_secret and signature:
            if not adapter_cls.verify_signature(raw_body, channel.webhook_secret, signature):
                raise ValueError("Invalid webhook signature for channel.")

        # 3. Idempotency Check
        effective_key = idempotency_key or f"{payload.channel_code}_{payload.external_order_id}"
        stmt_imp = select(EcomOrderImport).where(
            EcomOrderImport.company_id == company_id,
            or_(
                EcomOrderImport.idempotency_key == effective_key,
                and_(
                    EcomOrderImport.channel_code == payload.channel_code,
                    EcomOrderImport.external_order_id == payload.external_order_id,
                ),
            ),
            EcomOrderImport.is_deleted == False,
        )
        existing_import = (await session.execute(stmt_imp)).scalars().first()
        if existing_import:
            return existing_import  # Idempotent replay returns existing record

        # 4. Create Inbound Order Import Record
        import_id = f"eoi_{uuid.uuid4().hex[:12]}"
        order_import = EcomOrderImport(
            id=import_id,
            company_id=company_id,
            channel_code=payload.channel_code,
            external_order_id=payload.external_order_id,
            external_order_number=payload.external_order_number,
            order_status="PENDING",
            idempotency_key=effective_key,
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            customer_mobile=payload.customer_mobile,
            currency=payload.currency,
            gross_amount=payload.gross_amount,
            tax_amount=payload.tax_amount,
            shipping_amount=payload.shipping_amount,
            discount_amount=payload.discount_amount,
            net_amount=payload.net_amount,
            payload=payload.raw_payload or payload.model_dump(mode="json"),
            is_active=True,
            is_deleted=False,
        )
        session.add(order_import)
        await session.flush()

        # 5. Reserve Stock for line items
        for line in payload.line_items:
            # Resolve internal SKU mapping if exists
            stmt_m = select(EcomSkuMapping).where(
                EcomSkuMapping.company_id == company_id,
                EcomSkuMapping.channel_code == payload.channel_code,
                EcomSkuMapping.external_sku == line.sku,
                EcomSkuMapping.is_deleted == False,
            )
            mapping = (await session.execute(stmt_m)).scalars().first()
            internal_sku = mapping.smriti_sku if mapping else line.sku

            res_result = await EcomInventoryReservationService.reserve_stock_for_ecom_order(
                session=session,
                sku=internal_sku,
                quantity=line.quantity,
                ecom_order_id=payload.external_order_id,
                correlation_id=effective_key,
            )
            if not res_result.get("success"):
                # If stock insufficient, record failure reason
                order_import.order_status = "FAILED"
                order_import.error_message = res_result.get("error", "Stock reservation failed.")
                await session.commit()
                return order_import

        order_import.order_status = "RESERVED"
        await session.commit()
        await session.refresh(order_import)
        return order_import

    # -----------------------------------------------------------------------
    # Order Convergence into SMRITI Sales Invoice
    # -----------------------------------------------------------------------
    @classmethod
    async def converge_order(
        cls,
        session: AsyncSession,
        company_id: str,
        import_id: str,
        user_id: Optional[str] = None,
    ) -> OrderConvergenceResponse:
        """
        Converges a RESERVED eCommerce order into an authoritative SMRITI SalesInvoice.
        """
        stmt = select(EcomOrderImport).where(
            EcomOrderImport.company_id == company_id,
            EcomOrderImport.id == import_id,
            EcomOrderImport.is_deleted == False,
        )
        order_import = (await session.execute(stmt)).scalars().first()
        if not order_import:
            raise ValueError(f"Order import '{import_id}' not found.")

        if order_import.order_status == "CONVERGED":
            return OrderConvergenceResponse(
                success=True,
                import_id=order_import.id,
                channel_code=order_import.channel_code,
                external_order_id=order_import.external_order_id,
                status="CONVERGED",
                invoice_id=order_import.converged_invoice_id,
                message="Order already converged.",
            )

        # Get or create customer
        cust_name = order_import.customer_name or f"eCom Customer ({order_import.channel_code})"
        stmt_cust = select(Customer).where(
            Customer.company_id == company_id,
            Customer.mobile == order_import.customer_mobile,
            Customer.is_deleted == False,
        )
        customer = (await session.execute(stmt_cust)).scalars().first() if order_import.customer_mobile else None
        if not customer:
            customer = Customer(
                id=f"cust_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                name=cust_name,
                mobile=order_import.customer_mobile,
                email=order_import.customer_email,
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(customer)
            await session.flush()

        # Create SalesInvoice
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        invoice_no = f"INV-ECOM-{order_import.channel_code[:3].upper()}-{today_str}-{uuid.uuid4().hex[:4].upper()}"
        invoice_id = f"inv_{uuid.uuid4().hex[:12]}"

        invoice = SalesInvoice(
            id=invoice_id,
            company_id=company_id,
            customer_id=customer.id,
            customer_name=customer.name,
            invoice_no=invoice_no,
            date=date.today(),
            status="PAID",
            taxable_value=order_import.gross_amount - order_import.tax_amount,
            tax_total=order_import.tax_amount,
            grand_total=order_import.net_amount,
            net_amount=order_import.net_amount,
            paid_amount=order_import.net_amount,
            source_type="ECOM",
            source_system=order_import.channel_code,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(invoice)
        await session.flush()

        # Convert line items and release reservations into actual stock mutations
        raw_payload = order_import.payload
        if isinstance(raw_payload, str):
            try:
                raw_payload = json.loads(raw_payload)
            except Exception:
                raw_payload = {}
        raw_lines = raw_payload.get("line_items", []) if isinstance(raw_payload, dict) else []

        for l in raw_lines:
            sku = l.get("sku", "GENERAL_SKU")
            qty = Decimal(str(l.get("quantity", 1.0)))
            unit_p = Decimal(str(l.get("unit_price", 0.0)))
            line_tot = (qty * unit_p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Deduct reserved_stock on Product
            prod_stmt = select(Product).where(or_(Product.sku == sku, Product.code == sku)).with_for_update()
            prod_obj = (await session.execute(prod_stmt)).scalars().first()
            if prod_obj:
                cur_res = Decimal(str(getattr(prod_obj, "reserved_stock", 0) or 0))
                prod_obj.reserved_stock = max(Decimal("0.00"), cur_res - qty)

            # Post Outward Stock Movement (Trigger trg_inventory_state_reconciliation updates Product.stock)
            mov = StockMovement(
                id=f"sm_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                movement_type="OUTWARD_ECOM",
                reference_doc_type="ECOM_INVOICE",
                reference_doc_id=invoice.invoice_no,
                product_id=prod_obj.id if prod_obj else "unknown",
                product_name=prod_obj.name if prod_obj else sku,
                sku=sku,
                quantity=-abs(qty),
                unit_cost=unit_p,
                remarks=f"Converged eCommerce Sale {order_import.channel_code}:{order_import.external_order_id}",
                is_active=True,
                is_deleted=False,
            )
            session.add(mov)

        order_import.order_status = "CONVERGED"
        order_import.converged_invoice_id = invoice.id
        await session.commit()
        await session.refresh(order_import)

        return OrderConvergenceResponse(
            success=True,
            import_id=order_import.id,
            channel_code=order_import.channel_code,
            external_order_id=order_import.external_order_id,
            status="CONVERGED",
            invoice_id=invoice.id,
            invoice_no=invoice.invoice_no,
            message="Order successfully converged into SalesInvoice.",
        )

    # -----------------------------------------------------------------------
    # Dead Letter Queue (DLQ) & Retries
    # -----------------------------------------------------------------------
    @classmethod
    async def retry_dlq_imports(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DlqRetryReq,
    ) -> DlqRetryResponse:
        stmt = select(EcomOrderImport).where(
            EcomOrderImport.company_id == company_id,
            EcomOrderImport.id.in_(req.import_ids),
            EcomOrderImport.is_deleted == False,
        )
        imports = (await session.execute(stmt)).scalars().all()

        succeeded = 0
        failed = 0
        results = []

        for imp in imports:
            imp.retry_count = (imp.retry_count or 0) + 1
            imp.last_retry_at = datetime.now(timezone.utc).replace(tzinfo=None)

            if imp.retry_count > (imp.max_retries or 3):
                imp.order_status = "DLQ"
                failed += 1
                results.append({"import_id": imp.id, "status": "DLQ", "message": "Max retry limit exceeded."})
            else:
                imp.order_status = "RESERVED"  # Re-evaluate
                succeeded += 1
                results.append({"import_id": imp.id, "status": "RETRY_QUEUED", "retry_count": imp.retry_count})

        await session.commit()
        return DlqRetryResponse(
            processed_count=len(imports),
            succeeded_count=succeeded,
            failed_count=failed,
            results=results,
        )

    # -----------------------------------------------------------------------
    # Channel Reconciliation
    # -----------------------------------------------------------------------
    @classmethod
    async def generate_channel_reconciliation(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ReconciliationRunReq,
        user_id: Optional[str] = None,
    ) -> EcomReconciliation:
        # Sum converged orders in SMRITI for channel in period
        stmt = select(
            func.count(EcomOrderImport.id),
            func.coalesce(func.sum(EcomOrderImport.net_amount), Decimal("0.00")),
        ).where(
            EcomOrderImport.company_id == company_id,
            EcomOrderImport.channel_code == req.channel_code,
            EcomOrderImport.order_status == "CONVERGED",
            func.date(EcomOrderImport.imported_at) >= req.period_start,
            func.date(EcomOrderImport.imported_at) <= req.period_end,
            EcomOrderImport.is_deleted == False,
        )
        res = (await session.execute(stmt)).first()
        smriti_cnt = res[0] or 0
        smriti_rev = Decimal(str(res[1] or 0.00))

        variance = Decimal(str(req.channel_gross_revenue)) - smriti_rev
        status = "RECONCILED" if abs(variance) < Decimal("1.00") else "DISCREPANCY"

        rec_no = f"REC-{req.channel_code[:3].upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        rec = EcomReconciliation(
            id=f"rec_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            reconciliation_no=rec_no,
            channel_code=req.channel_code,
            period_start=req.period_start,
            period_end=req.period_end,
            channel_order_count=req.channel_order_count,
            channel_gross_revenue=req.channel_gross_revenue,
            smriti_order_count=smriti_cnt,
            smriti_gross_revenue=smriti_rev,
            variance_amount=variance,
            status=status,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
        return rec
