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

* Version    : 3.22.1
Created      : 2026-07-11
Modified     : 2026-09-23
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
    dispatch_invoicing,
    docs,
    documents,
    ecom,
    exchange,
    finance,
    fulfillment,
    governance,
    governed_logic,
    grn,
    health_flags,
    identity,
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
    kpi_registry,
    loyalty,
)

from .core.config import settings
from .core.constants import SMRITI_BANNER
from .core.error_handlers import register_error_handlers
from .core.logging import logger
from .db.session import verify_db_connectivity, verify_tenant_connectivity
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

        # TDB-v2.0: Startup Control Plane Tenant Data Boundary Guard
        try:
            from .db.cp_guard import run_startup_check
            guard_report = run_startup_check()
            if guard_report.get("non_empty_violations"):
                logger.warning(
                    f"[TDB-v2.0] Control Plane contamination detected: "
                    f"{len(guard_report['non_empty_violations'])} non-empty tenant tables found in smritisys."
                )
            else:
                logger.info("[TDB-v2.0] Control Plane Boundary check: smritisys is clean.")
        except Exception as guard_exc:
            logger.warning(f"[TDB-v2.0] Notice during startup boundary check: {guard_exc}")

        # ── Startup Schema Guard ─────────────────────────────────────────────
        # Validates that critical tenant tables exist in the control plane DB
        # BEFORE the server starts accepting requests. Prevents silent 500 errors
        # caused by missing Alembic migrations on fresh installations.
        try:
            from .db.session import async_session
            from sqlalchemy import text as _sql_text

            _CRITICAL_TABLES = [
                # Loyalty Studio — created by v1486 (was missing before)
                "loyalty_tiers", "loyalty_rules",
                "loyalty_members", "loyalty_points_ledgers",
                # Compliance — columns added by v1485
                "compliance_immutable_audit_logs",
                # Core transactional
                "pos_profiles", "shifts", "customers",
                "sales_invoices", "products",
            ]

            async def _check_schema() -> list:
                missing = []
                async with async_session() as _sess:
                    for _tbl in _CRITICAL_TABLES:
                        row = await _sess.execute(
                            _sql_text(
                                "SELECT 1 FROM information_schema.tables "
                                "WHERE table_schema='public' AND table_name=:t LIMIT 1"
                            ),
                            {"t": _tbl},
                        )
                        if not row.scalar():
                            missing.append(_tbl)
                return missing

            _missing_tables = await _check_schema()
            if _missing_tables:
                logger.critical(
                    "[SMRITI Startup] SCHEMA GAP DETECTED — the following tables are missing "
                    "from the database. All endpoints that touch these tables will return 500. "
                    "Run 'alembic upgrade head' in the backend directory to fix this:\n"
                    + "\n".join(f"  \u2717  {t}" for t in _missing_tables)
                )
            else:
                logger.info(
                    "[SMRITI Startup] Schema guard passed — all critical tables present."
                )
        except Exception as _sg_exc:
            logger.warning(f"[SMRITI Startup] Schema guard could not run: {_sg_exc}")

        # Report Scheduler Daemon — start background asyncio dispatch loop
        if settings.REPORT_SCHEDULER_ENABLED:
            try:
                from .core.scheduler import start_scheduler
                start_scheduler(poll_interval_seconds=settings.REPORT_SCHEDULER_POLL_SECONDS)
                logger.info(
                    f"[SMRITI Startup] Report Scheduler Daemon started "
                    f"(poll_interval={settings.REPORT_SCHEDULER_POLL_SECONDS}s)."
                )
            except Exception as sched_exc:
                logger.warning(f"[SMRITI Startup] Report Scheduler Daemon failed to start: {sched_exc}")
        else:
            logger.info("[SMRITI Startup] Report Scheduler Daemon is DISABLED (REPORT_SCHEDULER_ENABLED=false).")

    yield

    # Graceful shutdown: stop the report scheduler daemon if it was started
    if settings.REPORT_SCHEDULER_ENABLED:
        try:
            from .core.scheduler import stop_scheduler
            await stop_scheduler()
            logger.info("[SMRITI Shutdown] Report Scheduler Daemon stopped.")
        except Exception as stop_exc:
            logger.warning(f"[SMRITI Shutdown] Error stopping Report Scheduler Daemon: {stop_exc}")


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
    allow_headers=["*"],
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
    (dispatch_invoicing,    "",                      ["B2B Dispatch Invoicing Studio"]),
    (sales_reports,         "",                      ["Sales Reports"]),

    # --- Purchase & Vendors ---
    (purchase,              "",                      ["Purchase-Legacy"]),        # LEGACY alias — deprecate at v3.20
    (purchase,              "/purchase",             ["Purchase"]),
    (grn,                   "",                      ["Goods Receipt Note"]),
    (vendor,                "/purchase",             ["Vendors"]),
    (vendor,                "",                      ["Vendors"]),
    (supplier_payment,      "",                      ["Supplier Payments"]),

    # --- CRM & Loyalty ---
    (crm,                   "",                      ["CRM"]),
    (crm,                   "/crm",                  ["CRM"]),                   # LEGACY alias — deprecate at v4.0
    (crm_reports,           "",                      ["CRM Reports"]),
    (crm_cge,               "/crm-growth",           ["CRM & Commercial Growth Engine"]),
    (loyalty,               "",                      ["Loyalty Studio"]),

    # --- POS ---
    (pos,                   "",                      ["POS Shift"]),

    # --- Masters & Configuration ---
    (master_lookup,         "/masters",              ["Masters"]),
    (master_lookup,         "",                      ["Master Lookups Adapter"]),
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
    (identity,              "/identity",             ["SMRITI Unified Identity Engine"]),

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
    (universal_master,      "",                      ["Universal Items & Parties"]),

    # --- Intelligence & Distribution ---
    (distribution,          "/distribution",         ["Distribution Core"]),
    (pdt,                   "",                      ["Predictive Distribution Twin"]),
    (cge_unified,           "",                      ["CGE Unified Policies"]),
    (cge,                   "/cge",                  ["Commercial Growth Engine & PDT"]),
    (analytics,             "/analytics",            ["Analytics & Intelligence Plane"]),
    (reports,               "",                      ["Reports"]),
    (reporting_governance,  "",                      ["Reporting Governance"]),
    (scheduled_reports,     "",                      ["Scheduled Reports"]),
    (kpi_registry,          "",                      ["KPI Registry"]),

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
    Asserts both control plane (smritisys) and tenant operational database (smriti001) connectivity.
    """
    control_ok = await verify_db_connectivity()
    tenant_ok = await verify_tenant_connectivity("smriti001")
    is_healthy = control_ok and tenant_ok
    status_code = 200 if is_healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if is_healthy else "degraded",
            "control_plane": "connected" if control_ok else "disconnected",
            "tenant_plane": "connected" if tenant_ok else "disconnected",
            "service": "operational",
        },
    )

@app.get("/ready", tags=["Health Diagnostics"])
async def readiness_check():
    """
    Verify if the API framework service is ready to receive requests.
    Requires both control-plane and default tenant database to be responsive.
    """
    control_ok = await verify_db_connectivity()
    tenant_ok = await verify_tenant_connectivity("smriti001")
    is_ready = control_ok and tenant_ok
    status_code = 200 if is_ready else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "not_ready",
            "control_plane": control_ok,
            "tenant_plane": tenant_ok,
        },
    )

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




