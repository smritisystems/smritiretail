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

import sys
import os
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
    barcode_registry,
    billing_csv,
    barcodes,
    boundaries,
    capability_registry,
    cge,
    changelog,
    communicator,
    company_center,
    crm,
    crm_cge,
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
    pdt,
    pricing,
    product_identity,
    promotions,
    psv,
    purchase,
    reference_data,
    reporting_governance,
    reports,
    roles,
    sales,
    sales_reports,
    scheduled_reports,
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
    universal_import,
    users,
    vendor,
    wms,
    workflow,
    workspace_ui,
    cge_unified,
    system_parameters,
)
from .core.config import settings
from .core.constants import SMRITI_BANNER
from .core.error_handlers import register_error_handlers
from .core.logging import logger
from .db.session import verify_db_connectivity
from .middleware.request_logger import RequestLoggerMiddleware
from .middleware.rate_limiter import limiter, SLOWAPI_AVAILABLE
if SLOWAPI_AVAILABLE:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

STARTUP_TIME = time.time()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """SMRITI startup: log banner and ensure baseline users and company registries are seeded."""
    print(SMRITI_BANNER)
    logger.info(f"[SMRITI] Starting FastAPI Python Core on port {settings.PORT}...")
    logger.info(f"[SMRITI] Mode: {settings.EDITION} | Version: {settings.VERSION}")
    
    # Auto-seed baseline users and company registries idempotently on container startup
    if "pytest" not in sys.modules and not os.environ.get("PYTEST_CURRENT_TEST"):
        try:
            from .db.seed_baseline_users import seed as seed_baseline_users
            await seed_baseline_users()
            logger.info("[SMRITI Startup] Baseline users, companies, and database registries verified/seeded successfully.")
        except Exception as e:
            logger.warning(f"[SMRITI Startup] Notice during baseline user auto-seeding: {e}")

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Company-ID",
        "X-Branch-ID",
        "X-Company-Code",
        "X-Tenant-ID",
        "X-Request-ID",
    ],
)

# 2. Register Request Logger & ID Middleware
app.add_middleware(RequestLoggerMiddleware)

# 3. Register Rate Limiting Middleware (slowapi — tenant-scoped, 300/min default)
app.state.limiter = limiter
if SLOWAPI_AVAILABLE:
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)


