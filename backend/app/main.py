"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version      : 3.31.0
Created      : 2026-07-11
Modified     : 2026-08-20
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import datetime
import time

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.compliance.api import router as compliance_router

from .api.v1 import (
    ai,
    api_keys,
    approvals,
    attributes,
    auth,
    assignments,
    barcode,
    changelog,
    crm,
    dev_tracker,
    docs,
    exchange,
    health_flags,
    inventory,
    master_lookup,
    masters,
    metadata,
    numbering,
    pos,
    product_identity,
    purchase,
    purchase_contracts,
    procurement_matching,
    procurement_rfq,
    procurement_bpa,
    procurement_requisition,
    procurement_qc,
    procurement_scorecard,
    replenishment,
    reports,
    roles,
    sales,
    sales_fulfillment,
    sales_invoicing,
    sales_return,
    security,
    stock_audit,
    stock_transfer,
    supplier_payment,
    system,
    terms,
    users,
    workflow,
    validation_policy,
    consignment,
    sre,
    dispatch,
    transfers,
    sip,
    communicator,
    screen_studio,
    offline_sync,
    diagnostics,
)

from .core.config import settings
from .core.constants import SMRITI_BANNER
from .core.error_handlers import register_error_handlers
from .core.logging import logger
from .db.session import verify_db_connectivity
from .middleware.request_logger import RequestLoggerMiddleware
from .middleware.request_context import RequestContextMiddleware

STARTUP_TIME = time.time()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """SMRITI startup: log banner, auto-seed DB, then yield for request handling."""
    print(SMRITI_BANNER)
    logger.info(f"[SMRITI] Starting FastAPI Python Core on port {settings.PORT}...")
    logger.info(f"[SMRITI] Mode: {settings.EDITION} | Version: {settings.VERSION}")

    # Auto-seed default users, roles, permissions and master data on every startup.
    # seed_default_users() is fully idempotent — safe to call repeatedly.
    # Wrapped in try/except so a cold-start before DB is ready doesn't abort the server.
    try:
        from app.db.seed import seed_default_users
        await seed_default_users()
        logger.info("[SMRITI] Database auto-seed completed successfully.")
    except Exception as _seed_err:
        logger.warning(
            f"[SMRITI] DB auto-seed skipped (DB may not be ready yet): {_seed_err}"
        )

    yield

# Initialize FastAPI instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    version=settings.VERSION,
    description="SMRITI Retail OS - Enterprise Python Core Backend Service",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Register RequestContextMiddleware for X-Request-ID tracing
app.add_middleware(RequestContextMiddleware)

# Register HREP error handlers
register_error_handlers(app)

# 1. Register CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Register Request Logger & ID Middleware
app.add_middleware(RequestLoggerMiddleware)

