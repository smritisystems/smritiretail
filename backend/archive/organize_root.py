import os
import shutil
import glob
from pathlib import Path

backend_dir = Path("F:/SMRITRretailNX/backend")
diag_dir = backend_dir / "archive" / "diagnostic_reports"
scratch_dir = backend_dir / "archive" / "debug_scratch"

diag_dir.mkdir(parents=True, exist_ok=True)
scratch_dir.mkdir(parents=True, exist_ok=True)

reports = [
    "pytest_output.txt", "pytest_output_ascii.txt", "pytest_full_output.txt",
    "pytest_full_detailed.txt", "pytest_full_reconciliation.txt", "pytest_fail.txt",
    "test_results.txt", "test_results_final.txt", "test_results_full.txt",
    "purchase_test_output.txt", "sales_test_output.txt", "migration_test_output.txt",
    "phase1_alembic_output.txt", "phase1_upgrade_output.txt", "html_forensic_breakdown.json",
    "html_language_share_audit.json", "schema_integrity_report.json", "gate_auth.txt",
    "lint-output.txt", "mypy-baseline.txt", "alembic_status.txt", "final_gate_full_backend.txt",
    "REGRESSION_FAILURE_ANALYSIS.txt", "EXACT_SCHEMA_ANALYSIS.txt", "STAGING_RECONCILIATION_REPORT.txt",
    "staging_regression_gate.txt", "staging_reconciliation_run.log", "staging_validation_run.log",
    "regression_analysis.log", "DIAGNOSTIC_REPORT_G09_PAYMENT_SCHEMA.md"
]

for r in reports:
    fpath = backend_dir / r
    if fpath.is_file():
        shutil.move(str(fpath), str(diag_dir / r))
        print(f"Moved report: {r}")

patterns = [
    "tmp_*.py", "phase*.py", "check_*.py", "analyze_*.py", "reconcile_*.py", "staging_*.py",
    "fresh_db_parity_proof.py", "debug_crm_service.py", "debug_return_trace.py",
    "diagnose_schema.py", "drop_trigger.py", "cleanup_old_revision.py", "clone_databases.sql",
    "create_staging_clones.py", "create_test_db.py", "inspect_payment_schema.py",
    "list_barcodes_cli.py", "query_users.py", "stamp_migrations_smriti001.py",
    "temp_check_cols.py", "terminate_sessions.py", "test_authenticated.py",
    "test_cloning.py", "test_tenants_direct.py", "test_training_read.py",
    "verify_canonical_tables.py", "verify_migration.py", "verify_perm_schema.py",
    "verify_schema_columns.py", "verify_schema_migration_integrity.py",
    "generate_secrets.py", "generate_tt_tax_in.py"
]

for pat in patterns:
    for f in glob.glob(str(backend_dir / pat)):
        p = Path(f)
        if p.is_file():
            shutil.move(str(p), str(scratch_dir / p.name))
            print(f"Moved scratch script: {p.name}")

print("Clean up completed successfully.")
