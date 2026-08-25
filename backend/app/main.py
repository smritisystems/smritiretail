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

* Version    : 3.22.0
Created      : 2026-07-11
Modified     : 2026-08-23
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
    accounting,
    ai,
    analytics,
    approval,
    approval_matrix,
    attributes,
    auth,
    assignments,
    barcode,
    barcodes,
    boundaries,
    capability_registry,
    cge,
    changelog,
    company_center,
    crm,
    crm_reports,
    database_manager,
    dev_tracker,
    distribution,
    docs,
    documents,
    ecom,
    exchange,
    finance,
    fulfillment,
    governance,
    governed_logic,
    health_flags,
    integration,
    inventory,
    inventory_reports,
    legacy_menu_map,
    localization,
    master_lookup,
    masters,
    menus,
    metadata,
    numbering,
    pos,
    physical_stock,
    payments,
    pricing,
    product_identity,
    promotions,
    purchase,
    reference_data,
    reports,
    roles,
    sales,
    sales_reports,
    search,
    security,
    staff,
    supplier_payment,
    sync,
    system,
    terms,
    training,
    ui_control_plane,
    universal_master,
    users,
    wms,
    workflow,
    workspace_ui,
)
from .core.config import settings
from .core.constants import SMRITI_BANNER
from .core.error_handlers import register_error_handlers
from .core.logging import logger
from .db.session import verify_db_connectivity
from .middleware.request_logger import RequestLoggerMiddleware

