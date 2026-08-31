"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.72.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import hashlib
import os
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport

from app.api.deps import TenantContext, get_current_user, get_tenant_context, get_db
from app.main import app
from app.models.auth import User, UserRole
from app.models.report_schedule import ReportDispatchLog, ReportSchedule
from app.schemas.scheduled_reports import (
    RecipientConfig,
    ReportScheduleCreate,
    ReportScheduleUpdate,
)
from app.services.reporting_distribution_svc import (
    CronEvaluator,
    EmailDispatcher,
    ReportDistributionEngine,
    StatutoryVaultDispatcher,
    WhatsAppDispatcher,
)


class MockResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        class ScalarResult:
            def __init__(self, data):
                self._data = data
            def all(self):
                return self._data
        return ScalarResult(self._items)

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class InMemoryAsyncSession:
    """Lightweight in-memory AsyncSession simulator for testing distribution workflows."""

    def __init__(self):
        self.schedules = {}
        self.dispatch_logs = []

    def add(self, obj):
        if isinstance(obj, ReportSchedule):
            if not obj.id:
                obj.id = f"sch-{uuid.uuid4().hex[:12]}"
            if not obj.created_at:
                obj.created_at = datetime.now(timezone.utc)
            if not obj.modified_at:
                obj.modified_at = datetime.now(timezone.utc)
            self.schedules[obj.id] = obj
        elif isinstance(obj, ReportDispatchLog):
            if not obj.id:
                obj.id = f"log-{uuid.uuid4().hex[:12]}"
            if not obj.created_at:
                obj.created_at = datetime.now(timezone.utc)
            self.dispatch_logs.append(obj)

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass

    async def execute(self, stmt):
        # Inspect statement to return matching entities
        stmt_str = str(stmt).lower()
        if "report_schedules" in stmt_str:
            # Check if filtered by ID
            items = [s for s in self.schedules.values() if not getattr(s, "is_deleted", False)]
            # If query params indicate a specific ID, filter it
            for param in getattr(stmt, "_where_criteria", []):
                param_str = str(param)
                for sch_id, sch in self.schedules.items():
                    if sch_id in param_str:
                        return MockResult([sch] if not getattr(sch, "is_deleted", False) else [])
            return MockResult(items)
        elif "report_dispatch_logs" in stmt_str:
            return MockResult(self.dispatch_logs)
        return MockResult([])


@pytest.fixture
def mock_session():
    return InMemoryAsyncSession()


async def mock_admin_user():
    return User(
        id="USR-TEST-CFO",
        username="cfo_test",
        role=UserRole.SYSADMIN,
        is_active=True,
    )


async def mock_tenant():
    return TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
    )


@pytest.fixture(autouse=True)
def override_test_dependencies(mock_session):
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[get_tenant_context] = mock_tenant
    app.dependency_overrides[get_db] = lambda: mock_session
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_01_cron_evaluator_deterministic_next_run():
    """Validates deterministic next-run calculation across standard cron intervals."""
    base_time = datetime(2026, 8, 28, 10, 0, 0, tzinfo=timezone.utc)
    
    # 1. 21:00 Daily cron ("0 21 * * *") -> should be today at 21:00 UTC
    next_run = CronEvaluator.compute_next_run("0 21 * * *", base_time)
    assert next_run.hour == 21
    assert next_run.minute == 0
    assert next_run.day == 28
    
    # 2. 08:00 Daily cron after 10:00 -> should roll over to tomorrow at 08:00 UTC
    next_run_past = CronEvaluator.compute_next_run("0 8 * * *", base_time)
    assert next_run_past.hour == 8
    assert next_run_past.minute == 0
    assert next_run_past.day == 29


