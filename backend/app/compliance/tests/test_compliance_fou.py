"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import importlib
import sys
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.api.deps import TenantContext
from app.compliance.exceptions import ConfigurationException, ManifestValidationException, PolicyViolationException
from app.compliance.models.compliance import (
    ComplianceAuditLog,
    ComplianceCredentials,
    ComplianceOutbox,
    GovernmentService,
)
from app.compliance.repositories.audit_log_repository import ComplianceAuditLogRepository
from app.compliance.repositories.credentials_repository import ComplianceCredentialsRepository
from app.compliance.repositories.government_service_repository import GovernmentServiceRepository
from app.compliance.repositories.outbox_repository import ComplianceOutboxRepository
from app.compliance.services.audit_service import AuditService
from app.compliance.services.compliance_service import ComplianceService
from app.compliance.services.credential_service import CredentialService
from app.compliance.services.policy_service import PolicyService
from app.compliance.services.registry_service import RegistryService
from app.core.config import settings
from app.main import app
from app.models.tenant import Branch, Company

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Setup Clean Environment Hook
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
async def ensure_vault_env(monkeypatch):
    """
    Ensure correct keys are always configured for vault startup checks.
    """
    monkeypatch.setenv("SGIP_VAULT_MASTER_KEY", "ci_test_vault_master_key_for_sgip")
    monkeypatch.setenv("JWT_SECRET_KEY", "different_jwt_secret_key_for_authentication")
    # Reload crypto to pick up these env vars
    importlib.reload(sys.modules["app.compliance.vault.crypto"])
    yield

@pytest.fixture(autouse=True)
async def override_db(db_session):
    from app.api.deps import get_db
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)

async def _make_tenant(db_session, suffix: str):
    unique_suffix = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(
        id=f"comp-sgip-{unique_suffix}",
        name=f"SGIP Co {unique_suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True
    )
    br = Branch(
        id=f"br-sgip-{unique_suffix}",
        company_id=comp.id,
        name=f"SGIP Br {unique_suffix}",
        code=f"BRSGIP-{unique_suffix[:6]}",
        is_active=True
    )
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br

# ---------------------------------------------------------------------------
# Vault Tests
# ---------------------------------------------------------------------------
async def test_vault_key_sourcing_validation(monkeypatch):
    """
    Asserts that vault module raises ConfigurationException if env vars are missing or duplicate.
    """
    # 1. Test missing Master Key
    monkeypatch.delenv("SGIP_VAULT_MASTER_KEY", raising=False)
    with pytest.raises(ConfigurationException) as excinfo:
        importlib.reload(sys.modules["app.compliance.vault.crypto"])
    assert "SGIP-VAULT-001" in str(excinfo.value)

    # Restore master key
    monkeypatch.setenv("SGIP_VAULT_MASTER_KEY", "temp_master_key")

    # 2. Test duplicate keys (master key equals jwt secret)
    monkeypatch.setenv("JWT_SECRET_KEY", "temp_master_key")
    with pytest.raises(ConfigurationException) as excinfo:
        importlib.reload(sys.modules["app.compliance.vault.crypto"])
    assert "SGIP-VAULT-002" in str(excinfo.value)

async def test_vault_deterministic_mode_gating(monkeypatch):
    """
    Asserts that deterministic encryption mode is strictly OFF outside pytest test-signals.
    """
    from app.compliance.vault.crypto import decrypt_data, encrypt_data

    # Scenario A: Outside pytest environment (simulated by deleting test env var)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.setenv("SGIP_VAULT_DETERMINISTIC", "true")

    enc1 = encrypt_data("comp_test", "secret_payload")
    enc2 = encrypt_data("comp_test", "secret_payload")
    # Must produce different outputs (random nonce used)
    assert enc1 != enc2
    assert decrypt_data("comp_test", enc1) == "secret_payload"
    assert decrypt_data("comp_test", enc2) == "secret_payload"

    # Scenario B: Under pytest environment with deterministic flag active
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "true")
    monkeypatch.setenv("SGIP_VAULT_DETERMINISTIC", "true")

    enc3 = encrypt_data("comp_test", "secret_payload")
    enc4 = encrypt_data("comp_test", "secret_payload")
    # Must produce identical outputs (deterministic static nonce used)
    assert enc3 == enc4
    assert decrypt_data("comp_test", enc3) == "secret_payload"

# ---------------------------------------------------------------------------
# Registry & Manifest Tests
# ---------------------------------------------------------------------------
async def test_connector_registry_discovery():
    """
    Verifies that ConnectorRegistry discover manifests and loads properties from fixtures.
    """
    from app.compliance.registry.registry import ConnectorRegistry
    registry = ConnectorRegistry()
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"

    registry.discover_connectors(fixtures_dir)
    manifest = registry.get_manifest("test_connector")

    assert manifest is not None
    assert manifest["id"] == "test_connector"
    assert manifest["environments"]["sandbox"]["enabled"] is True
    assert manifest["environments"]["production"]["enabled"] is False
    assert "generate" in manifest["capabilities"]