STARTUP_TIME = time.time()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """SMRITI startup: log banner. Yield for request handling. Shutdown is a no-op."""
    print(SMRITI_BANNER)
    logger.info(f"[SMRITI] Starting FastAPI Python Core on port {settings.PORT}...")
    logger.info(f"[SMRITI] Mode: {settings.EDITION} | Version: {settings.VERSION}")
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
app.include_router(inventory.router,         prefix=settings.API_V1_STR + "/inventory",          tags=["Inventory"])
app.include_router(inventory.router,         prefix=settings.API_V1_STR + "/products",           tags=["Inventory"])
app.include_router(inventory.router,         prefix=settings.API_V1_STR + "/inventory/products", tags=["Inventory"])
app.include_router(inventory_reports.router, prefix=settings.API_V1_STR,                          tags=["Inventory Reports"])
app.include_router(crm.router,          prefix=settings.API_V1_STR,           tags=["CRM"])
app.include_router(crm.router,          prefix=settings.API_V1_STR + "/crm",  tags=["CRM"])
app.include_router(crm_reports.router,  prefix=settings.API_V1_STR,           tags=["CRM Reports"])
app.include_router(staff.router,        prefix=settings.API_V1_STR,           tags=["Staff Management"])
app.include_router(sales.router,         prefix=settings.API_V1_STR + "/sales-invoices", tags=["Sales-Legacy"])  # Deprecated -- remove at v3.20.0
app.include_router(sales.router,         prefix=settings.API_V1_STR + "/sales",          tags=["Sales"])         # Contract URL (Phase 4A)
app.include_router(sales.router,         prefix=settings.API_V1_STR + "/tattly",         tags=["Tattly Invoices"])
app.include_router(sales_reports.router, prefix=settings.API_V1_STR,                     tags=["Sales Reports"])
app.include_router(purchase.router,  prefix=settings.API_V1_STR,                    tags=["Purchase-Legacy"])  # Deprecated — remove at v3.20.0
app.include_router(purchase.router,  prefix=settings.API_V1_STR + "/purchase",      tags=["Purchase"])         # Contract URL (Phase 4A)
app.include_router(pos.router,            prefix=settings.API_V1_STR,           tags=["POS Shift"])
app.include_router(physical_stock.router, prefix=settings.API_V1_STR,           tags=["Physical Stock"])
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
app.include_router(system.router,           prefix=settings.API_V1_STR,                     tags=["System"])
app.include_router(roles.router,            prefix=settings.API_V1_STR + "/roles",         tags=["Role Matrix"])
app.include_router(menus.router,            prefix=settings.API_V1_STR + "/menus",         tags=["Menu Governance"])
app.include_router(security.router,         prefix=settings.API_V1_STR + "/security",      tags=["Security Management"])
app.include_router(ui_control_plane.router, prefix=settings.API_V1_STR + "/ui",            tags=["UI Control Plane"])
app.include_router(workspace_ui.router,      prefix=settings.API_V1_STR)
app.include_router(training.router,         prefix=settings.API_V1_STR,                     tags=["Training Academy"])
app.include_router(ecom.router,             prefix=settings.API_V1_STR,                     tags=["eCommerce / Omnichannel Engine"])
app.include_router(company_center.router, prefix=settings.API_V1_STR, tags=["Company Control Center"])
app.include_router(database_manager.router,       prefix=settings.API_V1_STR + "/database-manager", tags=["Database Manager"])
app.include_router(compliance_router,       prefix=settings.API_V1_STR)
app.include_router(approval_matrix.router,  prefix=settings.API_V1_STR + "/approval-matrix", tags=["Approval Matrix"])
app.include_router(wms.router,              prefix=settings.API_V1_STR + "/wms", tags=["Warehouse & Batch Management"])
app.include_router(accounting.router,       prefix=settings.API_V1_STR + "/accounting", tags=["Authoritative Accounting"])
app.include_router(finance.router,          prefix=settings.API_V1_STR + "/finance",     tags=["Finance & Cash Reports"])
app.include_router(governance.router,       prefix=settings.API_V1_STR + "/governance",  tags=["Governance & System Config"])
app.include_router(reference_data.router,    prefix=settings.API_V1_STR, tags=["Global Reference Data & Localization"])
app.include_router(localization.router,      prefix=settings.API_V1_STR)
app.include_router(capability_registry.router, prefix=settings.API_V1_STR, tags=["Capability & Module Registry"])
app.include_router(governed_logic.router, prefix=settings.API_V1_STR + "/governed-logic", tags=["Governed Logic & Reproducibility"])
app.include_router(universal_master.router, prefix=settings.API_V1_STR + "/universal", tags=["Universal Party & Item Master"])
app.include_router(boundaries.router, prefix=settings.API_V1_STR + "/boundaries", tags=["Stock & Accounting Boundaries"])
app.include_router(pricing.router, prefix=settings.API_V1_STR + "/pricing", tags=["Pricing Engine"])
app.include_router(promotions.router, prefix=settings.API_V1_STR + "/promotions", tags=["Promotions & Offers Engine"])
app.include_router(payments.router, prefix=settings.API_V1_STR + "/payments", tags=["Payments Engine"])
app.include_router(documents.router, prefix=settings.API_V1_STR + "/documents", tags=["Documents Engine"])
app.include_router(fulfillment.router, prefix=settings.API_V1_STR + "/fulfillment", tags=["Fulfillment Engine"])
app.include_router(barcodes.router, prefix=settings.API_V1_STR + "/barcodes", tags=["Barcode & Labels Engine"])
app.include_router(approval.router, prefix=settings.API_V1_STR + "/approval", tags=["Approval Matrix Engine"])
app.include_router(search.router, prefix=settings.API_V1_STR + "/search", tags=["Universal Search Engine"])
app.include_router(distribution.router, prefix=settings.API_V1_STR + "/distribution", tags=["Distribution Core"])
app.include_router(cge.router, prefix=settings.API_V1_STR + "/cge", tags=["Commercial Growth Engine & PDT"])
app.include_router(sync.router, prefix=settings.API_V1_STR + "/sync", tags=["Offline-First Synchronization"])
app.include_router(analytics.router, prefix=settings.API_V1_STR + "/analytics", tags=["Analytics & Intelligence Plane"])
app.include_router(integration.router, prefix=settings.API_V1_STR + "/integration", tags=["Integration Hub & Audit"])
app.include_router(legacy_menu_map.router, prefix=settings.API_V1_STR + "/legacy-menu-map", tags=["Legacy Migration Registry"])  # Sprint 2/3: read-only Shoper9->SMRITI lineage




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


# Production static-file serving & SPA fallback mount
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_workspace_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_dist_dir = os.path.join(_workspace_root, "dist")
if os.path.exists(_dist_dir):
    _assets_dir = os.path.join(_dist_dir, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static_assets")

    @app.get("/app/{full_path:path}", include_in_schema=False)
    @app.get("/ui/{full_path:path}", include_in_schema=False)
    async def serve_spa_frontend(full_path: str = ""):
        target_file = os.path.join(_dist_dir, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(_dist_dir, "index.html"))




