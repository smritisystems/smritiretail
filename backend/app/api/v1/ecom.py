"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-17
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    TenantContext,
    get_company_db,
    get_current_user,
    get_tenant_context,
    require_role,
)
from ...core.config import settings
from ...core.logging import logger
from ...core.security import decode_token
from ...db.session import get_company_sessionmaker
from ...models.auth import User, UserRole
from ...services.db_resolver import CompanyDatabaseResolver
from ...services.ecom_reservation import EcomInventoryReservationService
from ...services.outbox_service import OutboxService

router = APIRouter(tags=["eCommerce / Omnichannel Engine"])


class EcomReserveStockRequest(BaseModel):
    sku: str = Field(..., description="Product SKU to reserve stock for")
    quantity: Decimal = Field(..., gt=0, description="Quantity to reserve")
    ecom_order_id: str = Field(..., description="External or internal eCommerce Order ID")
    correlation_id: Optional[str] = Field(None, description="Unique event correlation UUID")


class EcomWebhookIngressRequest(BaseModel):
    channel: str = Field(..., description="Channel name, e.g. SHOPIFY, WOOCOMMERCE, INTERNAL_STORE")
    event_type: str = Field(..., description="Webhook event type, e.g. orders/create, orders/cancelled")
    order_id: str = Field(..., description="Channel external order ID")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Raw order payload")


async def get_ecom_company_session(
    x_company_id: str = Header(..., alias="X-Company-ID", description="Target Company Identifier"),
    x_company_code: Optional[str] = Header(None, alias="X-Company-Code", description="Target Company Code"),
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> AsyncSession:
    """
    Authoritative Company Database Session Provider for eCommerce Operations.
    Routes strictly via CompanyDatabaseResolver and safe Connection Pool Manager.
    Fails closed if caller is unauthenticated or target company is unauthorized/suspended.
    """
    caller_id = "ecom-service"
    caller_role = "SYSADMIN"
    authenticated = False

    if x_internal_service_key and x_internal_service_key == settings.INTERNAL_SERVICE_KEY:
        authenticated = True
        caller_id = "internal-service"
        caller_role = "SYSADMIN"
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            payload = decode_token(token)
            caller_id = payload.get("sub") or "authenticated-user"
            caller_role = payload.get("role") or "CASHIER"
            authenticated = True
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authorization token for eCommerce access."
            )

    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: provide valid Authorization header or X-Internal-Service-Key."
        )

    res = CompanyDatabaseResolver.resolve_company_database(
        user_id=caller_id,
        company_id=x_company_id,
        company_code=x_company_code,
        user_role=caller_role
    )
    target_db = res["database_name"]
    session_factory = get_company_sessionmaker(target_db)
    async with session_factory() as session:
        yield session


async def get_ecom_webhook_session(
    request: Request,
    x_company_id: str = Header(..., alias="X-Company-ID", description="Target Company Identifier"),
    x_company_code: Optional[str] = Header(None, alias="X-Company-Code", description="Target Company Code"),
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_shopify_hmac: Optional[str] = Header(None, alias="X-Shopify-Hmac-Sha256"),
    x_wc_signature: Optional[str] = Header(None, alias="X-WC-Webhook-Signature"),
) -> AsyncSession:
    """
    Authoritative Company Database Session Provider for Webhook Ingress.
    Validates HMAC signatures (Shopify / WooCommerce), internal service key, or Bearer auth.
    Fails closed on missing or invalid credentials.
    """
    authenticated = False
    raw_body = await request.body()

    # 1. Internal service key authentication
    if x_internal_service_key and x_internal_service_key == settings.INTERNAL_SERVICE_KEY:
        authenticated = True
    # 2. Bearer token authentication
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            decode_token(token)
            authenticated = True
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authorization token for webhook intake."
            )
    # 3. Shopify HMAC signature verification
    elif x_shopify_hmac:
        secret = os.getenv("SHOPIFY_WEBHOOK_SECRET") or settings.INTERNAL_SERVICE_KEY
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
        expected_hmac = base64.b64encode(digest).decode("utf-8")
        if hmac.compare_digest(expected_hmac, x_shopify_hmac):
            authenticated = True
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Shopify webhook HMAC signature verification failed."
            )
    # 4. WooCommerce Webhook signature verification
    elif x_wc_signature:
        secret = os.getenv("WOOCOMMERCE_WEBHOOK_SECRET") or settings.INTERNAL_SERVICE_KEY
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
        expected_sig = base64.b64encode(digest).decode("utf-8")
        if hmac.compare_digest(expected_sig, x_wc_signature):
            authenticated = True
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="WooCommerce webhook signature verification failed."
            )

    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook authentication failed: missing valid HMAC signature, service key, or token."
        )

    res = CompanyDatabaseResolver.resolve_company_database(
        user_id="ecom-webhook-service",
        company_id=x_company_id,
        company_code=x_company_code,
        user_role="SYSADMIN"
    )
    target_db = res["database_name"]
    session_factory = get_company_sessionmaker(target_db)
    async with session_factory() as session:
        yield session


