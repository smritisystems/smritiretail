"""Move canonical size management data from the control plane to one company DB.

This utility intentionally touches only:
- master_types/master_values rows for ``size_group``
- size_groups/size_group_values tables and rows

It does not modify products, item master, attributes, variants, or any other
company data. Run without ``--apply`` to inspect the planned relocation.
"""

from __future__ import annotations

import argparse
import os
import uuid
from dataclasses import dataclass
from typing import Any

import psycopg2
from psycopg2.extras import Json, RealDictCursor


@dataclass(frozen=True)
class DbConfig:
    name: str
    host: str
    port: int
    user: str
    password: str


SIZE_GROUP_DDL = """
CREATE TABLE IF NOT EXISTS size_groups (
    id varchar(100) PRIMARY KEY,
    uuid varchar(36) NOT NULL UNIQUE,
    company_id varchar(50),
    branch_id varchar(50),
    code varchar(100) NOT NULL UNIQUE,
    name varchar(200) NOT NULL,
    category varchar(100) NOT NULL DEFAULT 'GENERAL',
    dimension varchar(100) NOT NULL DEFAULT 'size',
    created_at timestamptz,
    modified_at timestamptz,
    created_by varchar(100),
    updated_by varchar(100),
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    deleted_by varchar(100),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_size_groups_company_id ON size_groups (company_id);
CREATE INDEX IF NOT EXISTS ix_size_groups_branch_id ON size_groups (branch_id);

CREATE TABLE IF NOT EXISTS size_group_values (
    id varchar(50) PRIMARY KEY,
    uuid varchar(36) NOT NULL UNIQUE,
    company_id varchar(50),
    branch_id varchar(50),
    size_group_id varchar(100) NOT NULL REFERENCES size_groups(id) ON DELETE CASCADE,
    value varchar(50) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz,
    modified_at timestamptz,
    created_by varchar(100),
    updated_by varchar(100),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    deleted_by varchar(100),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT uq_size_group_values_group_value UNIQUE (size_group_id, value)
);

CREATE INDEX IF NOT EXISTS ix_size_group_values_size_group_id
    ON size_group_values (size_group_id);
"""


def db_config(name: str) -> DbConfig:
    return DbConfig(
        name=name,
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )


def connect(config: DbConfig):
    return psycopg2.connect(
        dbname=config.name,
        host=config.host,
        port=config.port,
        user=config.user,
        password=config.password,
    )