# 3. Register Versioned Router Endpoints
app.include_router(health_flags.router, prefix=settings.API_V1_STR + "/health",    tags=["Health"])
app.include_router(workflow.router,     prefix=settings.API_V1_STR + "/workflow",  tags=["Workflow"])  # AD-3: Core Workflow
app.include_router(metadata.router,     prefix=settings.API_V1_STR)
app.include_router(changelog.router, prefix=settings.API_V1_STR)
app.include_router(dev_tracker.router, prefix=settings.API_V1_STR)
app.include_router(auth.router,      prefix=settings.API_V1_STR + "/auth",          tags=["Authentication"])
app.include_router(users.router,     prefix=settings.API_V1_STR + "/users",         tags=["User Management"])
app.include_router(inventory.router, prefix=settings.API_V1_STR + "/inventory",      tags=["Inventory"])  # Canonical route
app.include_router(crm.router,       prefix=settings.API_V1_STR,                    tags=["CRM"])
app.include_router(sales.router,     prefix=settings.API_V1_STR + "/sales",          tags=["Sales"])         # Canonical route (Phase 4A)
app.include_router(sales_fulfillment.router, prefix=settings.API_V1_STR,                 tags=["Sales Orders & Outbound Fulfillment"])
app.include_router(sales_invoicing.router, prefix=settings.API_V1_STR,                    tags=["Sales Invoicing & Payment Settlement"])
app.include_router(sales_return.router, prefix=settings.API_V1_STR,                       tags=["Sales Returns & Credit Notes"])
app.include_router(stock_audit.router, prefix=settings.API_V1_STR,                        tags=["Inventory Physical Audit & Cycle Counting"])
app.include_router(stock_transfer.router, prefix=settings.API_V1_STR,                     tags=["Inter-Branch Stock Transfers"])
app.include_router(replenishment.router, prefix=settings.API_V1_STR,                        tags=["Automated Warehouse Replenishment"])
app.include_router(purchase.router,  prefix=settings.API_V1_STR,                    tags=["Purchase-Legacy"])  # Root mount: /api/v1/suppliers/, /api/v1/purchase-receipts/ — retain until test suite migrated to /api/v1/purchase/*
app.include_router(purchase.router,  prefix=settings.API_V1_STR + "/purchase",      tags=["Purchase"])         # Canonical route (Phase 4A)
app.include_router(purchase_contracts.router, prefix=settings.API_V1_STR,            tags=["Purchase Contracts"])
app.include_router(procurement_matching.router, prefix=settings.API_V1_STR,           tags=["Procurement Matching & Valuation"])
app.include_router(procurement_rfq.router, prefix=settings.API_V1_STR,                tags=["Procurement RFQ & Bidding"])
app.include_router(procurement_bpa.router, prefix=settings.API_V1_STR,                tags=["Procurement Blanket Purchase Agreements"])
app.include_router(procurement_requisition.router, prefix=settings.API_V1_STR,        tags=["Procurement Purchase Requisitions"])
app.include_router(procurement_qc.router, prefix=settings.API_V1_STR,                 tags=["Procurement Quality Control & Debit Notes"])
app.include_router(procurement_scorecard.router, prefix=settings.API_V1_STR,          tags=["Procurement Supplier Performance Scorecards"])
app.include_router(pos.router,              prefix=settings.API_V1_STR,                    tags=["POS Shift"])
app.include_router(supplier_payment.router, prefix=settings.API_V1_STR,                    tags=["Supplier Payments"])
app.include_router(reports.router,          prefix=settings.API_V1_STR,                    tags=["Reports"])
app.include_router(master_lookup.router,    prefix=settings.API_V1_STR + "/masters",       tags=["Masters"])
app.include_router(masters.router,          prefix=settings.API_V1_STR + "/masters",       tags=["Masters"])
app.include_router(assignments.router,      prefix=settings.API_V1_STR,                      tags=["Assignments"])
app.include_router(numbering.router,        prefix=settings.API_V1_STR + "/numbering",     tags=["Numbering Engine"])
app.include_router(terms.router,            prefix=settings.API_V1_STR + "/terms",         tags=["Terms & Conditions"])
app.include_router(attributes.router,       prefix=settings.API_V1_STR + "/attributes",    tags=["Attributes & Variants"])  # noqa: E501
app.include_router(barcode.router,          prefix=settings.API_V1_STR + "/barcode",       tags=["Barcode Studio"])
app.include_router(product_identity.router, prefix=settings.API_V1_STR + "/product-identity", tags=["Product Identity Engine"])
app.include_router(exchange.router,         prefix=settings.API_V1_STR + "/exchange",      tags=["Data Exchange Hub"])
app.include_router(ai.router,               prefix=settings.API_V1_STR + "/ai",            tags=["AI Assistant"])
app.include_router(docs.router,             prefix=settings.API_V1_STR + "/docs",          tags=["Documentation"])
app.include_router(approvals.router,        prefix=settings.API_V1_STR,                    tags=["Approvals"])
app.include_router(api_keys.router,         prefix=settings.API_V1_STR + "/api-keys",     tags=["API Keys Management"])
app.include_router(system.router,           prefix=settings.API_V1_STR,                     tags=["System"])
app.include_router(roles.router,            prefix=settings.API_V1_STR + "/roles",         tags=["Role Matrix"])
app.include_router(security.router,         prefix=settings.API_V1_STR + "/security",      tags=["Security Engine"])
app.include_router(compliance_router,       prefix=settings.API_V1_STR)
app.include_router(consignment.router,       prefix=settings.API_V1_STR + "/consignment", tags=["Consignment"])
app.include_router(sre.router,               prefix=settings.API_V1_STR + "/sre",         tags=["SMRITI Regulatory Engine"])
app.include_router(dispatch.router,          prefix=settings.API_V1_STR + "/dispatch",    tags=["Stock Dispatch Engine"])
app.include_router(transfers.router,         prefix=settings.API_V1_STR,                    tags=["Stock Transfers & Rebalancing"])
app.include_router(sip.router,               prefix=settings.API_V1_STR,                    tags=["SMRITI Identity Platform (SIP)"])
app.include_router(communicator.router,      prefix=settings.API_V1_STR,                    tags=["SMRITI Communicator Sync Gateway"])
app.include_router(screen_studio.router,     prefix=settings.API_V1_STR,                    tags=["SMRITI Screen Studio Metadata Engine"])
app.include_router(offline_sync.router,      prefix=settings.API_V1_STR,                    tags=["Offline POS Queue Sync Engine"])
app.include_router(diagnostics.router,       prefix=settings.API_V1_STR,                    tags=["SMRITI Operational Observability & Telemetry Engine"])
app.include_router(validation_policy.router, prefix=settings.API_V1_STR,                    tags=["Platform Validation Engine (PVE)"])




