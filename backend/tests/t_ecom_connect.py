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
import uuid
from decimal import Decimal
from datetime import datetime, date
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.inventory import Product, StockMovement
from app.models.item_master import Item
from app.models.ecom import EcomChannel, EcomSkuMapping, EcomOrderImport
from app.services.ecom_engine import EcomGrowthEngine, ShopifyAdapter
from app.schemas.ecom import (
    ChannelCreateReq,
    SkuMappingReq,
    InboundOrderPayload,
    EcomOrderItemLine,
    DlqRetryReq,
    ReconciliationRunReq,
)


def _get_auth_headers(role: str = "STORE_MANAGER") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_ecom_channel_configuration_and_sku_mapping():
    """Verify eCommerce channel configuration and external SKU mapping registry."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # 1. Configure Channel
        chan = await EcomGrowthEngine.configure_channel(
            session=session,
            company_id="COMP-001",
            req=ChannelCreateReq(
                channel_code=f"SHOPIFY_{suffix.upper()}",
                name=f"Shopify Flagship Store {suffix}",
                channel_type="SHOPIFY",
                store_url="https://smriti-demo.myshopify.com",
                webhook_secret=f"secret_{suffix}",
            ),
            user_id="usr-super",
        )
        assert chan.id is not None
        assert chan.channel_code == f"SHOPIFY_{suffix.upper()}"

        # 2. Seed Item
        item = Item(
            id=f"item_ecom_{suffix}",
            company_id="COMP-001",
            item_code=f"SKU-INT-{suffix.upper()}",
            item_name=f"Linen Shirt {suffix}",
            category="GENERAL",
            hsn_code="5208",
            selling_price=Decimal("1500.00"),
            mrp=Decimal("1999.00"),
            tax_rate=Decimal("12.00"),
            status="ACTIVE",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.commit()

        # 3. Map SKU
        mapping = await EcomGrowthEngine.map_sku(
            session=session,
            company_id="COMP-001",
            req=SkuMappingReq(
                channel_code=chan.channel_code,
                external_sku=f"EXT-SH-{suffix.upper()}",
                external_product_id="gid://shopify/Product/12345",
                smriti_sku=item.item_code,
                item_id=item.id,
            ),
            user_id="usr-super",
        )
        assert mapping.id is not None
        assert mapping.smriti_sku == item.item_code


@pytest.mark.asyncio
async def test_hmac_signature_verification_across_adapters():
    """Verify HMAC SHA-256 signature verification for Shopify webhooks."""
    secret = "shpss_test_secret_key_123"
    raw_body = b'{"id": 8209829119483, "email": "customer@example.com"}'

    # Compute valid signature
    valid_sig = base64.b64encode(hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()).decode("utf-8")
    assert ShopifyAdapter.verify_signature(raw_body, secret, valid_sig) == True

    # Invalid signature
    assert ShopifyAdapter.verify_signature(raw_body, secret, "invalid_sig_999") == False


@pytest.mark.asyncio
async def test_inbound_order_deduplication_and_stock_reservation():
    """Verify inbound order deduplication (idempotency) and transactional stock reservation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        sku = f"SKU-RES-{suffix.upper()}"

        # 1. Seed Channel
        chan = await EcomGrowthEngine.configure_channel(
            session=session,
            company_id="COMP-001",
            req=ChannelCreateReq(
                channel_code=f"WOO_{suffix.upper()}",
                name=f"Woo Store {suffix}",
                channel_type="WOOCOMMERCE",
            ),
        )

        # 2. Seed Product in inventory
        prod = Product(
            id=f"prod_res_{suffix}",
            company_id="COMP-001",
            code=sku,
            name=f"Reserve Item {suffix}",
            sku=sku,
            barcode=sku,
            price=Decimal("800.00"),
            mrp=Decimal("999.00"),
            category="GENERAL",
            hsn_code="5208",
            stock=100,
            reserved_stock=0,
            is_active=True,
            is_deleted=False,
        )
        session.add(prod)
        await session.commit()

        # 3. Process Inbound Order
        order_payload = InboundOrderPayload(
            channel_code=chan.channel_code,
            external_order_id=f"WOO-ORD-{suffix.upper()}",
            external_order_number=f"#WOO-{suffix[:4].upper()}",
            customer_name="Pooja Sharma",
            customer_mobile="+919876543210",
            gross_amount=Decimal("1600.00"),
            net_amount=Decimal("1600.00"),
            line_items=[
                EcomOrderItemLine(sku=sku, quantity=Decimal("2.0"), unit_price=Decimal("800.00")),
            ],
        )
        imp1 = await EcomGrowthEngine.process_inbound_order(
            session=session,
            company_id="COMP-001",
            payload=order_payload,
        )
        assert imp1.id is not None
        assert imp1.order_status == "RESERVED"

        # Verify stock reservation in DB
        await session.refresh(prod)
        assert prod.reserved_stock == Decimal("2.0000")

        # 4. Ingest Duplicate Order (Idempotency Replay)
        imp2 = await EcomGrowthEngine.process_inbound_order(
            session=session,
            company_id="COMP-001",
            payload=order_payload,
        )
        assert imp2.id == imp1.id
        await session.refresh(prod)
        assert prod.reserved_stock == Decimal("2.0000")  # Stock not double-reserved