@pytest.mark.asyncio
async def test_02_schedule_crud_lifecycle(mock_session):
    """Certifies complete CRUD lifecycle and tenant isolation for report schedules."""
    tenant_ctx = TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
    )
    engine = ReportDistributionEngine(mock_session, tenant_ctx)
    
    # 1. Create Schedule
    create_payload = ReportScheduleCreate(
        schedule_name="Daily Executive Sales Register",
        report_code="RPT-SAL-001",
        cron_expression="0 21 * * *",
        export_format="XLSX",
        channels=["EMAIL", "WHATSAPP", "STATUTORY_VAULT"],
        recipients=RecipientConfig(
            emails=["cfo@tattlythreads.com", "audit@smritibooks.com"],
            phone_numbers=["+919876543210"],
            vault_folder="statutory/2026/daily_sales"
        ),
        filter_overrides={"date_range": "TODAY", "branch_id": "BR-MAIN-001"},
        is_active=True
    )
    schedule = await engine.create_schedule(create_payload)
    assert schedule.id.startswith("sch-")
    assert schedule.schedule_name == "Daily Executive Sales Register"
    assert schedule.report_code == "RPT-SAL-001"
    assert schedule.company_id == "COMP-001"
    assert schedule.status == "IDLE"
    assert schedule.next_run_at is not None

    # 2. Direct lookup
    assert schedule.id in mock_session.schedules

    # 3. List Schedules
    schedules = await engine.list_schedules()
    assert len(schedules) >= 1
    assert any(s.id == schedule.id for s in schedules)


@pytest.mark.asyncio
async def test_03_multi_format_payload_rendering(mock_session):
    """Certifies multi-format report serialization (XLSX, PDF, CSV, JSON)."""
    engine = ReportDistributionEngine(mock_session)
    
    # CSV
    csv_bytes = engine._render_report_payload("RPT-SAL-001", "CSV", {})
    assert b"INV-2026-001" in csv_bytes
    assert b"Tattly Threads" in csv_bytes
    
    # JSON
    json_bytes = engine._render_report_payload("RPT-SAL-001", "JSON", {})
    assert b"report_code" in json_bytes
    
    # PDF
    pdf_bytes = engine._render_report_payload("RPT-SAL-001", "PDF", {})
    assert pdf_bytes.startswith(b"%PDF-1.4")
    
    # XLSX
    xlsx_bytes = engine._render_report_payload("RPT-SAL-001", "XLSX", {})
    assert xlsx_bytes.startswith(b"PK\x03\x04")


@pytest.mark.asyncio
async def test_04_multi_channel_dispatchers():
    """Certifies independent channel dispatchers (Email, WhatsApp, Statutory Vault)."""
    dummy_payload = b"TEST_REPORT_BINARY_CONTENT_2026"
    test_hash = hashlib.sha256(dummy_payload).hexdigest()
    
    # 1. Email Dispatcher
    email_res = await EmailDispatcher.dispatch(
        "cfo@tattlythreads.com",
        "Weekly Audit Summary",
        "RPT-TAX-006",
        dummy_payload,
        "XLSX",
        test_hash
    )
    assert email_res["status"] == "DELIVERED"
    assert email_res["channel"] == "EMAIL"
    assert email_res["envelope_hash"] == test_hash
    assert "@smritibooks.com" in email_res["message_id"]

    # 2. WhatsApp Dispatcher
    wa_res = await WhatsAppDispatcher.dispatch(
        "+919876543210",
        "Weekly Audit Summary",
        "RPT-TAX-006",
        dummy_payload,
        "XLSX",
        test_hash
    )
    assert wa_res["status"] == "DELIVERED"
    assert wa_res["channel"] == "WHATSAPP"
    assert "SMRITI Retail OS" in wa_res["summary_text"]
    assert wa_res["envelope_hash"] == test_hash

    # 3. Statutory Vault Dispatcher
    vault_res = await StatutoryVaultDispatcher.dispatch(
        "test_vault_2026",
        "Weekly Audit Summary",
        "RPT-TAX-006",
        dummy_payload,
        "XLSX",
        test_hash
    )
    assert vault_res["status"] == "DELIVERED"
    assert vault_res["channel"] == "STATUTORY_VAULT"
    assert os.path.exists(vault_res["vault_path"])
    assert vault_res["file_size"] == len(dummy_payload)


