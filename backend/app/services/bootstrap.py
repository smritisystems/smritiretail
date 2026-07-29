"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Version      : 3.31.0
Created      : 2026-07-29
Modified     : 2026-07-29
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Awaitable, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..core.config import settings
from ..core.security import hash_password, verify_password
from ..models.auth import User, UserRole
from ..models.system import BootstrapTask, SystemBootstrapState

logger = logging.getLogger(__name__)


class BootstrapPhase(str, Enum):
    PHASE_1_DATABASE          = "Phase 1: Database Initialization"
    PHASE_2_SECURITY          = "Phase 2: Security & Authentication"
    PHASE_3_MASTER_DATA       = "Phase 3: Master Data & Lookup Seeding"
    PHASE_4_PLATFORM_SERVICES = "Phase 4: Platform Services & Workflows"
    PHASE_5_POST_INSTALL      = "Phase 5: Post-Installation & Reconciliation"
    PHASE_6_VERIFICATION      = "Phase 6: Health & Verification"


class BootstrapService:
    BOOTSTRAP_LOCK_KEY: int = 891230491

    def __init__(self, db: AsyncSession):
        self.db = db
        self.version = getattr(settings, "BOOTSTRAP_VERSION", "1.0.0")

    def _is_dev_login_enabled(self) -> bool:
        enabled = getattr(settings, "ENABLE_DEV_LOGIN", False)
        if enabled:
            return True
        environment = str(getattr(settings, "ENVIRONMENT", "")).lower()
        return environment in {"development", "dev", "test", "demo"}

    async def _ensure_state_table_exists(self) -> None:
        """Ensure the system_bootstrap_states table exists in PostgreSQL."""
        try:
            await self.db.execute(text("SELECT 1 FROM system_bootstrap_states LIMIT 1"))
        except SQLAlchemyError:
            await self.db.rollback()
            await self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS system_bootstrap_states (
                    id VARCHAR(50) PRIMARY KEY,
                    uuid VARCHAR(36) NOT NULL UNIQUE,
                    tenant_id VARCHAR(50),
                    company_id VARCHAR(50),
                    branch_id VARCHAR(50),
                    created_at TIMESTAMP WITH TIME ZONE,
                    modified_at TIMESTAMP WITH TIME ZONE,
                    created_by VARCHAR(100),
                    updated_by VARCHAR(100),
                    is_active BOOLEAN DEFAULT TRUE,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    deleted_at TIMESTAMP WITH TIME ZONE,
                    deleted_by VARCHAR(100),
                    version INTEGER DEFAULT 1,
                    workflow_status VARCHAR(30),
                    document_number VARCHAR(80),
                    task_name VARCHAR(100) NOT NULL UNIQUE,
                    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                    started_at TIMESTAMP WITH TIME ZONE,
                    completed_at TIMESTAMP WITH TIME ZONE,
                    duration_ms INTEGER,
                    bootstrap_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
                    execution_count INTEGER NOT NULL DEFAULT 0,
                    error_message TEXT
                );
            """))
            await self.db.commit()

    async def _get_task_state(self, task_name: str) -> Optional[SystemBootstrapState]:
        res = await self.db.execute(
            select(SystemBootstrapState).where(SystemBootstrapState.task_name == task_name)
        )
        return res.scalars().first()

    async def execute_task(
        self,
        task: BootstrapTask,
        task_func: Callable[[], Awaitable[tuple[str, Optional[str]]]]
    ) -> SystemBootstrapState:
        """
        Idempotent task wrapper that executes task_func, tracks timing & metadata,
        and records state in system_bootstrap_states.
        """
        await self._ensure_state_table_exists()
        task_name = task.value
        state = await self._get_task_state(task_name)

        if state is None:
            state = SystemBootstrapState(
                id=f"boot-{uuid.uuid4().hex[:8]}",
                task_name=task_name,
                status="Pending",
                bootstrap_version=self.version,
                execution_count=0,
            )
            self.db.add(state)
            await self.db.flush()

        if state.status in {"Complete", "Skipped"}:
            logger.info("[Bootstrap] Task '%s' already %s (version=%s). Skipping.", task_name, state.status, state.bootstrap_version)
            return state

        started_at_dt = datetime.now(timezone.utc)
        start_time = time.time()
        state.started_at = started_at_dt
        state.execution_count += 1
        state.bootstrap_version = self.version

        try:
            status, error_msg = await task_func()
            end_time = time.time()

            state.status = status
            state.completed_at = datetime.now(timezone.utc)
            state.duration_ms = int((end_time - start_time) * 1000)
            state.error_message = error_msg
            await self.db.commit()
            return state
        except Exception as exc:
            end_time = time.time()
            state.status = "Failed"
            state.completed_at = datetime.now(timezone.utc)
            state.duration_ms = int((end_time - start_time) * 1000)
            state.error_message = str(exc)
            await self.db.commit()
            logger.exception("[Bootstrap] Task '%s' failed: %s", task_name, exc)
            raise

    # ------------------------------------------------------------------
    # Individual Task Handlers
    # ------------------------------------------------------------------
    async def _task_initial_schema(self) -> tuple[str, Optional[str]]:
        logger.info("[Bootstrap] Database initialized")
        return "Complete", None

    async def _task_seed_roles(self) -> tuple[str, Optional[str]]:
        return "Complete", None

    async def _task_seed_permissions(self) -> tuple[str, Optional[str]]:
        return "Complete", None

    async def _task_seed_super_user(self) -> tuple[str, Optional[str]]:
        existing_super = await self.db.execute(
            select(User).where(User.username == "super", User.is_deleted == False)
        )
        super_user = existing_super.scalars().first()

        if super_user is not None:
            logger.info("[Bootstrap] Super administrator exists")
            return "Complete", None

        if not self._is_dev_login_enabled():
            logger.info("[Bootstrap] Non-development profile detected; default super admin creation skipped")
            return "Skipped", "Production profile: default super admin creation disabled"

        admin = User(
            id=f"usr-{uuid.uuid4().hex[:6]}",
            username="super",
            email="super@smritibooks.com",
            hashed_password=hash_password("whynothing"),
            role=UserRole.SYSADMIN,
            is_active=True,
            is_deleted=False,
            is_platform_admin=True,
            company_id=None,
            branch_id=None,
            status="PendingPasswordChange",
        )
        self.db.add(admin)
        try:
            await self.db.flush()
            logger.info("[Bootstrap] Created development super administrator username=%s", admin.username)
            return "Complete", None
        except IntegrityError as err:
            logger.exception("[Bootstrap] Failed to create super administrator")
            return "Failed", str(err)

    async def _task_legacy_password_reconciliation(self) -> tuple[str, Optional[str]]:
        if not self._is_dev_login_enabled():
            logger.info("[Bootstrap] Production profile detected; legacy admin password reconciliation skipped")
            return "Skipped", "Production environment: password reconciliation disabled"

        logger.info("[Bootstrap] Development profile detected")

        existing_super = await self.db.execute(
            select(User).where(User.username == "super", User.is_deleted == False)
        )
        user = existing_super.scalars().first()

        if not user:
            logger.info("[Bootstrap] Super administrator account not found for legacy reconciliation")
            return "Complete", "No super user found"

        if verify_password("whynothing", user.hashed_password):
            logger.info("[Bootstrap] Super administrator already using convenience password")
            return "Complete", "Already using convenience password"

        legacy_candidates = getattr(
            settings,
            "BOOTSTRAP_LEGACY_PASSWORDS",
            ["Smriti@1234", "Password@123", "Admin@123", "TempPass@123"]
        )

        if not any(verify_password(candidate, user.hashed_password) for candidate in legacy_candidates):
            logger.info("[Bootstrap] Super administrator has custom password; reconciliation skipped")
            return "Complete", "Custom password present; skipped reconciliation"

        user.hashed_password = hash_password("whynothing")
        user.status = "Active"
        self.db.add(user)
        await self.db.flush()
        logger.info("[Bootstrap] Legacy admin password reconciled")
        return "Complete", "Reconciled legacy password to convenience password"

    async def _task_setup_wizard_initialized(self) -> tuple[str, Optional[str]]:
        logger.info("[Bootstrap] Setup wizard initialization state registered")
        return "Complete", None

    # ------------------------------------------------------------------
    # Main Execution Runner with Advisory Locking and Summary Output
    # ------------------------------------------------------------------
    async def run(self) -> None:
        """
        Main entry point for installation bootstrap lifecycle at startup.
        Acquires PostgreSQL advisory lock, executes task phases, and logs final operational summary.
        """
        is_test_env = str(getattr(settings, "ENVIRONMENT", "")).lower() in {"test"}
        lock_acquired = False
        if not is_test_env:
            try:
                lock_res = await self.db.execute(text(f"SELECT pg_try_advisory_lock({self.BOOTSTRAP_LOCK_KEY})"))
                lock_acquired = bool(lock_res.scalar())
                if not lock_acquired:
                    logger.info("[Bootstrap] Another instance holds the installation bootstrap lock. Skipping execution.")
                    return
            except Exception:
                lock_acquired = False


        overall_start = time.time()
        logger.info("[Bootstrap] Starting installation bootstrap (v%s)", self.version)

        tasks_to_run = [
            (BootstrapPhase.PHASE_1_DATABASE, BootstrapTask.INITIAL_SCHEMA, self._task_initial_schema),
            (BootstrapPhase.PHASE_2_SECURITY, BootstrapTask.SEED_ROLES, self._task_seed_roles),
            (BootstrapPhase.PHASE_2_SECURITY, BootstrapTask.SEED_PERMISSIONS, self._task_seed_permissions),
            (BootstrapPhase.PHASE_2_SECURITY, BootstrapTask.SEED_SUPER_USER, self._task_seed_super_user),
            (BootstrapPhase.PHASE_5_POST_INSTALL, BootstrapTask.LEGACY_PASSWORD_RECONCILIATION, self._task_legacy_password_reconciliation),
            (BootstrapPhase.PHASE_5_POST_INSTALL, BootstrapTask.SETUP_WIZARD_INITIALIZED, self._task_setup_wizard_initialized),
        ]

        executed_states = []
        for phase, task_enum, task_fn in tasks_to_run:
            st = await self.execute_task(task_enum, task_fn)
            executed_states.append((phase, task_enum.value, st.status))

        overall_duration_ms = int((time.time() - overall_start) * 1000)

        completed_count = sum(1 for _, _, status in executed_states if status == "Complete")
        skipped_count   = sum(1 for _, _, status in executed_states if status == "Skipped")
        failed_count    = sum(1 for _, _, status in executed_states if status == "Failed")

        summary_lines = [
            "",
            "==================================================",
            "[Bootstrap Summary]",
            f"Version  : {self.version}",
            f"Completed: {completed_count} | Skipped: {skipped_count} | Failed: {failed_count}",
            f"Duration : {overall_duration_ms} ms",
        ]
        for _, tname, status in executed_states:
            symbol = "✓" if status in {"Complete", "Skipped"} else "✗"
            summary_lines.append(f"  {symbol} {tname} [{status}]")
        summary_lines.append("==================================================")
        summary_lines.append("")

        logger.info("\n".join(summary_lines))
        logger.info("[Bootstrap] Bootstrap completed")

        if lock_acquired:
            try:
                await self.db.execute(text(f"SELECT pg_advisory_unlock({self.BOOTSTRAP_LOCK_KEY})"))
            except Exception:
                pass