@pytest.mark.asyncio
async def test_insufficient_stock_failure_and_dlq_retries():
    """Verify stock shortage failure logging and Dead Letter Queue (DLQ) retry cycle."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        sku = f"SKU-SHORT-{suffix.upper()}"

        # Seed Channel & Product (Stock = 5)
        chan = await EcomGrowthEngine.configure_channel(
            session=session,
            company_id="COMP-001",
            req=ChannelCreateReq(
                channel_code=f"AMZ_{suffix.upper()}",
                name=f"Amazon Store {suffix}",
                channel_type="AMAZON",
            ),
        )
        prod = Product(
            id=f"prod_short_{suffix}",
            company_id="COMP-001",
            code=sku,
            name=f"Shortage Item {suffix}",
            sku=sku,
            barcode=sku,
            price=Decimal("500.00"),
            mrp=Decimal("699.00"),
            category="GENERAL",
            hsn_code="5208",
            stock=5,
            reserved_stock=0,
            is_active=True,
            is_deleted=False,
        )
        session.add(prod)
        await session.commit()

        # Ingest order requesting 50 units (exceeds stock 5)
        order_payload = InboundOrderPayload(
            channel_code=chan.channel_code,
            external_order_id=f"AMZ-ORD-{suffix.upper()}",
            gross_amount=Decimal("25000.00"),
            net_amount=Decimal("25000.00"),
            line_items=[
                EcomOrderItemLine(sku=sku, quantity=Decimal("50.0"), unit_price=Decimal("500.00")),
            ],
        )
        failed_imp = await EcomGrowthEngine.process_inbound_order(
            session=session,
            company_id="COMP-001",
            payload=order_payload,
        )
        assert failed_imp.order_status == "FAILED"
        assert "Insufficient stock" in failed_imp.error_message

        # Retry DLQ worker 4 times (max_retries = 3)
        for _ in range(4):
            dlq_res = await EcomGrowthEngine.retry_dlq_imports(
                session=session,
                company_id="COMP-001",
                req=DlqRetryReq(import_ids=[failed_imp.id]),
            )
        await session.refresh(failed_imp)
        assert failed_imp.order_status == "DLQ"


@pytest.mark.asyncio
async def test_order_convergence_to_sales_invoice():
    """Verify order convergence into authoritative SalesInvoice and outward stock movement."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        sku = f"SKU-CONV-{suffix.upper()}"

        # Seed Channel & Product
        chan = await EcomGrowthEngine.configure_channel(
            session=session,
            company_id="COMP-001",
            req=ChannelCreateReq(
                channel_code=f"FLIP_{suffix.upper()}",
                name=f"Flipkart Channel {suffix}",
                channel_type="FLIPKART",
            ),
        )
        prod = Product(
            id=f"prod_conv_{suffix}",
            company_id="COMP-001",
            code=sku,
            name=f"Converge Item {suffix}",
            sku=sku,
            barcode=sku,
            price=Decimal("1200.00"),
            mrp=Decimal("1500.00"),
            category="GENERAL",
            hsn_code="5208",
            stock=50,
            reserved_stock=0,
            is_active=True,
            is_deleted=False,
        )
        session.add(prod)
        await session.commit()

        # Ingest and Reserve
        imp = await EcomGrowthEngine.process_inbound_order(
            session=session,
            company_id="COMP-001",
            payload=InboundOrderPayload(
                channel_code=chan.channel_code,
                external_order_id=f"FLIP-ORD-{suffix.upper()}",
                customer_name="Nitin Joshi",
                customer_mobile="+919123456780",
                gross_amount=Decimal("2400.00"),
                tax_amount=Decimal("288.00"),
                net_amount=Decimal("2400.00"),
                line_items=[
                    EcomOrderItemLine(sku=sku, quantity=Decimal("2.0"), unit_price=Decimal("1200.00")),
                ],
            ),
        )
        assert imp.order_status == "RESERVED"

        # Converge to SalesInvoice
        conv_res = await EcomGrowthEngine.converge_order(
            session=session,
            company_id="COMP-001",
            import_id=imp.id,
            user_id="usr-super",
        )
        assert conv_res.success == True
        assert conv_res.status == "CONVERGED"
        assert conv_res.invoice_id is not None
        assert "INV-ECOM-FLI-" in conv_res.invoice_no

        # Verify stock and reservation released
        await session.refresh(prod)
        assert prod.reserved_stock == Decimal("0.0000")
        assert int(prod.stock) == 48


