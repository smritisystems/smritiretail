"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 9
"""

import base64
import hashlib
import hmac
import json
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user
from app.api.v1.databridge import require_databridge_entitlement
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeScheduleStatus,
    DataBridgeScheduleCreateRequest,
    DataBridgeOutboundWebhookRequest,
)
from app.services.databridge.scheduler_engine import DataBridgeScheduler
from app.services.databridge.webhook_dispatcher import DataBridgeWebhookDispatcher
from app.services.databridge.exceptions import DataBridgeValidationError


@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={
            "sub": "test_sysadmin",
            "role": UserRole.SYSADMIN.value,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_tc_sched_001_schedule_registration_and_listing():
    """Verify background pull schedule registration, interval calculation, and tenant isolation."""
    tenant_a = "tenant_sched_001"
    tenant_b = "tenant_sched_002"

    req_shopify = DataBridgeScheduleCreateRequest(
        name="Shopify Hourly Order Pull",
        connector_type=DataBridgeConnectorType.SHOPIFY_REST,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        interval_minutes=60,
        config=DataBridgeConnectorConfig(
            connector_type=DataBridgeConnectorType.SHOPIFY_REST,
            endpoint_url="https://demo.myshopify.com",
            access_token="shpat_test_abc",
        ),
        auto_import_to_async_queue=True,
    )

    sched_a = DataBridgeScheduler.create_schedule(tenant_id=tenant_a, req=req_shopify)
    assert sched_a.schedule_id.startswith("SCHED-")
    assert sched_a.tenant_id == tenant_a
    assert sched_a.status == DataBridgeScheduleStatus.ACTIVE
    assert sched_a.interval_minutes == 60
    assert sched_a.auto_import_to_async_queue is True
    assert sched_a.next_run_at is not None

    req_tally = DataBridgeScheduleCreateRequest(
        name="Tally Daily Master Sync",
        connector_type=DataBridgeConnectorType.TALLY_PRIME_XML,
        entity_type=DataBridgeEntityType.ITEM,
        interval_minutes=1440,
        config=DataBridgeConnectorConfig(
            connector_type=DataBridgeConnectorType.TALLY_PRIME_XML,
            company_code="Retail Mart",
        ),
    )
    sched_a2 = DataBridgeScheduler.create_schedule(tenant_id=tenant_a, req=req_tally)

    # Listing for tenant A
    all_a = DataBridgeScheduler.list_schedules(tenant_id=tenant_a)
    assert len(all_a) >= 2
    ids_a = {s.schedule_id for s in all_a}
    assert sched_a.schedule_id in ids_a
    assert sched_a2.schedule_id in ids_a

    # Filter by connector_type
    shopify_only = DataBridgeScheduler.list_schedules(
        tenant_id=tenant_a,
        connector_type=DataBridgeConnectorType.SHOPIFY_REST,
    )
    assert len(shopify_only) == 1
    assert shopify_only[0].schedule_id == sched_a.schedule_id

    # Verify tenant isolation (tenant B should have empty list)
    b_schedules = DataBridgeScheduler.list_schedules(tenant_id=tenant_b)
    assert len(b_schedules) == 0


@pytest.mark.asyncio
async def test_tc_sched_002_manual_trigger_execution_cycle():
    """Verify manual on-demand execution of registered pull schedule with mocked payload."""
    tenant_id = "tenant_trigger_001"
    req = DataBridgeScheduleCreateRequest(
        name="Shopify Test Trigger",
        connector_type=DataBridgeConnectorType.SHOPIFY_REST,
        entity_type=DataBridgeEntityType.ITEM,
        interval_minutes=30,
        config=DataBridgeConnectorConfig(
            connector_type=DataBridgeConnectorType.SHOPIFY_REST,
            endpoint_url="https://demo.myshopify.com",
            access_token="shpat_demo",
        ),
        params={
            "raw_payload": {
                "products": [
                    {
                        "id": 101,
                        "title": "Triggered Bluetooth Speaker",
                        "price": "1499.00",
                        "vendor": "Sony",
                    }
                ]
            }
        },
        auto_import_to_async_queue=True,
    )

    sched = DataBridgeScheduler.create_schedule(tenant_id=tenant_id, req=req)

    # Trigger execution cycle
    mock_db = MagicMock()
    trigger_res = await DataBridgeScheduler.trigger_schedule(
        tenant_id=tenant_id,
        schedule_id=sched.schedule_id,
        db_session=mock_db,
    )

    assert trigger_res.schedule_id == sched.schedule_id
    assert trigger_res.status == "COMPLETED"
    assert trigger_res.records_pulled == 1
    assert trigger_res.job_id is not None
    assert "Successfully executed" in trigger_res.message

    # Verify schedule state updated
    updated_sched = DataBridgeScheduler.get_schedule(tenant_id=tenant_id, schedule_id=sched.schedule_id)
    assert updated_sched is not None
    assert updated_sched.last_status == "SUCCESS"
    assert updated_sched.last_records_count == 1
    assert updated_sched.last_run_at is not None


@pytest.mark.asyncio
async def test_tc_sched_003_trigger_nonexistent_schedule_error():
    """Verify error raised when attempting to trigger unknown schedule."""
    with pytest.raises(DataBridgeValidationError) as exc:
        await DataBridgeScheduler.trigger_schedule(
            tenant_id="tenant_trigger_001",
            schedule_id="SCHED-UNKNOWN-999",
        )
    assert "SCHED-UNKNOWN-999" in str(exc.value) and "not found" in str(exc.value)


@pytest.mark.asyncio
async def test_tc_hook_001_hmac_signature_verification():
    """Verify HMAC-SHA256 signature verification across Base64 and Hexadecimal encodings."""
    secret = "SUPER_SECRET_HMAC_KEY_123"
    payload = b'{"event":"test","timestamp":1700000000}'

    # 1. Base64 digest (Shopify style)
    b64_sig = base64.b64encode(hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()).decode("utf-8")
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, secret, b64_sig) is True

    # 2. Hex digest (Standard / GitHub style)
    hex_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, secret, hex_sig) is True

    # 3. Hex digest with sha256= prefix
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, secret, f"sha256={hex_sig}") is True

    # 4. Invalid signature
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, secret, "invalid_sig_abc") is False

    # 5. Empty secret or sig
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, "", hex_sig) is False
    assert DataBridgeWebhookDispatcher.verify_hmac_signature(payload, secret, None) is False


@pytest.mark.asyncio
async def test_tc_hook_002_shopify_inbound_order_webhook():
    """Verify inbound Shopify orders/create webhook ingestion and transformation."""
    secret = "shopify_shared_webhook_secret"
    order_data = {
        "order": {
            "name": "#SHOP-8821",
            "created_at": "2026-10-06T12:00:00Z",
            "customer": {"first_name": "Rohan", "last_name": "Sharma"},
            "line_items": [
                {
                    "title": "USB-C Fast Charger 65W",
                    "quantity": 2,
                    "price": "899.00",
                }
            ],
            "total_price": "1798.00",
        }
    }
    raw_body = json.dumps(order_data).encode("utf-8")
    b64_sig = base64.b64encode(hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()).decode("utf-8")

    headers = {
        "X-Shopify-Topic": "orders/create",
        "X-Shopify-Hmac-Sha256": b64_sig,
        "Content-Type": "application/json",
    }

    res = await DataBridgeWebhookDispatcher.process_inbound_webhook(
        connector_type=DataBridgeConnectorType.SHOPIFY_REST,
        raw_body=raw_body,
        headers=headers,
        secret=secret,
        tenant_id="smriti001",
    )

    assert res.connector_type == DataBridgeConnectorType.SHOPIFY_REST.value
    assert res.event_topic == "orders/create"
    assert res.status == "PROCESSED"
    assert res.records_ingested == 1
    assert res.entity_type == DataBridgeEntityType.SALES_INVOICE.value
    assert res.job_id.startswith("WB-ING-")


@pytest.mark.asyncio
async def test_tc_hook_003_unicommerce_inbound_catalog_webhook():
    """Verify inbound Unicommerce catalog item create webhook ingestion and transformation."""
    secret = "unicommerce_webhook_secret"
    catalog_data = {
        "items": [
            {
                "itemTypeSKU": "SKU-UNI-77",
                "name": "Men Cotton T-Shirt L",
                "mrp": 799.0,
                "ean": "8901234567890",
            }
        ]
    }
    raw_body = json.dumps(catalog_data).encode("utf-8")
    hex_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    headers = {
        "X-Unicommerce-Event": "catalog.item.create",
        "X-Unicommerce-Signature": hex_sig,
        "Content-Type": "application/json",
    }

    res = await DataBridgeWebhookDispatcher.process_inbound_webhook(
        connector_type=DataBridgeConnectorType.UNICOMMERCE_API,
        raw_body=raw_body,
        headers=headers,
        secret=secret,
        tenant_id="smriti001",
    )

    assert res.connector_type == DataBridgeConnectorType.UNICOMMERCE_API.value
    assert res.event_topic == "catalog.item.create"
    assert res.status == "PROCESSED"
    assert res.records_ingested == 1
    assert res.entity_type == DataBridgeEntityType.ITEM.value


@pytest.mark.asyncio
async def test_tc_hook_004_invalid_signature_rejection():
    """Verify rejection when inbound webhook fails cryptographic signature verification."""
    secret = "valid_secret"
    raw_body = b'{"msg":"tampered"}'
    headers = {
        "X-Shopify-Topic": "orders/create",
        "X-Shopify-Hmac-Sha256": "forged_signature_xyz",
    }

    with pytest.raises(DataBridgeValidationError) as exc:
        await DataBridgeWebhookDispatcher.process_inbound_webhook(
            connector_type=DataBridgeConnectorType.SHOPIFY_REST,
            raw_body=raw_body,
            headers=headers,
            secret=secret,
        )
    assert "Invalid webhook HMAC signature" in str(exc.value)


@pytest.mark.asyncio
async def test_tc_hook_005_outbound_cdc_event_dispatch():
    """Verify outbound Change Data Capture (CDC) event dispatch and cryptographic signing."""
    req = DataBridgeOutboundWebhookRequest(
        webhook_url="https://subscriber.retailos.com/api/v1/webhook",
        event_type="ITEM_UPDATED",
        payload={
            "item_code": "ITM-991",
            "item_name": "Premium Keyboard",
            "stock_balance": 45,
        },
        secret="OUTBOUND_KEY_SEC_99",
    )

    res = await DataBridgeWebhookDispatcher.dispatch_outbound_event(req=req, tenant_id="smriti001")
    assert res.delivery_id.startswith("DELIV-")
    assert res.event_type == "ITEM_UPDATED"
    assert res.target_url == "https://subscriber.retailos.com/api/v1/webhook"
    assert res.is_delivered is True
    assert res.status_code == 200
    assert res.latency_ms > 0
    assert res.signature.startswith("sha256=")


@pytest.mark.asyncio
async def test_tc_api_001_scheduler_and_webhook_endpoints(auth_headers):
    """End-to-end ASGI test of Phase 9 background pull scheduler and real-time webhook API endpoints."""
    mock_db = MagicMock()
    async def override_get_company_db():
        yield mock_db

    test_user = User(
        id="usr_sysadmin",
        username="test_sysadmin",
        email="sysadmin@smriti.local",
        role=UserRole.SYSADMIN,
        is_active=True,
    )
    test_binding = TenantCapabilityBinding(
        company_id="smriti001",
        capability_code="DATABRIDGE",
        is_active=True,
    )

    async def override_get_current_user():
        return test_user

    async def override_require_databridge_entitlement():
        return test_binding

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_databridge_entitlement] = override_require_databridge_entitlement

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. POST /api/v1/databridge/schedules
            create_payload = {
                "name": "Integration Test Shopify Schedule",
                "connector_type": "SHOPIFY_REST",
                "entity_type": "SALES_INVOICE",
                "interval_minutes": 15,
                "config": {
                    "connector_type": "SHOPIFY_REST",
                    "endpoint_url": "https://test.myshopify.com",
                    "access_token": "shpat_test",
                },
                "params": {
                    "raw_payload": {
                        "orders": [
                            {
                                "name": "#E2E-101",
                                "created_at": "2026-10-06T15:00:00Z",
                                "total_price": "2500.00",
                                "line_items": [{"title": "Headphones", "quantity": 1, "price": "2500.00"}],
                            }
                        ]
                    }
                },
                "auto_import_to_async_queue": False,
            }
            res_create = await client.post("/api/v1/databridge/schedules", json=create_payload, headers=auth_headers)
            assert res_create.status_code == 201, res_create.text
            sched_data = res_create.json()
            schedule_id = sched_data["schedule_id"]
            assert schedule_id.startswith("SCHED-")
            assert sched_data["status"] == "ACTIVE"

            # 2. GET /api/v1/databridge/schedules
            res_list = await client.get("/api/v1/databridge/schedules", headers=auth_headers)
            assert res_list.status_code == 200, res_list.text
            schedules_list = res_list.json()
            assert any(s["schedule_id"] == schedule_id for s in schedules_list)

            # 3. POST /api/v1/databridge/schedules/{schedule_id}/trigger
            res_trigger = await client.post(f"/api/v1/databridge/schedules/{schedule_id}/trigger", headers=auth_headers)
            assert res_trigger.status_code == 200, res_trigger.text
            trigger_data = res_trigger.json()
            assert trigger_data["status"] == "COMPLETED"
            assert trigger_data["records_pulled"] == 1

            # 4. POST /api/v1/databridge/webhooks/inbound/SHOPIFY_REST (Signed Inbound Webhook)
            secret = "e2e_webhook_secret"
            webhook_body = json.dumps({
                "product": {
                    "id": 881,
                    "title": "Ergonomic Office Chair",
                    "vendor": "Steelcase",
                    "variants": [{"price": "14500.00", "inventory_quantity": 8}],
                }
            }).encode("utf-8")
            sig = base64.b64encode(hmac.new(secret.encode("utf-8"), webhook_body, hashlib.sha256).digest()).decode("utf-8")
            hook_headers = {
                "X-Shopify-Topic": "products/create",
                "X-Shopify-Hmac-Sha256": sig,
                "X-Smriti-Secret": secret,
                "Content-Type": "application/json",
            }
            res_hook = await client.post(
                "/api/v1/databridge/webhooks/inbound/SHOPIFY_REST?tenant_id=smriti001",
                content=webhook_body,
                headers=hook_headers,
            )
            assert res_hook.status_code == 200, res_hook.text
            hook_data = res_hook.json()
            assert hook_data["status"] == "PROCESSED"
            assert hook_data["records_ingested"] == 1
            assert hook_data["entity_type"] == "ITEM"

            # 5. POST /api/v1/databridge/webhooks/outbound/dispatch (CDC Outbound Dispatch)
            outbound_req = {
                "webhook_url": "https://erp.enterprise.com/webhooks/cdc",
                "event_type": "SALES_INVOICE_CREATED",
                "payload": {"invoice_no": "INV-E2E-99", "amount": 2500.0},
                "secret": "SEC_OUTBOUND_TEST",
            }
            res_outbound = await client.post(
                "/api/v1/databridge/webhooks/outbound/dispatch",
                json=outbound_req,
                headers=auth_headers,
            )
            assert res_outbound.status_code == 200, res_outbound.text
            outbound_data = res_outbound.json()
            assert outbound_data["is_delivered"] is True
            assert outbound_data["status_code"] == 200
            assert outbound_data["signature"].startswith("sha256=")
    finally:
        app.dependency_overrides.clear()
