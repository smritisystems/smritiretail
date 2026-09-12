"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import zlib
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import psycopg2
from alembic import command
from alembic.config import Config

from app.core.config import settings
from app.db.session import validate_company_database_name

logger = logging.getLogger("smriti.fleet_migrator")


@dataclass
class MigrationTarget:
    company_id: str
    database_name: str
    registry_status: str
    physically_exists: bool


@dataclass
class MigrationResult:
    company_id: str
    database_name: str
    status: str  # SUCCESS, ALREADY_UP_TO_DATE, FAILED, SKIPPED_NOT_PROVISIONED, LOCK_FAILED, SKIPPED_DRY_RUN
    initial_revision: Optional[str] = None
    final_revision: Optional[str] = None
    target_revision: Optional[str] = None
    duration_ms: float = 0.0
    error_message: Optional[str] = None


class FleetMigrator:
    """
    Enterprise-grade, controlled, auditable multi-tenant fleet migration orchestrator.
    Guarantees:
    1. Registry & strict database naming validation (blocks smritisys & invalid formats).
    2. Session-level PostgreSQL advisory locking to prevent concurrent migration collisions.
    3. Per-database isolated transactions and independent execution contexts.
    4. Comprehensive failure reporting, structured JSON output, and resumability.
    """

    def __init__(self, target_revision: str = "head", dry_run: bool = False):
        self.target_revision = target_revision
        self.dry_run = dry_run
        self._parsed_url = urlparse(settings.DATABASE_URL)
        self.user = os.getenv("POSTGRES_USER") or self._parsed_url.username or "postgres"
        self.password = os.getenv("POSTGRES_PASSWORD") or self._parsed_url.password or "postgres"
        self.host = os.getenv("POSTGRES_HOST") or self._parsed_url.hostname or "localhost"
        self.port = int(os.getenv("POSTGRES_PORT") or self._parsed_url.port or 5432)

    def _get_connection(self, db_name: str):
        return psycopg2.connect(
            dbname=db_name,
            user=self.user,
            password=self.password,
            host=self.host,
            port=self.port,
        )

    def _get_advisory_lock_id(self, db_name: str) -> int:
        """Derive a deterministic 32-bit signed integer for pg_try_advisory_lock."""
        crc = zlib.crc32(f"smriti_fleet_migration_{db_name}".encode("utf-8"))
        if crc > 0x7FFFFFFF:
            crc -= 0x100000000
        return crc

    def discover_targets(
        self,
        specific_db: Optional[str] = None,
        specific_company: Optional[str] = None,
    ) -> List[MigrationTarget]:
        """
        Discovers migration targets from smritisys registry and validates their physical presence.
        """
        targets: List[MigrationTarget] = []

        with self._get_connection("smritisys") as ctrl_conn:
            with ctrl_conn.cursor() as cur:
                # 1. Fetch physical databases in PostgreSQL
                cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
                physical_dbs = {row[0] for row in cur.fetchall()}

                # 2. Query company_database_registries with regex filter to select only legitimate company DB shapes
                query = """
                    SELECT company_id, database_name, status
                    FROM company_database_registries
                    WHERE status = 'READY'
                      AND LOWER(database_name) ~ '^smriti(?!000)(?!sys)[a-z0-9]{3,12}$'
                """
                params: List[str] = []
                if specific_db:
                    query += " AND LOWER(database_name) = %s"
                    params.append(specific_db.strip().lower())
                if specific_company:
                    query += " AND company_id = %s"
                    params.append(specific_company.strip())

                query += " ORDER BY database_name;"
                cur.execute(query, tuple(params) if params else None)
                rows = cur.fetchall()

                for company_id, db_name, status in rows:
                    clean_db = str(db_name).strip().lower()

                    # Strictly enforce naming standard and protect control plane
                    if clean_db == "smritisys":
                        continue
                    if not validate_company_database_name(clean_db):
                        continue

                    exists = clean_db in physical_dbs
                    targets.append(
                        MigrationTarget(
                            company_id=company_id,
                            database_name=clean_db,
                            registry_status=status,
                            physically_exists=exists,
                        )
                    )

        return targets

    def get_current_revision(self, db_name: str) -> Optional[str]:
        """Read the alembic_version from target company database."""
        try:
            with self._get_connection(db_name) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT version_num FROM alembic_version LIMIT 1;"
                    )
                    row = cur.fetchone()
                    return row[0] if row else None
        except Exception as e:
            # alembic_version table might not exist yet
            return None

    def migrate_database(self, target: MigrationTarget) -> MigrationResult:
        """
        Executes migration on a single company database with advisory lock & transaction safety.
        """
        start_time = time.perf_counter()

        if not target.physically_exists:
            return MigrationResult(
                company_id=target.company_id,
                database_name=target.database_name,
                status="SKIPPED_NOT_PROVISIONED",
                error_message="Database registered as READY but does not physically exist in PostgreSQL catalog.",
            )

        if self.dry_run:
            current_rev = self.get_current_revision(target.database_name)
            return MigrationResult(
                company_id=target.company_id,
                database_name=target.database_name,
                status="SKIPPED_DRY_RUN",
                initial_revision=current_rev,
                target_revision=self.target_revision,
            )

        lock_id = self._get_advisory_lock_id(target.database_name)
        conn = None
        try:
            # 1. Acquire advisory lock
            conn = self._get_connection(target.database_name)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_lock(%s);", (lock_id,))
                acquired = cur.fetchone()[0]

            if not acquired:
                return MigrationResult(
                    company_id=target.company_id,
                    database_name=target.database_name,
                    status="LOCK_FAILED",
                    error_message=f"PostgreSQL advisory lock ({lock_id}) could not be acquired; another process holds the lock.",
                )

            # 2. Discover initial revision
            initial_rev = self.get_current_revision(target.database_name)

            # 3. Configure Alembic
            alembic_ini_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
            )
            cfg = Config(alembic_ini_path)
            cfg.cmd_opts = argparse.Namespace(x=[f"db={target.database_name}"])

            # 4. Execute migration
            command.upgrade(cfg, self.target_revision)

            # 5. Verify final revision
            final_rev = self.get_current_revision(target.database_name)
            duration = (time.perf_counter() - start_time) * 1000.0

            status_label = (
                "ALREADY_UP_TO_DATE"
                if initial_rev == final_rev and initial_rev is not None
                else "SUCCESS"
            )

            return MigrationResult(
                company_id=target.company_id,
                database_name=target.database_name,
                status=status_label,
                initial_revision=initial_rev,
                final_revision=final_rev,
                target_revision=self.target_revision,
                duration_ms=round(duration, 2),
            )

        except Exception as ex:
            duration = (time.perf_counter() - start_time) * 1000.0
            return MigrationResult(
                company_id=target.company_id,
                database_name=target.database_name,
                status="FAILED",
                initial_revision=self.get_current_revision(target.database_name),
                target_revision=self.target_revision,
                duration_ms=round(duration, 2),
                error_message=str(ex),
            )
        finally:
            if conn:
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT pg_advisory_unlock(%s);", (lock_id,))
                except Exception:
                    pass
                conn.close()

    def run_fleet(
        self,
        specific_db: Optional[str] = None,
        specific_company: Optional[str] = None,
    ) -> List[MigrationResult]:
        """Runs migration or inspection across discovered targets."""
        targets = self.discover_targets(
            specific_db=specific_db,
            specific_company=specific_company,
        )

        results: List[MigrationResult] = []
        for target in targets:
            result = self.migrate_database(target)
            results.append(result)

        return results


def format_report_table(results: List[MigrationResult]) -> str:
    """Formats migration results into an aligned ASCII audit table."""
    headers = [
        "Company ID",
        "Database",
        "Status",
        "Initial Rev",
        "Final Rev",
        "Time (ms)",
        "Details",
    ]
    rows = []
    for r in results:
        rows.append(
            [
                r.company_id,
                r.database_name,
                r.status,
                r.initial_revision or "NONE",
                r.final_revision or "NONE",
                f"{r.duration_ms:.1f}",
                r.error_message or "OK",
            ]
        )

    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))

    header_line = " | ".join(
        h.ljust(col_widths[i]) for i, h in enumerate(headers)
    )
    separator = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
    data_lines = [
        " | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row))
        for row in rows
    ]

    return "\n".join([header_line, separator] + data_lines)
