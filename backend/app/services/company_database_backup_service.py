"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-12
Classification: Isolated Per-Company Database Backup & Restore Tool
"""

import os
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.db.company_base import CompanyBase
from app.services.control_database_registry import ControlDatabaseRegistryService


@dataclass
class BackupMetadata:
    company_code: str
    db_name: str
    backup_file_path: str
    file_size_bytes: int
    sha256_checksum: str
    table_row_counts: Dict[str, int]
    created_at: datetime


@dataclass
class RestoreResult:
    company_code: str
    db_name: str
    success: bool
    restored_tables_count: int
    restored_at: datetime
    message: str


class CompanyDatabaseBackupService:
    """
    CompanyDatabaseBackupService — Isolated per-company PostgreSQL database backup & restore tool.

    Ensures that backing up or restoring Company A database operates strictly on smriti_company_a
    and does NOT alter Control DB, Secondary Master Hub, or Company B database.
    """

    @classmethod
    async def backup_company_database(
        cls,
        control_db: AsyncSession,
        company_code: str,
        backup_dir: str,
    ) -> BackupMetadata:
        """
        Generates an isolated SQL dump file for a target company database.
        Computes SHA-256 checksum and table row count metadata.
        """
        clean_code = company_code.strip().upper()
        db_meta = await ControlDatabaseRegistryService.get_company_database(control_db, clean_code)

        os.makedirs(backup_dir, exist_ok=True)
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{db_meta.db_name}_{timestamp_str}.sql"
        backup_path = os.path.join(backup_dir, backup_filename)

        conn_url = ControlDatabaseRegistryService.build_connection_url(db_meta)
        engine = create_async_engine(conn_url)

        table_row_counts: Dict[str, int] = {}
        sql_statements: List[str] = [
            f"-- SMRITI Isolated Backup for Company {clean_code} ({db_meta.db_name})\n",
            f"-- Generated At: {datetime.now(timezone.utc).isoformat()}\n\n"
        ]

        async with engine.connect() as conn:
            # Query row counts and export table rows
            for table_name, table in CompanyBase.metadata.tables.items():
                try:
                    cnt_res = await conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    row_cnt = cnt_res.scalar() or 0
                    table_row_counts[table_name] = row_cnt

                    rows_res = await conn.execute(text(f"SELECT * FROM {table_name}"))
                    rows = rows_res.all()
                    if rows:
                        col_names = ", ".join(rows_res.keys())
                        sql_statements.append(f"-- Table: {table_name} ({len(rows)} rows)\n")
                        for r in rows:
                            vals = []
                            for v in r:
                                if v is None:
                                    vals.append("NULL")
                                elif isinstance(v, (int, float)):
                                    vals.append(str(v))
                                elif isinstance(v, bool):
                                    vals.append("TRUE" if v else "FALSE")
                                elif isinstance(v, list):
                                    if not v:
                                        vals.append("'{}'")
                                    else:
                                        escaped_items = [str(item).replace("'", "''") for item in v]
                                        vals.append(f"'{{{','.join(escaped_items)}}}'")
                                else:
                                    escaped = str(v).replace("'", "''")
                                    vals.append(f"'{escaped}'")
                            val_str = ", ".join(vals)
                            sql_statements.append(f"INSERT INTO {table_name} ({col_names}) VALUES ({val_str});\n")
                        sql_statements.append("\n")
                except Exception:
                    table_row_counts[table_name] = 0

        await engine.dispose()

        full_content = "".join(sql_statements)
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(full_content)

        file_size = os.path.getsize(backup_path)
        sha256_hash = hashlib.sha256(full_content.encode("utf-8")).hexdigest()

        return BackupMetadata(
            company_code=clean_code,
            db_name=db_meta.db_name,
            backup_file_path=backup_path,
            file_size_bytes=file_size,
            sha256_checksum=sha256_hash,
            table_row_counts=table_row_counts,
            created_at=datetime.now(timezone.utc),
        )

    @classmethod
    async def restore_company_database(
        cls,
        control_db: AsyncSession,
        company_code: str,
        backup_file_path: str,
    ) -> RestoreResult:
        """
        Restores a single company database from backup file in complete isolation.
        """
        clean_code = company_code.strip().upper()
        if not os.path.exists(backup_file_path):
            raise FileNotFoundError(f"Backup file not found at: {backup_file_path}")

        db_meta = await ControlDatabaseRegistryService.get_company_database(control_db, clean_code)
        conn_url = ControlDatabaseRegistryService.build_connection_url(db_meta)
        engine = create_async_engine(conn_url)

        with open(backup_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        clean_lines = []
        for line in content.splitlines():
            line_str = line.strip()
            if line_str and not line_str.startswith("--"):
                clean_lines.append(line_str)

        full_sql = "\n".join(clean_lines)
        statements = [stmt.strip() for stmt in full_sql.split(";") if stmt.strip()]

        restored_count = 0
        async with engine.begin() as conn:
            for stmt in statements:
                if stmt.upper().startswith("INSERT INTO"):
                    await conn.execute(text(stmt))
                    restored_count += 1

        await engine.dispose()

        return RestoreResult(
            company_code=clean_code,
            db_name=db_meta.db_name,
            success=True,
            restored_tables_count=restored_count,
            restored_at=datetime.now(timezone.utc),
            message=f"Successfully restored {restored_count} records into company DB {db_meta.db_name}.",
        )
