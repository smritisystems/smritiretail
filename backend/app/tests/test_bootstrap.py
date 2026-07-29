"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Version      : 3.30.0
Created      : 2026-07-29
Modified     : 2026-07-29
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.system import BootstrapTask, SystemBootstrapState
from app.services.bootstrap import BootstrapService
import app.services.bootstrap as bootstrap_module
from app.api.deps import get_db
from app.core.security import hash_password, verify_password
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def test_fresh_install_dev_bootstrap_creates_super_user(db_session, monkeypatch):
    """Fresh install in development profile creates default super user with convenience password."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "development", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", True, raising=False)

    service = BootstrapService(db_session)
    await service.run()

    # Verify user super created
    user_res = await db_session.execute(select(User).where(User.username == "super"))
    super_user = user_res.scalars().first()
    assert super_user is not None
    assert super_user.role == UserRole.SYSADMIN
    assert verify_password("whynothing", super_user.hashed_password) is True

    # Verify bootstrap state table entries
    states_res = await db_session.execute(select(SystemBootstrapState))
    states = {s.task_name: s for s in states_res.scalars().all()}
    assert BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value in states
    recon_state = states[BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value]
    assert recon_state.status == "Complete"
    assert recon_state.execution_count == 1


async def test_restart_after_bootstrap_is_idempotent(db_session, monkeypatch):
    """Restarting bootstrap when tasks are already complete results in zero duplicate executions or password mutations."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "development", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", True, raising=False)

    service = BootstrapService(db_session)
    await service.run()

    user_res = await db_session.execute(select(User).where(User.username == "super"))
    super_user = user_res.scalars().first()
    initial_hash = super_user.hashed_password

    # Second run
    service_second = BootstrapService(db_session)
    await service_second.run()

    await db_session.refresh(super_user)
    assert super_user.hashed_password == initial_hash

    # Check state execution count remains 1 for skipped tasks
    state = await service_second._get_task_state(BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value)
    assert state.execution_count == 1
    assert state.status == "Complete"


async def test_existing_custom_admin_password_is_never_overwritten(db_session, monkeypatch):
    """If super user already has a custom password, legacy reconciliation skips and preserves custom hash."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "development", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", True, raising=False)

    custom_hash = hash_password("MyStrongCustomPass!2026")
    custom_super = User(
        id="usr-custom-super",
        username="super",
        email="super@smriti.test",
        hashed_password=custom_hash,
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        is_platform_admin=True,
    )
    db_session.add(custom_super)
    await db_session.commit()

    service = BootstrapService(db_session)
    await service.run()

    await db_session.refresh(custom_super)
    assert custom_super.hashed_password == custom_hash
    assert verify_password("MyStrongCustomPass!2026", custom_super.hashed_password) is True
    assert verify_password("whynothing", custom_super.hashed_password) is False

    state = await service._get_task_state(BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value)
    assert state.status == "Complete"
    assert "Custom password present" in state.error_message


async def test_production_environment_disables_reconciliation(db_session, monkeypatch):
    """In production profile, legacy password reconciliation is skipped and default password is never injected."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "production", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", False, raising=False)

    legacy_super = User(
        id="usr-legacy-super",
        username="super",
        email="super@smriti.test",
        hashed_password=hash_password("Smriti@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(legacy_super)
    await db_session.commit()

    service = BootstrapService(db_session)
    await service.run()

    await db_session.refresh(legacy_super)
    # Password remains Smriti@1234 — NOT changed to whynothing in production
    assert verify_password("Smriti@1234", legacy_super.hashed_password) is True
    assert verify_password("whynothing", legacy_super.hashed_password) is False

    state = await service._get_task_state(BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value)
    assert state.status == "Skipped"


async def test_legacy_seeded_admin_one_time_reconciliation_succeeds(db_session, monkeypatch):
    """Legacy admin using old default password Smriti@1234 gets reconciled once to convenience password in development."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "development", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", True, raising=False)

    legacy_super = User(
        id="usr-legacy-super-dev",
        username="super",
        email="super@smriti.test",
        hashed_password=hash_password("Smriti@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(legacy_super)
    await db_session.commit()

    service = BootstrapService(db_session)
    await service.run()

    await db_session.refresh(legacy_super)
    assert verify_password("whynothing", legacy_super.hashed_password) is True

    state = await service._get_task_state(BootstrapTask.LEGACY_PASSWORD_RECONCILIATION.value)
    assert state.status == "Complete"
    assert "Reconciled legacy password" in state.error_message


async def test_login_failure_does_not_mutate_credentials(db_session, monkeypatch):
    """Authentication failure on wrong password causes ZERO side-effects or password mutations in database."""
    monkeypatch.setattr(bootstrap_module.settings, "ENVIRONMENT", "development", raising=False)
    monkeypatch.setattr(bootstrap_module.settings, "ENABLE_DEV_LOGIN", True, raising=False)

    # First run bootstrap to set up initial state
    service = BootstrapService(db_session)
    await service.run()

    user_res = await db_session.execute(select(User).where(User.username == "super"))
    super_user = user_res.scalars().first()
    original_hash = super_user.hashed_password

    # Attempt login with WRONG password
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": "super",
            "password": "WrongPassword99!",
        })

    assert res.status_code == 401
    await db_session.refresh(super_user)
    assert super_user.hashed_password == original_hash