async def test_connector_registry_invalid_manifests():
    """
    Asserts validation errors are raised on missing or malformed schemas.
    """
    from app.compliance.registry.registry import ConnectorRegistry
    registry = ConnectorRegistry()

    # Missing fields
    invalid_manifest = {
        "id": "ewaybill_invalid",
        "name": "NIC E-Way Bill"
        # missing api_version, environments, capabilities, etc.
    }
    with pytest.raises(ManifestValidationException):
        registry.validate_manifest(invalid_manifest)

    # Incorrect type
    type_mismatch_manifest = {
        "id": "ewaybill_invalid",
        "name": "NIC E-Way Bill",
        "version": 1.0,  # Float instead of String
        "provider": "NIC",
        "api_version": "v1",
        "status": "active",
        "environments": {},
        "capabilities": []
    }
    with pytest.raises(ManifestValidationException):
        registry.validate_manifest(type_mismatch_manifest)

# ---------------------------------------------------------------------------
# Database & Repositories Tests
# ---------------------------------------------------------------------------
async def test_compliance_repositories_crud(db_session):
    """
    Verifies CRUD database operations using the generated repository classes.
    """
    # 1. GovernmentService
    service_repo = GovernmentServiceRepository(db_session)
    svc = GovernmentService(
        id="ewaybill",
        name="NIC E-Way Bill",
        version="1.0.0",
        provider="NIC",
        api_version="v1",
        status="ACTIVE"
    )
    created_svc = await service_repo.create(svc)
    await db_session.commit()
    assert created_svc.id == "ewaybill"

    # 2. ComplianceCredentials
    cred_repo = ComplianceCredentialsRepository(db_session)
    cred = ComplianceCredentials(
        id="cred-test",
        service_id="ewaybill",
        encrypted_username="encrypted_user",
        encrypted_password="encrypted_pass"
    )
    created_cred = await cred_repo.create(cred)
    await db_session.commit()
    assert created_cred.id == "cred-test"

    # Query helper
    fetched_cred = await cred_repo.get_by_service("ewaybill")
    assert fetched_cred is not None
    assert fetched_cred.encrypted_username == "encrypted_user"

    # 3. ComplianceAuditLog
    audit_repo = ComplianceAuditLogRepository(db_session)
    audit = ComplianceAuditLog(
        id="audit-test",
        service_id="ewaybill",
        endpoint="/api/v1/submit",
        status_code=200,
        duration_ms=120
    )
    created_audit = await audit_repo.create(audit)
    await db_session.commit()
    assert created_audit.id == "audit-test"

    # 4. ComplianceOutbox
    outbox_repo = ComplianceOutboxRepository(db_session)
    outbox = ComplianceOutbox(
        id="outbox-test",
        service_id="ewaybill",
        state="DRAFT",
        action="generate",
        payload="{}",
        idempotency_key="key-unique-123",
        attempts=0
    )
    created_outbox = await outbox_repo.create(outbox)
    await db_session.commit()
    assert created_outbox.id == "outbox-test"

    fetched_outbox = await outbox_repo.get_by_idempotency_key("key-unique-123")
    assert fetched_outbox is not None
    assert fetched_outbox.id == "outbox-test"

    # Clean up created objects in test database
    await db_session.execute(delete(ComplianceCredentials))
    await db_session.execute(delete(GovernmentService))
    await db_session.execute(delete(ComplianceAuditLog))
    await db_session.execute(delete(ComplianceOutbox))
    await db_session.commit()