@pytest.mark.asyncio
async def test_channel_financial_reconciliation():
    """Verify channel revenue settlement reconciliation against SMRITI converged invoices."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        chan_code = f"INTERNAL_{suffix.upper()}"
        chan = await EcomGrowthEngine.configure_channel(
            session=session,
            company_id="COMP-001",
            req=ChannelCreateReq(
                channel_code=chan_code,
                name=f"Internal Store {suffix}",
                channel_type="INTERNAL_STORE",
            ),
        )

        # Seed Converged Import
        imp = EcomOrderImport(
            id=f"imp_rec_{suffix}",
            company_id="COMP-001",
            channel_code=chan_code,
            external_order_id=f"INT-ORD-{suffix.upper()}",
            order_status="CONVERGED",
            gross_amount=Decimal("10000.00"),
            net_amount=Decimal("10000.00"),
            imported_at=datetime.now(),
            is_active=True,
            is_deleted=False,
        )
        session.add(imp)
        await session.commit()

        # Run Reconciliation (Channel reports ₹10,000, SMRITI converged is ₹10,000 -> RECONCILED)
        rec = await EcomGrowthEngine.generate_channel_reconciliation(
            session=session,
            company_id="COMP-001",
            req=ReconciliationRunReq(
                channel_code=chan_code,
                period_start=date.today(),
                period_end=date.today(),
                channel_gross_revenue=Decimal("10000.00"),
                channel_order_count=1,
            ),
            user_id="usr-super",
        )
        assert rec.status == "RECONCILED"
        assert rec.variance_amount == Decimal("0.00")
        assert rec.smriti_gross_revenue == Decimal("10000.00")


@pytest.mark.asyncio
async def test_api_ecom_endpoints():
    """Verify REST API endpoints for eCommerce channels, SKU mappings, inbound orders, and reconciliation."""
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. POST /ecom/channels
        chan_res = await client.post(
            "/api/v1/ecom/channels",
            json={
                "channel_code": f"SHOP-API-{suffix.upper()}",
                "name": f"Shopify API Channel {suffix}",
                "channel_type": "SHOPIFY",
                "store_url": "https://api-store.myshopify.com",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert chan_res.status_code == 200
        assert chan_res.json()["channel_code"] == f"SHOP-API-{suffix.upper()}"

        # 2. POST /ecom/orders/inbound
        # First seed a product so reservation succeeds
        sessionmaker = get_company_sessionmaker("smriti001")
        async with sessionmaker() as session:
            p = Product(
                id=f"prod_api_{suffix}",
                company_id="COMP-001",
                code=f"SKU-API-{suffix.upper()}",
                name=f"API Product {suffix}",
                sku=f"SKU-API-{suffix.upper()}",
                barcode=f"SKU-API-{suffix.upper()}",
                price=Decimal("1000.00"),
                mrp=Decimal("1200.00"),
                category="GENERAL",
                hsn_code="5208",
                stock=50,
                reserved_stock=0,
                is_active=True,
                is_deleted=False,
            )
            session.add(p)
            await session.commit()

        ord_res = await client.post(
            "/api/v1/ecom/orders/inbound",
            json={
                "channel_code": f"SHOP-API-{suffix.upper()}",
                "external_order_id": f"ORD-API-{suffix.upper()}",
                "customer_name": "API Customer",
                "customer_mobile": "+919000000000",
                "gross_amount": 1000.0,
                "net_amount": 1000.0,
                "line_items": [
                    {"sku": f"SKU-API-{suffix.upper()}", "quantity": 1.0, "unit_price": 1000.0},
                ],
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert ord_res.status_code == 200
        assert ord_res.json()["order_status"] == "RESERVED"
        import_id = ord_res.json()["id"]

        # 3. POST /ecom/orders/{id}/converge
        conv_res = await client.post(
            f"/api/v1/ecom/orders/{import_id}/converge",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert conv_res.status_code == 200
        assert conv_res.json()["status"] == "CONVERGED"
