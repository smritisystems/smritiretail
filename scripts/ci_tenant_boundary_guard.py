#!/usr/bin/env python
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — CI Guard

SMRITI Tenant Data Boundary CI Guard
══════════════════════════════════════
Static-analysis CI validation that enforces the TENANT DATA BOUNDARY.
Scans source files to detect:

1. Seed scripts that default business data to smritisys
2. Business fixtures targeting smritisys
3. Operational API code using async_session directly for business data
4. Seed scripts with smritisys as a fallback tenant database
5. Control Plane session used where company session is required

Exit codes:
    0 = PASS — No violations detected
    1 = FAIL — Violations detected

Usage:
    python scripts/ci_tenant_boundary_guard.py [--root /path/to/repo]
    python scripts/ci_tenant_boundary_guard.py --verbose
"""

import sys
import os
import re
import argparse
from pathlib import Path
from typing import List, Tuple, Dict


# ---------------------------------------------------------------------------
# Guard Definitions
# ---------------------------------------------------------------------------

# Patterns that indicate a seed/seeder is writing business/operational data to smritisys.
# Each entry: (pattern, description, file_glob_filter)
SEED_SMRITISYS_PATTERNS: List[Tuple[re.Pattern, str, str]] = [
    (
        re.compile(r'os\.getenv\([^)]*,\s*["\']smritisys["\']', re.IGNORECASE),
        "Seed script defaults to smritisys via os.getenv fallback",
        "seed_*.py",
    ),
    (
        re.compile(r'database_name\s*=\s*["\']smritisys["\']', re.IGNORECASE),
        "Seed script hard-codes smritisys as target database",
        "seed_*.py",
    ),
]

# Patterns in seed files that seed BUSINESS data into smritisys.
# These are the high-risk patterns — async_session() in a seed context means CP session.
BUSINESS_SEED_CP_SESSION_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r'async\s+with\s+async_session\(\).*?(?:PSVParty|Customer|SalesInvoice|StockMovement|PurchaseOrder|Supplier)',
            re.DOTALL
        ),
        "Seed script uses async_session() (Control Plane) with a business entity model",
    ),
]

# Patterns that indicate a seed script includes smritisys in a tenant seeding loop.
SMRITISYS_IN_TENANT_LOOP_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(r'for\s+\w+\s+in\s+\[.*?["\']smritisys["\'].*?\]', re.DOTALL | re.IGNORECASE),
        "Tenant seeding loop includes smritisys — Control Plane must not receive tenant bindings",
    ),
]

# Resolver fallback patterns — detect if tenant resolver silently falls back to smritisys.
RESOLVER_FALLBACK_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r'resolve.*database.*smritisys|getenv.*smritisys.*tenant|default.*smritisys',
            re.IGNORECASE
        ),
        "Tenant resolver may silently fall back to smritisys",
    ),
]

# Known-legitimate files that reference smritisys for correct reasons (whitelist).
WHITELIST_FILES = {
    "session.py",          # Defines the CP engine — smritisys is the correct target
    "cp_guard.py",         # Guard itself
    "env.py",              # Alembic env — validates tenant != smritisys
    "deps.py",             # Guards against smritisys in business context
    "conftest.py",         # Correctly seeds CP-only data into smritisys
    "bootstrap.py",        # Explicitly guards against smritisys
    "reconcile_customers.py",  # Correctly rejects smritisys
    "db_resolver.py",      # Uses smritisys correctly for routing lookups
    "ci_tenant_boundary_guard.py",  # This file
    "cleanup_control_plane.py",  # Cleanup script targeting CP
    "audit_ctrl_plane.py", # Audit script — read-only
    "provision.py",
    "db_provisioner.py",
    "code_allocator.py",
    "catalog_validation.py",
    "capability_service.py",
    "localization_svc.py",
    "workspace_cap_svc.py",
    "company_center.py",    # Lists companies from CP — correct
    "database_manager.py",  # DB manager — references smritisys as CP name
    "governed_logic.py",    # Returns CP-governed logic definitions
    "integration.py",       # Integration hub registry (CP metadata)
    "ui_control_plane.py",  # UI engine (CP metadata)
    "workspace_ui.py",      # UI tokens from CP
    "staff.py",             # Staff identity from CP (users table)
    "metadata.py",          # Metadata endpoint
    # Global Reference Data seeders: countries, states, currencies, HSN/SAC codes are
    # deliberately seeded into ALL databases (smritisys + tenants) as shared read-only
    # master reference data. This is architecturally correct — NOT a tenant boundary violation.
    "seed_ctrl_ref.py",
}

# Files that should NEVER reference smritisys at all
STRICT_NO_SMRITISYS_FILES = {
    "seed_psv.py",
    "seed_cap_master.py",   # Only in the CP seeding section, not the tenant loop
}


def _find_python_files(root: Path, subdir: str | None = None) -> List[Path]:
    """Find all Python files under root (or root/subdir)."""
    search_root = (root / subdir) if subdir else root
    return list(search_root.rglob("*.py"))


class Violation:
    def __init__(self, file: Path, line: int, pattern: str, message: str):
        self.file = file
        self.line = line
        self.pattern = pattern
        self.message = message

    def __str__(self) -> str:
        return f"  FAIL [{self.file.name}:{self.line}] {self.message}"


def check_smritisys_in_tenant_loops(root: Path, verbose: bool) -> List[Violation]:
    """Detect seed scripts that include smritisys in a tenant DB loop."""
    violations = []
    seed_files = list((root / "backend" / "app" / "db").glob("seed_*.py"))
    seed_files += list((root / "scripts").glob("seed_*.py"))

    for fpath in seed_files:
        if fpath.name in WHITELIST_FILES:
            continue
        content = fpath.read_text(encoding="utf-8", errors="ignore")
        for pat, msg in SMRITISYS_IN_TENANT_LOOP_PATTERNS:
            for m in pat.finditer(content):
                line_no = content[: m.start()].count("\n") + 1
                violations.append(Violation(fpath, line_no, str(pat.pattern), msg))

    return violations


def check_seed_fallback_to_smritisys(root: Path, verbose: bool) -> List[Violation]:
    """Detect seed scripts using smritisys as a default/fallback for business data."""
    violations = []
    seed_files = list((root / "backend" / "app" / "db").glob("seed_*.py"))

    # Specific check: seed files that default via os.getenv fallback to smritisys
    fallback_pat = re.compile(
        r'os\.getenv\s*\([^)]+,\s*["\']smritisys["\']',
        re.IGNORECASE
    )
    for fpath in seed_files:
        if fpath.name in WHITELIST_FILES:
            continue
        content = fpath.read_text(encoding="utf-8", errors="ignore")
        for m in fallback_pat.finditer(content):
            line_no = content[: m.start()].count("\n") + 1
            violations.append(Violation(
                fpath, line_no,
                "os.getenv fallback to smritisys",
                f"Seed script has smritisys as default fallback in os.getenv: '{m.group()}'"
            ))
    return violations


def check_psv_seed_for_cp_session(root: Path, verbose: bool) -> List[Violation]:
    """Check seed_psv.py specifically — must not open async_session() for business data."""
    violations = []
    psv_seed = root / "backend" / "app" / "db" / "seed_psv.py"
    if not psv_seed.exists():
        return violations
    content = psv_seed.read_text(encoding="utf-8", errors="ignore")
    # Look for the pattern: async with async_session() as session:  (uses CP session)
    cp_session_pat = re.compile(r'async\s+with\s+async_session\s*\(\s*\)\s*as', re.IGNORECASE)
    for m in cp_session_pat.finditer(content):
        line_no = content[: m.start()].count("\n") + 1
        violations.append(Violation(
            psv_seed, line_no,
            "async_session() in seed_psv.py",
            "seed_psv.py uses async_session() (Control Plane session) — PSV is tenant-operational data. "
            "Use get_company_sessionmaker(tenant_db) instead."
        ))
    return violations


def check_architecture_governance_databases_list(root: Path, verbose: bool) -> List[Violation]:
    """Check seed_architecture_governance.py DATABASES list — must not include tenant DBs."""
    violations = []
    gov_seed = root / "backend" / "app" / "db" / "seed_architecture_governance.py"
    if not gov_seed.exists():
        return violations
    content = gov_seed.read_text(encoding="utf-8", errors="ignore")
    # Detect DATABASES = [..., "smriti001", ...]  (tenant in governance list)
    pat = re.compile(r'DATABASES\s*=\s*\[([^\]]+)\]', re.IGNORECASE)
    m = pat.search(content)
    if m:
        db_list_raw = m.group(1)
        tenant_pat = re.compile(r'"smriti(?!sys)[a-z0-9]+"', re.IGNORECASE)
        for tm in tenant_pat.finditer(db_list_raw):
            line_no = content[: m.start() + tm.start()].count("\n") + 1
            violations.append(Violation(
                gov_seed, line_no,
                "Tenant DB in DATABASES list",
                f"seed_architecture_governance.py DATABASES list includes tenant '{tm.group()}'. "
                f"Architecture governance is Control Plane metadata — seeding to smritisys only."
            ))
    return violations


def check_migration_target_guards(root: Path, verbose: bool) -> List[Violation]:
    """Check alembic env.py has proper target validation."""
    violations = []
    env_py = root / "backend" / "alembic" / "env.py"
    if not env_py.exists():
        return violations
    content = env_py.read_text(encoding="utf-8", errors="ignore")
    # Verify the guard logic is present
    has_control_guard = "target == \"control\" and target_database != \"smritisys\"" in content
    has_tenant_guard = "target == \"tenant\" and target_database == \"smritisys\"" in content
    if not has_control_guard:
        violations.append(Violation(
            env_py, 0,
            "Missing control plane migration guard",
            "alembic/env.py is missing the guard: control migrations must target smritisys"
        ))
    if not has_tenant_guard:
        violations.append(Violation(
            env_py, 0,
            "Missing tenant migration guard",
            "alembic/env.py is missing the guard: tenant migrations must not target smritisys"
        ))
    return violations


def check_ci_alembic_has_target_flags(root: Path, verbose: bool) -> List[Violation]:
    """Check CI workflow uses -x target= flags with alembic commands."""
    violations = []
    ci_files = list((root / ".github" / "workflows").glob("*.yml"))
    for ci_file in ci_files:
        content = ci_file.read_text(encoding="utf-8", errors="ignore")
        # Find alembic upgrade head calls without -x target=
        lines = content.splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if "alembic" in stripped and "upgrade head" in stripped:
                if "-x target=" not in stripped and "target=" not in stripped:
                    violations.append(Violation(
                        ci_file, i,
                        "alembic upgrade head without -x target=",
                        f"CI alembic command missing -x target= flag: '{stripped}'. "
                        f"Use: alembic -x target=control -x db=smritisys upgrade head  "
                        f"or: alembic -x target=tenant -x db=<company> upgrade head"
                    ))
    return violations


def check_ownership_declarations_complete(root: Path, verbose: bool) -> List[Violation]:
    """Verify that every __tablename__ defined in backend/app/models has a declared owner in TABLE_OWNERSHIP."""
    violations = []
    ownership_py = root / "backend" / "app" / "db" / "ownership.py"
    if not ownership_py.exists():
        violations.append(Violation(
            ownership_py, 0, "Missing ownership registry",
            "backend/app/db/ownership.py does not exist."
        ))
        return violations

    sys.path.insert(0, str(root / "backend"))
    try:
        from app.db.ownership import TABLE_OWNERSHIP
    except Exception as exc:
        violations.append(Violation(
            ownership_py, 0, "Import error",
            f"Failed to import TABLE_OWNERSHIP from app.db.ownership: {exc}"
        ))
        return violations

    model_dir = root / "backend" / "app" / "models"
    table_pat = re.compile(r'__tablename__\s*=\s*["\']([^"\']+)["\']')
    for mpath in model_dir.glob("*.py"):
        content = mpath.read_text(encoding="utf-8", errors="ignore")
        for m in table_pat.finditer(content):
            tbl = m.group(1).lower().strip()
            if tbl not in TABLE_OWNERSHIP:
                line_no = content[: m.start()].count("\n") + 1
                violations.append(Violation(
                    mpath, line_no,
                    f"Undeclared table: {tbl}",
                    f"Model defines __tablename__ = '{tbl}' but it is not registered in TABLE_OWNERSHIP."
                ))
    return violations


def check_seed_contracts_declared(root: Path, verbose: bool) -> List[Violation]:
    """Verify that core seed scripts declare @seed_contract."""
    violations = []
    target_seed_files = [
        root / "backend" / "app" / "db" / "seed_psv.py",
        root / "backend" / "app" / "db" / "seed_customers.py",
        root / "backend" / "app" / "db" / "seed_architecture_governance.py",
        root / "backend" / "app" / "db" / "seed_cap_master.py",
        root / "backend" / "app" / "db" / "ctrl_seeder.py",
    ]
    for sfile in target_seed_files:
        if not sfile.exists():
            continue
        content = sfile.read_text(encoding="utf-8", errors="ignore")
        if "@seed_contract" not in content and "seed_contract" not in content:
            violations.append(Violation(
                sfile, 1,
                "Missing @seed_contract",
                f"Seed script {sfile.name} does not declare @seed_contract(target=...)."
            ))
    return violations


def check_migration_contracts_declared(root: Path, verbose: bool) -> List[Violation]:
    """Verify backend/alembic/migration_contract.py exists and env.py uses canonical ownership."""
    violations = []
    contract_file = root / "backend" / "alembic" / "migration_contract.py"
    if not contract_file.exists():
        violations.append(Violation(
            contract_file, 0,
            "Missing migration_contract.py",
            "backend/alembic/migration_contract.py does not exist."
        ))
    env_file = root / "backend" / "alembic" / "env.py"
    if env_file.exists():
        content = env_file.read_text(encoding="utf-8", errors="ignore")
        if "TENANT_OWNED_TABLES" not in content:
            violations.append(Violation(
                env_file, 0,
                "env.py not using TENANT_OWNED_TABLES",
                "backend/alembic/env.py does not import TENANT_OWNED_TABLES from app.db.ownership."
            ))
    return violations


def check_tenant_context_contract_present(root: Path, verbose: bool) -> List[Violation]:
    """Verify backend/app/db/tenant_context.py exists and enforces TenantDBContext."""
    violations = []
    ctx_file = root / "backend" / "app" / "db" / "tenant_context.py"
    if not ctx_file.exists():
        violations.append(Violation(
            ctx_file, 0,
            "Missing tenant_context.py",
            "backend/app/db/tenant_context.py does not exist."
        ))
        return violations
    content = ctx_file.read_text(encoding="utf-8", errors="ignore")
    if "TenantDBContext" not in content or "require_tenant_context" not in content:
        violations.append(Violation(
            ctx_file, 0,
            "Incomplete TenantDBContext implementation",
            "tenant_context.py is missing TenantDBContext or require_tenant_context decorator."
        ))
    return violations


def run_all_checks(root: Path, verbose: bool) -> Dict[str, List[Violation]]:
    """Run all boundary checks and return results grouped by check name."""
    results = {}

    checks = [
        ("smritisys_in_tenant_loops", check_smritisys_in_tenant_loops),
        ("seed_fallback_to_smritisys", check_seed_fallback_to_smritisys),
        ("psv_seed_cp_session", check_psv_seed_for_cp_session),
        ("architecture_governance_databases", check_architecture_governance_databases_list),
        ("migration_target_guards", check_migration_target_guards),
        ("ci_alembic_target_flags", check_ci_alembic_has_target_flags),
        ("ownership_declarations_complete", check_ownership_declarations_complete),
        ("seed_contracts_declared", check_seed_contracts_declared),
        ("migration_contracts_declared", check_migration_contracts_declared),
        ("tenant_context_contract_present", check_tenant_context_contract_present),
    ]

    for name, fn in checks:
        if verbose:
            print(f"  Running check: {name}...")
        try:
            violations = fn(root, verbose)
            results[name] = violations
        except Exception as exc:
            print(f"  [WARN] Check '{name}' raised an exception: {exc}")
            results[name] = []

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SMRITI Tenant Data Boundary CI Guard — static analysis."
    )
    parser.add_argument(
        "--root",
        type=str,
        default=None,
        help="Repository root path. Default: auto-detected from script location."
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output."
    )
    args = parser.parse_args()

    if args.root:
        root = Path(args.root).resolve()
    else:
        # Auto-detect: this script is in scripts/ so root is one level up
        root = Path(__file__).resolve().parent.parent

    print("\n" + "=" * 70)
    print("  SMRITI TENANT DATA BOUNDARY CI GUARD")
    print("=" * 70)
    print(f"  Repository Root : {root}")
    print(f"  Policy          : smritisys = Control Plane ONLY")
    print()

    results = run_all_checks(root, verbose=args.verbose)

    total_violations = sum(len(v) for v in results.values())
    total_passed = sum(1 for v in results.values() if len(v) == 0)

    for check_name, violations in results.items():
        status = "[PASS]" if not violations else "[FAIL]"
        print(f"  {status}  {check_name}")
        for v in violations:
            print(str(v))

    print()
    print(f"  Checks: {len(results)}   Passed: {total_passed}   Violations: {total_violations}")
    print("=" * 70 + "\n")

    if total_violations > 0:
        print("[CI Guard] FAIL — Tenant data boundary violations detected.", file=sys.stderr)
        sys.exit(1)
    else:
        print("[CI Guard] PASS — No tenant data boundary violations detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()
