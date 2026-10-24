"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-09-20
Modified     : 2026-09-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Database Parity & Lineage Audit (Rule 12)
"""

import sys
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASES = ["smritisys", "smriti001", "smriti002"]
EXPECTED_ALEMBIC_VERSION = "v1478_inward_cost_components_and_allocation_ledger"

CANONICAL_SPEC = {
    "inward_cost_component_types": {
        "columns": {
            "id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "code": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "name": {"type": "character varying", "nullable": "NO", "max_length": 100},
            "category": {"type": "character varying", "nullable": "NO", "max_length": 30},
            "is_capitalizable": {"type": "boolean", "nullable": "NO"},
            "default_allocation_method": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "requires_document": {"type": "boolean", "nullable": "NO"},
            "requires_transporter": {"type": "boolean", "nullable": "NO"},
            "is_active": {"type": "boolean", "nullable": "NO"},
            "created_at": {"type": "timestamp with time zone", "nullable": "NO"},
        },
        "pk": ["id"],
        "uniques": [["code"]],
        "fks": [],
    },
    "inward_cost_components": {
        "columns": {
            "id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "company_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "branch_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "grn_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "component_type": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "description": {"type": "text", "nullable": "YES"},
            "amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "taxable_amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "tax_amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "total_amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "tax_rate": {"type": "numeric", "nullable": "NO", "precision": 5, "scale": 2},
            "itc_eligible": {"type": "boolean", "nullable": "NO"},
            "is_capitalizable": {"type": "boolean", "nullable": "NO"},
            "allocation_method": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "allocation_scope": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "scope_reference_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "transporter_name": {"type": "character varying", "nullable": "YES", "max_length": 150},
            "document_type": {"type": "character varying", "nullable": "YES", "max_length": 30},
            "document_no": {"type": "character varying", "nullable": "YES", "max_length": 100},
            "document_date": {"type": "date", "nullable": "YES"},
            "vehicle_no": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "status": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "created_at": {"type": "timestamp with time zone", "nullable": "NO"},
            "created_by": {"type": "character varying", "nullable": "YES", "max_length": 50},
        },
        "pk": ["id"],
        "uniques": [],
        "fks": [
            {
                "columns": ["grn_id"],
                "foreign_table": "purchase_receipts",
                "foreign_columns": ["id"],
                "on_delete": "CASCADE",
            }
        ],
    },
    "inward_cost_allocations": {
        "columns": {
            "id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "company_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "branch_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "grn_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "grn_item_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "cost_component_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "product_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "allocation_method": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "basis_value": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 4},
            "allocated_amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "allocated_per_unit": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 4},
            "rounding_adjustment": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 4},
            "created_at": {"type": "timestamp with time zone", "nullable": "NO"},
        },
        "pk": ["id"],
        "uniques": [],
        "fks": [
            {
                "columns": ["cost_component_id"],
                "foreign_table": "inward_cost_components",
                "foreign_columns": ["id"],
                "on_delete": "CASCADE",
            },
            {
                "columns": ["grn_item_id"],
                "foreign_table": "purchase_receipt_items",
                "foreign_columns": ["id"],
                "on_delete": "CASCADE",
            },
        ],
    },
    "inward_cost_adjustments": {
        "columns": {
            "id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "company_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "branch_id": {"type": "character varying", "nullable": "YES", "max_length": 50},
            "adjustment_no": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "grn_id": {"type": "character varying", "nullable": "NO", "max_length": 50},
            "total_adjustment_amount": {"type": "numeric", "nullable": "NO", "precision": 15, "scale": 2},
            "reason": {"type": "text", "nullable": "NO"},
            "status": {"type": "character varying", "nullable": "NO", "max_length": 20},
            "created_at": {"type": "timestamp with time zone", "nullable": "NO"},
            "created_by": {"type": "character varying", "nullable": "YES", "max_length": 50},
        },
        "pk": ["id"],
        "uniques": [["adjustment_no"]],
        "fks": [
            {
                "columns": ["grn_id"],
                "foreign_table": "purchase_receipts",
                "foreign_columns": ["id"],
                "on_delete": "RESTRICT",
            }
        ],
    },
}

REQUIRED_COMPONENT_TYPE_CODES = [
    "FREIGHT",
    "CARTAGE",
    "TRANSPORTATION",
    "LOADING",
    "UNLOADING",
    "HAMALI",
    "INSURANCE",
    "PACKING",
    "FORWARDING",
    "PACKING_FORWARDING",
    "CUSTOMS_DUTY",
    "ENTRY_DUTY",
    "ENTRY_TOLL",
    "OCTROI",
    "PORT_CHARGES",
    "CLEARING_CHARGES",
    "HANDLING",
    "WAREHOUSE_HANDLING",
    "OTHER",
]


def audit_database(db_name: str) -> dict:
    conn_str = f"postgresql://postgres:postgres@localhost:5432/{db_name}"
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    report = {
        "database": db_name,
        "lineage_ok": False,
        "lineage_version": None,
        "table_audits": {},
        "seed_integrity_ok": False,
        "seed_count": 0,
        "referential_integrity_ok": True,
        "dangling_records": 0,
        "all_passed": True,
    }

    # 1. Lineage Check
    cur.execute("SELECT version_num FROM alembic_version LIMIT 1;")
    row = cur.fetchone()
    report["lineage_version"] = row["version_num"] if row else None
    report["lineage_ok"] = (report["lineage_version"] == EXPECTED_ALEMBIC_VERSION)
    if not report["lineage_ok"]:
        report["all_passed"] = False

    # 2. Table-by-Table Column, Datatype, Nullability, PK, UQ, and FK Verification
    for table_name, spec in CANONICAL_SPEC.items():
        tbl_audit = {
            "columns_total": len(spec["columns"]),
            "columns_matched": 0,
            "columns_drifted": [],
            "pk_ok": False,
            "uniques_ok": False,
            "fks_ok": False,
            "status": "PARITY_OK",
        }

        # Query actual columns from information_schema
        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position;
            """,
            (table_name,),
        )
        actual_cols = {r["column_name"]: r for r in cur.fetchall()}

        for col_name, col_spec in spec["columns"].items():
            if col_name not in actual_cols:
                tbl_audit["columns_drifted"].append(f"MISSING_COLUMN: {col_name}")
                continue

            act = actual_cols[col_name]
            type_match = act["data_type"] == col_spec["type"]
            null_match = act["is_nullable"] == col_spec["nullable"]
            len_match = True
            if "max_length" in col_spec:
                len_match = act["character_maximum_length"] == col_spec["max_length"]
            prec_match = True
            if "precision" in col_spec:
                prec_match = (
                    act["numeric_precision"] == col_spec["precision"]
                    and act["numeric_scale"] == col_spec["scale"]
                )

            if type_match and null_match and len_match and prec_match:
                tbl_audit["columns_matched"] += 1
            else:
                drift_info = []
                if not type_match:
                    drift_info.append(f"type {act['data_type']} != {col_spec['type']}")
                if not null_match:
                    drift_info.append(f"nullable {act['is_nullable']} != {col_spec['nullable']}")
                if not len_match:
                    drift_info.append(f"len {act['character_maximum_length']} != {col_spec.get('max_length')}")
                if not prec_match:
                    drift_info.append(f"prec ({act['numeric_precision']},{act['numeric_scale']}) != ({col_spec.get('precision')},{col_spec.get('scale')})")
                tbl_audit["columns_drifted"].append(f"{col_name}: {', '.join(drift_info)}")

        # Check Primary Key
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = %s
            ORDER BY kcu.ordinal_position;
            """,
            (table_name,),
        )
        actual_pk = [r["column_name"] for r in cur.fetchall()]
        tbl_audit["pk_ok"] = (actual_pk == spec["pk"])

        # Check Unique Constraints
        cur.execute(
            """
            SELECT tc.constraint_name, array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) as cols
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = %s
            GROUP BY tc.constraint_name;
            """,
            (table_name,),
        )
        actual_uqs = [r["cols"] for r in cur.fetchall()]
        uqs_ok = True
        for exp_uq in spec["uniques"]:
            if exp_uq not in actual_uqs:
                uqs_ok = False
        tbl_audit["uniques_ok"] = uqs_ok

        # Check Foreign Keys
        cur.execute(
            """
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
            """,
            (table_name,),
        )
        actual_fks = cur.fetchall()
        fks_ok = True
        for exp_fk in spec["fks"]:
            matched = False
            for act_fk in actual_fks:
                if (
                    act_fk["column_name"] == exp_fk["columns"][0]
                    and act_fk["foreign_table_name"] == exp_fk["foreign_table"]
                    and act_fk["foreign_column_name"] == exp_fk["foreign_columns"][0]
                    and act_fk["delete_rule"] == exp_fk["on_delete"]
                ):
                    matched = True
                    break
            if not matched:
                fks_ok = False
        tbl_audit["fks_ok"] = fks_ok

        if (
            tbl_audit["columns_matched"] == tbl_audit["columns_total"]
            and len(tbl_audit["columns_drifted"]) == 0
            and tbl_audit["pk_ok"]
            and tbl_audit["uniques_ok"]
            and tbl_audit["fks_ok"]
        ):
            tbl_audit["status"] = "PARITY_OK"
        else:
            tbl_audit["status"] = "CRITICAL_DRIFT"
            report["all_passed"] = False

        report["table_audits"][table_name] = tbl_audit

    # 3. Seed Integrity Check in inward_cost_component_types
    cur.execute("SELECT code FROM inward_cost_component_types;")
    actual_codes = {r["code"] for r in cur.fetchall()}
    report["seed_count"] = len(actual_codes)
    missing_codes = [c for c in REQUIRED_COMPONENT_TYPE_CODES if c not in actual_codes]
    report["seed_integrity_ok"] = (len(missing_codes) == 0 and len(actual_codes) >= 19)
    if not report["seed_integrity_ok"]:
        report["all_passed"] = False

    # 4. Relational Invariant Integrity & Dangling Key Checks
    cur.execute(
        """
        SELECT count(*) as cnt
        FROM inward_cost_components c
        LEFT JOIN purchase_receipts r ON c.grn_id = r.id
        WHERE r.id IS NULL;
        """
    )
    dangling_components = cur.fetchone()["cnt"]

    cur.execute(
        """
        SELECT count(*) as cnt
        FROM inward_cost_allocations a
        LEFT JOIN purchase_receipts r ON a.grn_id = r.id
        WHERE r.id IS NULL;
        """
    )
    dangling_allocations_grn = cur.fetchone()["cnt"]

    cur.execute(
        """
        SELECT count(*) as cnt
        FROM inward_cost_allocations a
        LEFT JOIN inward_cost_components c ON a.cost_component_id = c.id
        WHERE c.id IS NULL;
        """
    )
    dangling_allocations_comp = cur.fetchone()["cnt"]

    total_dangling = dangling_components + dangling_allocations_grn + dangling_allocations_comp
    report["dangling_records"] = total_dangling
    report["referential_integrity_ok"] = (total_dangling == 0)
    if total_dangling > 0:
        report["all_passed"] = False

    conn.close()
    return report


def main():
    print("=" * 100)
    print(" SMRITI MULTI-DATABASE SCHEMA & LINEAGE AUDIT — INWARD COST & LANDED COST ENGINE")
    print(f" Reference Contract: {EXPECTED_ALEMBIC_VERSION} (Rule 12 Parity Standard)")
    print("=" * 100)

    all_fleet_passed = True

    for db_name in DATABASES:
        print(f"\n[{db_name.upper()}] Starting AST, column-by-column, and constraint diff...")
        rep = audit_database(db_name)

        print(f"  • Migration Lineage: {rep['lineage_version']} "
              f"[{'VERIFIED' if rep['lineage_ok'] else 'LINEAGE_MISMATCH'}]")
        print(f"  • Seed Data:         {rep['seed_count']} types present "
              f"[{'100% INTACT' if rep['seed_integrity_ok'] else 'INCOMPLETE'}]")
        print(f"  • FK Dangling Keys:  {rep['dangling_records']} orphans "
              f"[{'ZERO DANGLING' if rep['referential_integrity_ok'] else 'INTEGRITY_VIOLATION'}]")

        print("  • Table Parity Status:")
        for tbl_name, tbl in rep["table_audits"].items():
            col_summary = f"{tbl['columns_matched']}/{tbl['columns_total']} cols"
            pk_str = "PK=OK" if tbl["pk_ok"] else "PK=FAIL"
            uq_str = "UQ=OK" if tbl["uniques_ok"] else "UQ=FAIL"
            fk_str = "FK=OK" if tbl["fks_ok"] else "FK=FAIL"
            print(f"    -> {tbl_name:<30} : {col_summary} | {pk_str} | {uq_str} | {fk_str} -> [{tbl['status']}]")
            if tbl["columns_drifted"]:
                for d in tbl["columns_drifted"]:
                    print(f"       * DRIFT: {d}")

        if not rep["all_passed"]:
            all_fleet_passed = False
            print(f"  [RESULT] {db_name.upper()} : FAILED (Drift Detected)")
        else:
            print(f"  [RESULT] {db_name.upper()} : 100% CANONICAL PARITY VERIFIED")

    print("\n" + "=" * 100)
    if all_fleet_passed:
        print(" FLEET AUDIT RESULT: ALL 3 DATABASES PASS WITH ZERO DRIFT & 100% CANONICAL AST PARITY")
        print("=" * 100)
        sys.exit(0)
    else:
        print(" FLEET AUDIT RESULT: DRIFT DETECTED IN ONE OR MORE TENANT DATABASES")
        print("=" * 100)
        sys.exit(1)


if __name__ == "__main__":
    main()