# ============================================================
# 4. SMRITI Router Registry (Data-Driven Mounting)
# ============================================================
# Format: (router_module, prefix_suffix, tags, [deprecated])
# Prefix suffix is appended to settings.API_V1_STR
# ============================================================
_ROUTER_REGISTRY = [
    # --- Platform & System ---
    (health_flags,          "/health",               ["Health"]),
    (workflow,              "/workflow",             ["Workflow"]),
    (metadata,              "",                      ["Metadata"]),
    (changelog,             "",                      ["Changelog"]),
    (dev_tracker,           "",                      ["Dev Tracker"]),
    (system,                "",                      ["System"]),
    (governance,            "/governance",           ["Governance & System Config"]),
    (system_parameters,     "",                      ["System Parameters"]),
    (capability_registry,   "",                      ["Capability & Module Registry"]),
    (reference_data,        "",                      ["Global Reference Data & Localization"]),
    (localization,          "",                      ["Localization"]),

    # --- Auth & Users ---
    (auth,                  "/auth",                 ["Authentication"]),
    (users,                 "/users",                ["User Management"]),
    (roles,                 "/roles",                ["Role Matrix"]),
    (menus,                 "/menus",                ["Menu Governance"]),
    (security,              "/security",             ["Security Management"]),
    (ui_control_plane,      "/ui",                   ["UI Control Plane"]),
    (workspace_ui,          "",                      ["Workspace UI"]),
    (assignments,           "",                      ["Assignments"]),

    # --- Inventory & Products ---
    (inventory,             "/inventory",            ["Inventory"]),
    (inventory,             "/products",             ["Inventory"]),             # LEGACY alias — deprecate at v4.0
    (inventory,             "/inventory/products",   ["Inventory"]),             # LEGACY alias — deprecate at v4.0
    (inventory,             "/variants",             ["Variants"]),              # LEGACY alias — deprecate at v4.0
    (inventory_reports,     "",                      ["Inventory Reports"]),
    (physical_stock,        "",                      ["Physical Stock"]),
    (wms,                   "/wms",                  ["Warehouse & Batch Management"]),
    (boundaries,            "/boundaries",           ["Stock & Accounting Boundaries"]),
    (psv,                   "",                      ["Projected Stock Visibility"]),

    # --- Sales ---
    (sales,                 "/sales-invoices",       ["Sales-Legacy"]),          # LEGACY alias — deprecate at v3.20
    (sales,                 "/sales",                ["Sales"]),
    (sales,                 "/tattly",               ["Tattly Invoices"]),
    (sales_reports,         "",                      ["Sales Reports"]),

    # --- Purchase & Vendors ---
    (purchase,              "",                      ["Purchase-Legacy"]),        # LEGACY alias — deprecate at v3.20
    (purchase,              "/purchase",             ["Purchase"]),
    (vendor,                "/purchase",             ["Vendors"]),
    (vendor,                "",                      ["Vendors"]),
    (supplier_payment,      "",                      ["Supplier Payments"]),

    # --- CRM ---
    (crm,                   "",                      ["CRM"]),
    (crm,                   "/crm",                  ["CRM"]),                   # LEGACY alias — deprecate at v4.0
    (crm_reports,           "",                      ["CRM Reports"]),
    (crm_cge,               "/crm-growth",           ["CRM & Commercial Growth Engine"]),

    # --- POS ---
    (pos,                   "",                      ["POS Shift"]),

    # --- Masters & Configuration ---
    (master_lookup,         "/masters",              ["Masters"]),
    (masters,               "/masters",              ["Masters"]),
    (numbering,             "/numbering",            ["Numbering Engine"]),
    (terms,                 "/terms",                ["Terms & Conditions"]),
    (attributes,            "/attributes",           ["Attributes & Variants"]),

    # --- Barcode & Labels ---
    (barcode,               "/barcode",              ["Barcode Studio"]),
    (billing_csv,           "/billing",              ["Barcode Billing CSV Import"]),
    (barcode_registry,      "/barcode-registry",     ["Barcode Management"]),
    (barcodes,              "/barcodes",             ["Barcode & Labels Engine"]),
    (product_identity,      "/product-identity",     ["Product Identity Engine"]),

    # --- Finance & Accounting ---
    (accounting,            "/accounting",           ["Authoritative Accounting"]),
    (finance,               "/finance",              ["Finance & Cash Reports"]),
    (payments,              "/payments",             ["Payments Engine"]),

    # --- Engines ---
    (pricing,               "/pricing",              ["Pricing Engine"]),
    (promotions,            "/promotions",           ["Promotions & Offers Engine"]),
    (documents,             "/documents",            ["Documents Engine"]),
    (fulfillment,           "/fulfillment",          ["Fulfillment Engine"]),
    (approval_matrix,       "/approval-matrix",      ["Approval Matrix"]),
    (approval,              "/approval",             ["Approval Matrix Engine"]),
    (search,                "/search",               ["Universal Search Engine"]),
    (communicator,          "/communicator",         ["Communicator Engine"]),
    (governed_logic,        "/governed-logic",       ["Governed Logic & Reproducibility"]),
    (universal_master,      "/universal",            ["Universal Party & Item Master"]),

    # --- Intelligence & Distribution ---
    (distribution,          "/distribution",         ["Distribution Core"]),
    (pdt,                   "",                      ["Predictive Distribution Twin"]),
    (cge_unified,           "",                      ["CGE Unified Policies"]),
    (cge,                   "/cge",                  ["Commercial Growth Engine & PDT"]),
    (analytics,             "/analytics",            ["Analytics & Intelligence Plane"]),
    (reports,               "",                      ["Reports"]),
    (reporting_governance,  "",                      ["Reporting Governance"]),
    (scheduled_reports,     "",                      ["Scheduled Reports"]),

    # --- Integration & Data ---
    (exchange,              "/exchange",             ["Data Exchange Hub"]),
    (universal_import,      "/import",               ["Universal Import"]),
    (sync,                  "/sync",                 ["Offline-First Synchronization"]),
    (integration,           "/integration",          ["Integration Hub & Audit"]),
    (ecom,                  "",                      ["eCommerce / Omnichannel Engine"]),

    # --- Platform Infrastructure ---
    (ai,                    "/ai",                   ["AI Assistant"]),
    (docs,                  "/docs",                 ["Documentation"]),
    (company_center,        "",                      ["Company Control Center"]),
    (database_manager,      "/database-manager",     ["Database Manager"]),
    (training,              "",                      ["Training Academy"]),
    (staff,                 "",                      ["Staff Management"]),

    # --- Legacy & Migration ---
    (legacy_menu_map,       "/legacy-menu-map",      ["Legacy Migration Registry"]),
]

# Mount all routers from the registry
for _entry in _ROUTER_REGISTRY:
    _router_module, _prefix_suffix, _tags = _entry
    _router = getattr(_router_module, "router", None) if not hasattr(_router_module, "routes") else _router_module
    if _router is None:
        continue
    app.include_router(
        _router,
        prefix=settings.API_V1_STR + _prefix_suffix,
        tags=_tags,
    )

# Compliance module uses its own namespaced router variable
app.include_router(compliance_router, prefix=settings.API_V1_STR)

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