def fetch_source(source: DbConfig) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    with connect(source) as connection, connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, code, name, data, company_id, branch_id, active
            FROM master_values
            WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'size_group')
              AND is_deleted = FALSE
            ORDER BY code
            """
        )
        registry_rows = [dict(row) for row in cursor.fetchall()]
        if not registry_rows:
            raise RuntimeError("No active size_group registry rows found in the source database.")

        cursor.execute(
            """
            SELECT sg.id, sg.uuid, sg.code, sg.name, sg.category, sg.dimension,
                   sg.company_id, sg.branch_id, sg.is_active,
                   sgv.id AS value_id, sgv.uuid AS value_uuid, sgv.value,
                   sgv.sort_order, sgv.is_active AS value_is_active,
                   sgv.company_id AS value_company_id, sgv.branch_id AS value_branch_id
            FROM size_groups sg
            JOIN size_group_values sgv ON sgv.size_group_id = sg.id
            WHERE sg.is_deleted = FALSE AND sgv.is_deleted = FALSE
            ORDER BY sg.code, sgv.sort_order
            """
        )
        size_rows = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT id, code, label, field_schema, ui_schema, used_in_modules, version, evidence_level FROM master_types WHERE code = 'size_group'")
        size_type = cursor.fetchone()
        if not size_type:
            raise RuntimeError("The source database has no size_group master type.")

    return size_type, size_rows, {"registry": registry_rows}


def ensure_target_schema(cursor) -> None:
    cursor.execute(SIZE_GROUP_DDL)


def copy_to_target(target: DbConfig, size_type: dict[str, Any], size_rows: list[dict[str, Any]], registry: list[dict[str, Any]]) -> None:
    with connect(target) as connection, connection.cursor() as cursor:
        ensure_target_schema(cursor)
        cursor.execute(
            """
            INSERT INTO master_types (id, code, label, field_schema, ui_schema, used_in_modules, version, evidence_level, created_by, created_at)
            VALUES (%s, 'size_group', %s, %s, %s, %s, %s, %s, 'size-relocation', NOW())
            ON CONFLICT (code) DO UPDATE SET
                label = EXCLUDED.label,
                field_schema = EXCLUDED.field_schema,
                ui_schema = EXCLUDED.ui_schema,
                used_in_modules = EXCLUDED.used_in_modules,
                version = EXCLUDED.version,
                evidence_level = EXCLUDED.evidence_level
            RETURNING id
            """,
            (
                str(uuid.uuid4()),
                size_type["label"],
                Json(size_type["field_schema"]),
                Json(size_type["ui_schema"]) if size_type["ui_schema"] is not None else None,
                size_type["used_in_modules"],
                size_type["version"],
                size_type["evidence_level"],
            ),
        )
        target_type_id = cursor.fetchone()[0]

        for row in registry:
            cursor.execute(
                """
                INSERT INTO master_values (id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, NOW(), FALSE)
                ON CONFLICT (id) DO UPDATE SET
                    master_type_id = EXCLUDED.master_type_id,
                    company_id = EXCLUDED.company_id,
                    branch_id = EXCLUDED.branch_id,
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    data = EXCLUDED.data,
                    active = EXCLUDED.active,
                    updated_at = NOW(),
                    is_deleted = FALSE
                """,
                (
                    str(row["id"]),
                    target_type_id,
                    row["company_id"],
                    row["branch_id"],
                    row["code"],
                    row["name"],
                    Json(row["data"]),
                    row["active"],
                ),
            )

        for row in size_rows:
            cursor.execute(
                """
                INSERT INTO size_groups (id, uuid, company_id, branch_id, code, name, category, dimension, created_at, modified_at, created_by, updated_by, is_active, is_deleted, version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), 'size-relocation', 'size-relocation', %s, FALSE, 1)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    dimension = EXCLUDED.dimension,
                    company_id = EXCLUDED.company_id,
                    branch_id = EXCLUDED.branch_id,
                    is_active = EXCLUDED.is_active,
                    is_deleted = FALSE,
                    modified_at = NOW()
                """,
                (
                    row["id"],
                    row["uuid"],
                    row["company_id"],
                    row["branch_id"],
                    row["code"],
                    row["name"],
                    row["category"],
                    row["dimension"],
                    row["is_active"],
                ),
            )
            cursor.execute(
                """
                INSERT INTO size_group_values (id, uuid, company_id, branch_id, size_group_id, value, sort_order, is_active, created_at, modified_at, created_by, updated_by, is_deleted, version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), 'size-relocation', 'size-relocation', FALSE, 1)
                ON CONFLICT (size_group_id, value) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_active = EXCLUDED.is_active,
                    company_id = EXCLUDED.company_id,
                    branch_id = EXCLUDED.branch_id,
                    is_deleted = FALSE,
                    modified_at = NOW()
                """,
                (
                    row["value_id"],
                    row["value_uuid"],
                    row["value_company_id"],
                    row["value_branch_id"],
                    row["id"],
                    row["value"],
                    row["sort_order"],
                    row["value_is_active"],
                ),
            )


def verify_target(target: DbConfig, expected_codes: list[str]) -> None:
    with connect(target) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT sg.code, COUNT(sgv.id)
            FROM size_groups sg
            LEFT JOIN size_group_values sgv ON sgv.size_group_id = sg.id AND sgv.is_deleted = FALSE
            WHERE sg.code = ANY(%s) AND sg.is_deleted = FALSE
            GROUP BY sg.code
            ORDER BY sg.code
            """,
            (expected_codes,),
        )
        rows = cursor.fetchall()
        actual = {code: count for code, count in rows}
        if set(actual) != set(expected_codes) or any(count == 0 for count in actual.values()):
            raise RuntimeError(f"Target verification failed: {actual}")
        print("Target verified:", actual)


def retire_source(source: DbConfig) -> None:
    with connect(source) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            DELETE FROM size_group_values
            WHERE size_group_id IN (SELECT id FROM size_groups WHERE code IN ('APPAREL_ALPHA', 'FOOTWEAR_EU'))
            """
        )
        cursor.execute("DELETE FROM size_groups WHERE code IN ('APPAREL_ALPHA', 'FOOTWEAR_EU')")
        cursor.execute(
            """
            DELETE FROM master_values
            WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'size_group')
            """
        )
        cursor.execute("DELETE FROM master_types WHERE code = 'size_group'")
        print("Retired source size-management rows:", cursor.rowcount, "master type row(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="smritisys")
    parser.add_argument("--target", required=True)
    parser.add_argument("--apply", action="store_true", help="Copy and verify data")
    parser.add_argument("--remove-source", action="store_true", help="Delete source size rows after target verification")
    args = parser.parse_args()

    source = db_config(args.source)
    target = db_config(args.target)
    size_type, size_rows, payload = fetch_source(source)
    codes = sorted({row["code"] for row in payload["registry"]})
    print(f"Plan: move {len(codes)} size groups and {len(size_rows)} ordered values from {args.source} to {args.target}.")
    print("Groups:", ", ".join(codes))
    if not args.apply:
        print("Dry run only. Re-run with --apply to copy data.")
        return

    copy_to_target(target, size_type, size_rows, payload["registry"])
    verify_target(target, codes)
    if args.remove_source:
        retire_source(source)
        print("Source cleanup complete.")


if __name__ == "__main__":
    main()