@pytest.mark.asyncio
async def test_05_schedule_execution_and_forensic_sealing(mock_session):
    """Certifies end-to-end execution of a schedule with concurrent multi-channel dispatch and audit logging."""
    tenant_ctx = TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
    )
    engine = ReportDistributionEngine(mock_session, tenant_ctx)
    
    # Create Schedule
    schedule = await engine.create_schedule(
        ReportScheduleCreate(
            schedule_name="Weekly Tax Invoices Statutory Register",
            report_code="RPT-TAX-006",
            cron_expression="0 20 * * 5",
            export_format="XLSX",
            channels=["EMAIL", "WHATSAPP", "STATUTORY_VAULT"],
            recipients=RecipientConfig(
                emails=["tax@tattlythreads.com"],
                phone_numbers=["+919876543210"],
                vault_folder="statutory/tax_registers"
            ),
            filter_overrides={"quarter": "Q2-2026"},
            is_active=True
        )
    )

    # Execute
    res = await engine.execute_schedule(schedule.id, force=True)
    assert res.status == "COMPLETED"
    assert res.report_code == "RPT-TAX-006"
    assert len(res.dispatches) == 3  # 1 Email + 1 WhatsApp + 1 Statutory Vault
    assert len(res.forensic_envelope_hash) == 64
    
    # Verify Audit Logs
    assert len(mock_session.dispatch_logs) == 3
    channels_logged = {l.dispatch_channel for l in mock_session.dispatch_logs}
    assert channels_logged == {"EMAIL", "WHATSAPP", "STATUTORY_VAULT"}
    for log in mock_session.dispatch_logs:
        assert log.status == "DELIVERED"
        assert log.forensic_envelope_hash == res.forensic_envelope_hash
        assert log.payload_size_bytes > 0


@pytest.mark.asyncio
async def test_06_fastapi_scheduled_reports_endpoints():
    """Validates FastAPI REST endpoints under /api/v1/reporting/schedules."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Schedule via REST
        res = await client.post(
            "/api/v1/reporting/schedules",
            json={
                "schedule_name": "REST Scheduled Stock Valuation",
                "report_code": "RPT-INV-003",
                "cron_expression": "0 22 * * *",
                "export_format": "CSV",
                "channels": ["EMAIL", "STATUTORY_VAULT"],
                "recipients": {
                    "emails": ["inventory@tattlythreads.com"],
                    "vault_folder": "statutory/inventory_audits"
                },
                "filter_overrides": {"category": "GARMENTS"},
                "is_active": True
            },
            headers={"X-Company-Code": "COMP-001"}
        )
        assert res.status_code == 201
        data = res.json()
        schedule_id = data["id"]
        assert data["schedule_name"] == "REST Scheduled Stock Valuation"
        assert data["report_code"] == "RPT-INV-003"
        assert data["status"] == "IDLE"

        # 2. List Schedules
        list_res = await client.get("/api/v1/reporting/schedules", headers={"X-Company-Code": "COMP-001"})
        assert list_res.status_code == 200
        assert any(s["id"] == schedule_id for s in list_res.json())

        # 3. Trigger Schedule Ad-Hoc
        trigger_res = await client.post(
            f"/api/v1/reporting/schedules/{schedule_id}/trigger",
            headers={"X-Company-Code": "COMP-001"}
        )
        assert trigger_res.status_code == 200
        trig_data = trigger_res.json()
        assert trig_data["status"] == "COMPLETED"
        assert len(trig_data["dispatches"]) == 2

        # 4. Get Dispatch Logs
        logs_res = await client.get(
            f"/api/v1/reporting/schedules/{schedule_id}/logs",
            headers={"X-Company-Code": "COMP-001"}
        )
        assert logs_res.status_code == 200
        assert len(logs_res.json()) >= 2