# 4. Standard Health Diagnostics Endpoints
@app.get("/health", tags=["Health Diagnostics"])
async def health_check():
    """
    Perform deep health audit asserting database and service connectivity pool status.
    """
    db_ok = await verify_db_connectivity()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "service": "operational"
    }

@app.get("/ready", tags=["Health Diagnostics"])
async def readiness_check():
    """
    Verify if the API framework service is ready to receive requests.
    """
    return {"status": "ready"}

@app.get("/live", tags=["Health Diagnostics"])
async def liveness_check():
    """
    Assert that the API backend process is alive.
    """
    return {"status": "alive"}

@app.get("/version", tags=["Health Diagnostics"])
async def version_check():
    """
    Fetch SMRITI core build specification version.
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "edition": settings.EDITION
    }

@app.get("/metrics", tags=["Health Diagnostics"])
async def metrics_check():
    """
    Expose basic diagnostic metrics.
    """
    return {
        "requests_total": 0,  # Can bind to prometheus client
        "active_connections": 1
    }

@app.get("/", include_in_schema=False)
async def root_landing_page(request: Request):
    db_ok = await verify_db_connectivity()
    db_status = "connected" if db_ok else "disconnected"
    
    uptime_seconds = int(time.time() - STARTUP_TIME)
    uptime = str(datetime.timedelta(seconds=uptime_seconds))
    
    router_count = len(app.routes)
    
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        from .core.error_handlers import templates
        return templates.TemplateResponse(
            request=request,
            name="errors/landing.html",
            context={
                "db_status": db_status,
                "uptime": uptime,
                "router_count": router_count,
                "env": settings.ENVIRONMENT,
                "edition": settings.EDITION,
                "version": settings.VERSION,
            }
        )
        
    return JSONResponse(content={
        "product": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "edition": settings.EDITION,
        "environment": settings.ENVIRONMENT,
        "api_status": "healthy",
        "database_status": db_status,
        "uptime": uptime,
        "mounted_routes": router_count,
        "documentation": "/docs"
    })



