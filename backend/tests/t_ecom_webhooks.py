"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import base64
import hashlib
import hmac
import json
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings, Settings
from app.services.db_resolver import CompanyDatabaseResolver


@pytest.mark.asyncio
async def test_resolver_omits_credentials_and_connection_urls():
    """
    Verify CompanyDatabaseResolver never exposes credential-bearing connection URLs
    or database passwords in application payload (P0.2 exit requirement).
    """
    res = CompanyDatabaseResolver.resolve_company_database(
        user_id="sysadmin-test",
        company_id="COMP-001",
        company_code="001",
        user_role="SYSADMIN"
    )
    assert "connection_url" not in res, "connection_url must not be exposed by resolver"
    assert "password" not in res, "database password must not be exposed by resolver"
    assert res["database_name"] == "smriti001"
    assert res["database_status"] == "READY"
    assert res["company_id"] == "COMP-001"
    assert res["company_code"] == "001"


@pytest.mark.asyncio
async def test_ecom_webhook_ingress_requires_authentication():
    """
    Verify webhook ingress rejects unauthenticated calls (401 Unauthorized)
    when no service key, token, or HMAC signature is supplied.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Missing authentication
        payload = {
            "channel": "SHOPIFY",
            "event_type": "orders/create",
            "order_id": "ORD-UNAUTH-100",
            "payload": {"id": "ORD-UNAUTH-100"}
        }
        res = await client.post(
            "/api/v1/ecom/webhooks/ingress",
            json=payload,
            headers={"X-Company-ID": "COMP-001", "X-Company-Code": "001"}
        )
        assert res.status_code == 401, f"Expected 401 for unauthenticated webhook, got {res.status_code}"


@pytest.mark.asyncio
async def test_ecom_shopify_webhook_hmac_verification_and_idempotency():
    """
    Verify Shopify webhook ingress:
      1. Invalid HMAC is rejected with 401.
      2. Valid HMAC is accepted and processed.
      3. Replay of same order is acknowledged idempotently as DUPLICATE_IGNORED.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        order_payload = {
            "id": 99881122,
            "order_number": 99881122,
            "line_items": [
                {"sku": "SKU-NON-EXISTENT-TEST", "quantity": 1, "title": "Test Item"}
            ]
        }
        raw_body = json.dumps(order_payload).encode("utf-8")

        # 1. Invalid HMAC -> 401
        res_invalid = await client.post(
            "/api/v1/ecom/webhooks/shopify",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-001",
                "X-Company-Code": "001",
                "X-Shopify-Hmac-Sha256": "invalid_base64_hmac_signature"
            }
        )
        assert res_invalid.status_code == 401, f"Expected 401 for invalid HMAC, got {res_invalid.status_code}"

        # 2. Valid HMAC computed using internal service key -> 200 PROCESSED
        secret = settings.INTERNAL_SERVICE_KEY
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
        valid_hmac = base64.b64encode(digest).decode("utf-8")

        res_valid = await client.post(
            "/api/v1/ecom/webhooks/shopify",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-001",
                "X-Company-Code": "001",
                "X-Shopify-Hmac-Sha256": valid_hmac
            }
        )
        assert res_valid.status_code == 200, f"Expected 200 for valid HMAC, got {res_valid.status_code}"
        data = res_valid.json()
        assert data.get("success") is True
        assert data.get("status") in ("PROCESSED", "DUPLICATE_IGNORED")

        # 3. Replay of same payload -> 200 DUPLICATE_IGNORED
        res_replay = await client.post(
            "/api/v1/ecom/webhooks/shopify",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-001",
                "X-Company-Code": "001",
                "X-Shopify-Hmac-Sha256": valid_hmac
            }
        )
        assert res_replay.status_code == 200
        assert res_replay.json().get("status") == "DUPLICATE_IGNORED"


@pytest.mark.asyncio
async def test_ecom_woocommerce_webhook_signature_and_cross_company_denial():
    """
    Verify WooCommerce webhook:
      1. Invalid signature is rejected with 401.
      2. Non-existent/unauthorized company is rejected with 403.
      3. Valid signature is processed.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        wc_payload = {
            "id": 55443322,
            "line_items": [
                {"sku": "WC-ITEM-01", "quantity": 1, "name": "Woo Item"}
            ]
        }
        raw_body = json.dumps(wc_payload).encode("utf-8")

        # 1. Invalid signature -> 401
        res_bad_sig = await client.post(
            "/api/v1/ecom/webhooks/woocommerce",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-001",
                "X-Company-Code": "001",
                "X-WC-Webhook-Signature": "invalid_signature"
            }
        )
        assert res_bad_sig.status_code == 401

        # 2. Valid signature but non-existent company -> 403
        secret = settings.INTERNAL_SERVICE_KEY
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
        valid_sig = base64.b64encode(digest).decode("utf-8")

        res_unauth_company = await client.post(
            "/api/v1/ecom/webhooks/woocommerce",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-NON-EXISTENT-999",
                "X-Company-Code": "999",
                "X-WC-Webhook-Signature": valid_sig
            }
        )
        assert res_unauth_company.status_code == 403

        # 3. Valid signature and valid company -> 200
        res_valid = await client.post(
            "/api/v1/ecom/webhooks/woocommerce",
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Company-ID": "COMP-001",
                "X-Company-Code": "001",
                "X-WC-Webhook-Signature": valid_sig
            }
        )
        assert res_valid.status_code == 200
        assert res_valid.json().get("success") is True


def test_production_security_configuration_fails_closed():
    """
    Verify production security configuration fails closed if weak/dev default keys are used (P0.3).
    """
    from app.core.config import load_settings
    import os

    # In production, dev defaults MUST raise ValueError
    old_env = os.environ.get("ENVIRONMENT")
    old_jwt = os.environ.get("JWT_SECRET_KEY")
    try:
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "dev-test-jwt-secret-key-32-chars-long-smriti"
        with pytest.raises(ValueError) as exc:
            load_settings()
        assert "SECURITY FAULT" in str(exc.value)
    finally:
        if old_env:
            os.environ["ENVIRONMENT"] = old_env
        else:
            os.environ.pop("ENVIRONMENT", None)
        if old_jwt:
            os.environ["JWT_SECRET_KEY"] = old_jwt
        else:
            os.environ.pop("JWT_SECRET_KEY", None)