# ---------------------------------------------------------------------------
# Services Tests
# ---------------------------------------------------------------------------
async def test_services_coordination(db_session):
    """
    Verifies RegistryService, CredentialService, AuditService, PolicyService,
    and ComplianceService coordination logic.
    """
    comp, br = await _make_tenant(db_session, "svc")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"

    # Insert GovernmentService test_connector to satisfy Foreign Key constraints
    gov_svc = GovernmentService(
        id="test_connector",
        name="Test Connector",
        version="1.0.0",
        provider="Test",
        api_version="v1",
        status="ACTIVE"
    )
    db_session.add(gov_svc)
    await db_session.commit()

    # 1. Registry Service
    registry_service = RegistryService()
    registry_service.discover_from_path(fixtures_dir)
    assert registry_service.get_connectors_count() == 1
    assert registry_service.get_manifest("test_connector") is not None

    # 2. Credential Service
    cred_service = CredentialService(db_session, tenant_ctx)
    created_cred = await cred_service.save_credentials(
        service_id="test_connector",
        username="nic_username",
        password="nic_password",
        client_secret="nic_secret"
    )
    assert created_cred.service_id == "test_connector"

    decrypted = await cred_service.get_credentials("test_connector")
    assert decrypted is not None
    assert decrypted["username"] == "nic_username"
    assert decrypted["password"] == "nic_password"
    assert decrypted["client_secret"] == "nic_secret"

    # 3. Audit Service
    audit_service = AuditService(db_session, tenant_ctx)
    audit = await audit_service.log_action(
        service_id="test_connector",
        endpoint="/api/v1/submit",
        status_code=200,
        duration_ms=85
    )
    assert audit.status_code == 200

    # 4. Policy Service
    policy_service = PolicyService(registry_service)
    # Valid submission
    policy_service.validate_submission(
        service_id="test_connector",
        action="generate",
        environment="sandbox"
    )
    # Invalid capability
    with pytest.raises(PolicyViolationException) as excinfo:
        policy_service.validate_submission("test_connector", "invalid_action")
    assert "SGIP-POL-002" in str(excinfo.value)

    # Invalid environment status
    with pytest.raises(PolicyViolationException) as excinfo:
        policy_service.validate_submission("test_connector", "generate", "production")
    assert "SGIP-POL-004" in str(excinfo.value)

    # 5. Compliance Service
    compliance_service = ComplianceService(db_session, tenant_ctx, policy_service)
    outbox_rec = await compliance_service.queue_outbox_event(
        service_id="test_connector",
        action="generate",
        payload="{}",
        idempotency_key="idemp-key-unique-789",
        environment="sandbox"
    )
    assert outbox_rec.idempotency_key == "idemp-key-unique-789"
    assert outbox_rec.state == "DRAFT"

    # Assert Duplicate Idempotency Key fails
    with pytest.raises(PolicyViolationException) as excinfo:
        await compliance_service.queue_outbox_event(
            service_id="test_connector",
            action="generate",
            payload="{}",
            idempotency_key="idemp-key-unique-789",
            environment="sandbox"
        )
    assert "SGIP-POL-005" in str(excinfo.value)

    # Clean up database
    await db_session.execute(delete(ComplianceCredentials))
    await db_session.execute(delete(ComplianceAuditLog))
    await db_session.execute(delete(ComplianceOutbox))
    await db_session.execute(delete(GovernmentService).where(GovernmentService.id == "test_connector"))
    await db_session.execute(delete(Branch).where(Branch.id == br.id))
    await db_session.execute(delete(Company).where(Company.id == comp.id))
    await db_session.commit()

# ---------------------------------------------------------------------------
# API Router Endpoints Tests
# ---------------------------------------------------------------------------
async def test_health_check_endpoint():
    """
    GET /api/v1/compliance/health returns status of subsystems.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/compliance/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["healthy", "unhealthy"]
    assert data["database"] in ["healthy", "unhealthy"]
    assert data["vault"] == "healthy"
    assert data["registry"] == "healthy"
    assert data["milestone"] == "1"

async def test_debug_outbox_gating(db_session, monkeypatch):
    """
    POST /api/v1/compliance/debug/outbox returns 404 when ENVIRONMENT=production.
    """
    from app.api.deps import get_current_user, get_tenant_context
    from app.compliance.api.router import get_registry_service
    from app.models.auth import User, UserRole

    comp, br = await _make_tenant(db_session, "api")
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"

    # Insert GovernmentService test_connector to satisfy Foreign Key constraints
    gov_svc = GovernmentService(
        id="test_connector",
        name="Test Connector",
        version="1.0.0",
        provider="Test",
        api_version="v1",
        status="ACTIVE"
    )
    db_session.add(gov_svc)
    await db_session.commit()

    # Mock dependencies to bypass real JWT authentication
    async def mock_get_tenant_context():
        return TenantContext(company_id=comp.id, branch_id=br.id)

    async def mock_get_current_user():
        return User(id="usr-test", username="test_user", role=UserRole.SYSADMIN)

    def mock_get_registry_service():
        svc = RegistryService()
        svc.discover_from_path(fixtures_dir)
        return svc

    app.dependency_overrides[get_tenant_context] = mock_get_tenant_context
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_registry_service] = mock_get_registry_service

    try:
        payload = {
            "service_id": "test_connector",
            "action": "generate",
            "payload": "{}",
            "idempotency_key": f"idemp-endpoint-{uuid.uuid4().hex[:6]}"
        }

        # Scenario A: Gated in development mode (returns status 200)
        monkeypatch.setattr(settings, "ENVIRONMENT", "development")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/compliance/debug/outbox", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["state"] == "DRAFT"

        # Scenario B: Gated in production mode (must return 404 Not Found)
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/compliance/debug/outbox", json=payload)
        assert res.status_code == 404

    finally:
        # Clean up database
        await db_session.execute(delete(ComplianceOutbox))
        await db_session.execute(delete(GovernmentService).where(GovernmentService.id == "test_connector"))
        await db_session.execute(delete(Branch).where(Branch.id == br.id))
        await db_session.execute(delete(Company).where(Company.id == comp.id))
        await db_session.commit()

        # Clean up dependency overrides
        app.dependency_overrides.pop(get_tenant_context, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_registry_service, None)