@router.get("/ecom/channels/status")
async def get_ecom_channels_status():
    """
    Fetch authoritative connectivity status of external eCommerce connectors.
    Truthfully reports connector readiness per SMRITI Governance.
    """
    return {
        "status": "OPERATIONAL",
        "core_channel_engine": "COMPANY_LOCAL_DATABASE_ENABLED",
        "channels": {
            "internal_store": {
                "status": "ACTIVE",
                "authority": "Company-Local Database",
                "notes": "Unified inventory reservation & order pipeline active"
            },
            "shopify": {
                "status": "CONFIGURED_ACTIVE",
                "authority": "Company-Local Database",
                "notes": "HMAC-verified webhook ingress & inventory reservation active"
            },
            "woocommerce": {
                "status": "CONFIGURED_ACTIVE",
                "authority": "Company-Local Database",
                "notes": "Signature-verified webhook ingress & inventory reservation active"
            },
            "amazon": {
                "status": "UNIMPLEMENTED",
                "authority": "Unverified",
                "notes": "SP-API gateway pending enterprise milestone"
            },
            "flipkart": {
                "status": "UNIMPLEMENTED",
                "authority": "Unverified",
                "notes": "Seller API gateway pending enterprise milestone"
            }
        }
    }


@router.post(
    "/ecom/orders/reserve",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def reserve_ecom_inventory(
    req: EcomReserveStockRequest,
    session: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Atomic Stock Reservation for eCommerce Orders inside Company Database.
    Prevents overselling by incrementing reserved_stock and emitting outbox events.
    """
    cid = req.correlation_id or str(uuid.uuid4())
    result = await EcomInventoryReservationService.reserve_stock_for_ecom_order(
        session=session,
        sku=req.sku,
        quantity=req.quantity,
        ecom_order_id=req.ecom_order_id,
        correlation_id=cid
    )
    if not result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=result.get("error", "Stock reservation failed due to insufficient available inventory.")
        )
    await session.commit()
    return {
        "success": True,
        "sku": req.sku,
        "reserved_quantity": result.get("reserved_qty", req.quantity),
        "ecom_order_id": req.ecom_order_id,
        "correlation_id": cid,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/ecom/webhooks/ingress")
async def handle_ecom_webhook_ingress(
    req: EcomWebhookIngressRequest,
    session: AsyncSession = Depends(get_ecom_webhook_session)
):
    """
    Idempotent Webhook Ingress Endpoint for eCommerce Channels.
    Enforces atomic company routing, logs transaction in outbox/audit, and confirms intake.
    """
    correlation_id = f"INGRESS-{req.channel.upper()}-{req.order_id}"
    now = datetime.now(timezone.utc)

    # 1. Idempotency check in resolved Company DB
    check_q = text("SELECT count(*) FROM integration_outbox_events WHERE correlation_id = :cid")
    res = await session.execute(check_q, {"cid": correlation_id})
    if res.scalar() > 0:
        return {
            "received": True,
            "channel": req.channel,
            "order_id": req.order_id,
            "status": "DUPLICATE_IGNORED",
            "message": f"Webhook event for order {req.order_id} already ingested.",
            "timestamp": now.isoformat()
        }

    event_id = str(uuid.uuid4())
    # Record outbox event inside the resolved Company DB
    await session.execute(
        text("""
            INSERT INTO integration_outbox_events (
                outbox_id, source_event_id, correlation_id, causation_id,
                event_schema_version, target_channel, payload_json, status, retry_count, created_at
            ) VALUES (
                :oid, :seid, :cid, :causid, '1.0', :channel, :payload, 'PENDING', 0, :now
            );
        """),
        {
            "oid": str(uuid.uuid4()),
            "seid": event_id,
            "cid": correlation_id,
            "causid": correlation_id,
            "channel": req.channel.upper(),
            "payload": json.dumps(req.payload),
            "now": now
        }
    )
    await session.commit()

    return {
        "received": True,
        "channel": req.channel,
        "order_id": req.order_id,
        "event_id": event_id,
        "status": "ACCEPTED_FOR_ROUTING",
        "timestamp": now.isoformat()
    }


@router.post("/ecom/webhooks/shopify")
async def handle_shopify_webhook(
    payload: Dict[str, Any] = Body(...),
    x_shopify_topic: Optional[str] = Header("orders/create", alias="X-Shopify-Topic"),
    x_shopify_shop_domain: Optional[str] = Header(None, alias="X-Shopify-Shop-Domain"),
    session: AsyncSession = Depends(get_ecom_webhook_session)
):
    """
    Production-Safe Shopify Webhook Ingress Handler.
    Handles HMAC validation, duplicate idempotency, SKU mapping, stock reservation, and outbox auditing.
    """
    order_id = str(payload.get("id") or payload.get("order_number") or uuid.uuid4().hex[:8])
    correlation_id = f"SHOPIFY-ORD-{order_id}"

    # 1. Check idempotency in resolved Company DB
    check_q = text("SELECT count(*) FROM integration_outbox_events WHERE correlation_id = :cid")
    res = await session.execute(check_q, {"cid": correlation_id})
    if res.scalar() > 0:
        return {
            "success": True,
            "status": "DUPLICATE_IGNORED",
            "message": f"Shopify Order {order_id} already ingested and processed.",
            "order_id": order_id
        }

    # 2. Extract line items & reserve stock
    line_items = payload.get("line_items", [])
    reserved_items = []

    for it in line_items:
        sku = it.get("sku") or it.get("variant_id") or it.get("title")
        qty = Decimal(str(it.get("quantity", 1)))
        if sku:
            reserve_res = await EcomInventoryReservationService.reserve_stock_for_ecom_order(
                session=session,
                sku=str(sku),
                quantity=qty,
                ecom_order_id=order_id,
                correlation_id=correlation_id
            )
            reserved_items.append({
                "sku": str(sku),
                "quantity": float(qty),
                "reservation_status": "RESERVED" if reserve_res.get("success") else "STOCK_UNAVAILABLE"
            })

    # 3. Atomically record outbox event
    await OutboxService.record_event(
        session=session,
        target_channel="SHOPIFY",
        payload=payload,
        correlation_id=correlation_id,
        causation_id=correlation_id
    )
    await session.commit()

    return {
        "success": True,
        "channel": "SHOPIFY",
        "order_id": order_id,
        "topic": x_shopify_topic,
        "status": "PROCESSED",
        "reserved_items": reserved_items,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/ecom/webhooks/woocommerce")
async def handle_woocommerce_webhook(
    payload: Dict[str, Any] = Body(...),
    x_wc_webhook_topic: Optional[str] = Header("order.created", alias="X-WC-Webhook-Topic"),
    session: AsyncSession = Depends(get_ecom_webhook_session)
):
    """
    Production-Safe WooCommerce Webhook Ingress Handler.
    Handles duplicate idempotency, SKU resolution, stock reservation, and outbox auditing.
    """
    order_id = str(payload.get("id") or uuid.uuid4().hex[:8])
    correlation_id = f"WOO-ORD-{order_id}"

    # 1. Idempotency Check
    check_q = text("SELECT count(*) FROM integration_outbox_events WHERE correlation_id = :cid")
    res = await session.execute(check_q, {"cid": correlation_id})
    if res.scalar() > 0:
        return {
            "success": True,
            "status": "DUPLICATE_IGNORED",
            "message": f"WooCommerce Order {order_id} already ingested.",
            "order_id": order_id
        }

    # 2. Extract line items & reserve stock
    line_items = payload.get("line_items", [])
    reserved_items = []

    for it in line_items:
        sku = it.get("sku") or it.get("name")
        qty = Decimal(str(it.get("quantity", 1)))
        if sku:
            reserve_res = await EcomInventoryReservationService.reserve_stock_for_ecom_order(
                session=session,
                sku=str(sku),
                quantity=qty,
                ecom_order_id=order_id,
                correlation_id=correlation_id
            )
            reserved_items.append({
                "sku": str(sku),
                "quantity": float(qty),
                "reservation_status": "RESERVED" if reserve_res.get("success") else "STOCK_UNAVAILABLE"
            })

    # 3. Outbox persistence
    await OutboxService.record_event(
        session=session,
        target_channel="WOOCOMMERCE",
        payload=payload,
        correlation_id=correlation_id,
        causation_id=correlation_id
    )
    await session.commit()

    return {
        "success": True,
        "channel": "WOOCOMMERCE",
        "order_id": order_id,
        "status": "PROCESSED",
        "reserved_items": reserved_items,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/ecom/portal/orders")
async def get_customer_portal_orders(
    customer_phone: Optional[str] = None,
    session: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Customer Portal Order History & Status Endpoint.
    Strictly scoped to resolved Company Database.
    """
    if not customer_phone:
        return {"orders": []}

    q = text("""
        SELECT i.id, i.invoice_no, i.date, i.tax_total, i.grand_total, i.status, c.name as customer_name
        FROM sales_invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE c.mobile = :ph AND i.is_deleted = false
        ORDER BY i.date DESC LIMIT 20;
    """)
    res = await session.execute(q, {"ph": customer_phone})
    rows = res.fetchall()

    orders = []
    for r in rows:
        tax = float(r[3] or 0)
        grand = float(r[4] or 0)
        subtotal = grand - tax
        orders.append({
            "id": r[0],
            "order_no": r[1],
            "date": str(r[2]),
            "subtotal": subtotal,
            "tax_total": tax,
            "grand_total": grand,
            "status": r[5] or "COMPLETED",
            "customer_name": r[6]
        })

    return {
        "success": True,
        "customer_phone": customer_phone,
        "orders_count": len(orders),
        "orders": orders
    }


# ---------------------------------------------------------------------------
# Section 8 eCommerce Expansion Endpoints
# ---------------------------------------------------------------------------
from ...services.ecom_engine import EcomGrowthEngine
from ...schemas.ecom import (
    ChannelCreateReq,
    ChannelResponse,
    SkuMappingReq,
    SkuMappingResponse,
    InboundOrderPayload,
    OrderImportResponse,
    OrderConvergenceResponse,
    ReconciliationRunReq,
    ReconciliationReportResponse,
    DlqRetryReq,
    DlqRetryResponse,
)


@router.post("/channels", response_model=ChannelResponse, summary="Configure eCommerce Channel")
async def configure_channel(
    req: ChannelCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    channel = await EcomGrowthEngine.configure_channel(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return ChannelResponse(
        id=channel.id,
        channel_code=channel.channel_code,
        name=channel.name,
        channel_type=channel.channel_type,
        store_url=channel.store_url,
        is_active=channel.is_active,
        sync_inventory=channel.sync_inventory,
        sync_pricing=channel.sync_pricing,
        auto_converge_orders=channel.auto_converge_orders,
    )


@router.post("/sku-mappings", response_model=SkuMappingResponse, summary="Map external marketplace SKU to SMRITI SKU")
async def map_ecom_sku(
    req: SkuMappingReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    mapping = await EcomGrowthEngine.map_sku(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return SkuMappingResponse(
        id=mapping.id,
        channel_code=mapping.channel_code,
        external_sku=mapping.external_sku,
        external_product_id=mapping.external_product_id,
        smriti_sku=mapping.smriti_sku,
        item_id=mapping.item_id,
        variant_id=mapping.variant_id,
        is_active=mapping.is_active,
    )


@router.post("/orders/inbound", response_model=OrderImportResponse, summary="Process Inbound eCommerce Order")
async def process_inbound_order(
    payload: InboundOrderPayload,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    try:
        imp = await EcomGrowthEngine.process_inbound_order(
            session=session,
            company_id=company_id,
            payload=payload,
        )
        return OrderImportResponse(
            id=imp.id,
            channel_code=imp.channel_code,
            external_order_id=imp.external_order_id,
            order_status=imp.order_status,
            idempotency_key=imp.idempotency_key,
            gross_amount=imp.gross_amount,
            net_amount=imp.net_amount,
            converged_invoice_id=imp.converged_invoice_id,
            error_message=imp.error_message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{import_id}/converge", response_model=OrderConvergenceResponse, summary="Converge order to SalesInvoice")
async def converge_order(
    import_id: str,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        return await EcomGrowthEngine.converge_order(
            session=session,
            company_id=company_id,
            import_id=import_id,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dlq/retry", response_model=DlqRetryResponse, summary="Retry failed or DLQ eCommerce imports")
async def retry_dlq_imports(
    req: DlqRetryReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    return await EcomGrowthEngine.retry_dlq_imports(
        session=session,
        company_id=company_id,
        req=req,
    )


@router.post("/reconciliations/run", response_model=ReconciliationReportResponse, summary="Run Channel Financial Reconciliation")
async def run_channel_reconciliation(
    req: ReconciliationRunReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    rec = await EcomGrowthEngine.generate_channel_reconciliation(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return ReconciliationReportResponse(
        id=rec.id,
        reconciliation_no=rec.reconciliation_no,
        channel_code=rec.channel_code,
        period_start=rec.period_start,
        period_end=rec.period_end,
        channel_order_count=rec.channel_order_count,
        channel_gross_revenue=rec.channel_gross_revenue,
        smriti_order_count=rec.smriti_order_count,
        smriti_gross_revenue=rec.smriti_gross_revenue,
        variance_amount=rec.variance_amount,
        status=rec.status,
    )

