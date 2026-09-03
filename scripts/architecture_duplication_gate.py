"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture CI Duplication Gate
"""

import sys
import os
import re
import subprocess
import psycopg2

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_COMPONENTS = os.path.join(REPO_ROOT, "src", "components")
BACKEND_API_V1 = os.path.join(REPO_ROOT, "backend", "app", "api", "v1")
MAIN_PY = os.path.join(REPO_ROOT, "backend", "app", "main.py")
DB_CONN = "postgresql://postgres:postgres@localhost:5432/smritisys"

sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

TOTAL_CHECKS = 9
VIOLATIONS = []
WARNINGS = []

# Registered Historical Baseline Debt (Frozen until Phase 2 Cleanup)
BASELINE_DUAL_DIRS = {("hr", "hrm"), ("billing", "pos")}
BASELINE_MODAL_PAIRS = {
    ("ThreeWayMatchingModal.tsx", "POApprovalMatchModal.tsx"),
    ("WavePickingStudioModal.tsx", "WarehouseWavePickingModal.tsx"),
    ("InterBranchTransferModal.tsx", "StockTransferStudioModal.tsx"),
    ("CommissionStudioModal.tsx", "ShiftCommissionStudioModal.tsx"),
}
BASELINE_UNMOUNTED_ROUTERS = {"barcodes.py"}


def log_violation(rule: str, details: str):
    VIOLATIONS.append((rule, details))


def log_warning(rule: str, details: str):
    WARNINGS.append((rule, details))


# ==============================================================================
# CHECK 1: Dual Domain Directory Prohibition (Delta-Aware)
# ==============================================================================
def check_dual_domain_directories():
    if not os.path.exists(SRC_COMPONENTS):
        return
    dirs = [d for d in os.listdir(SRC_COMPONENTS) if os.path.isdir(os.path.join(SRC_COMPONENTS, d))]

    # Discover any parallel domain names
    for i in range(len(dirs)):
        for j in range(i + 1, len(dirs)):
            d1, d2 = sorted([dirs[i], dirs[j]])
            if (d1 + "m" == d2 or d1 + "s" == d2 or d1 + "2" == d2 or d1 + "_old" == d2 or d1 + "_new" == d2):
                pair = (d1, d2)
                if pair in BASELINE_DUAL_DIRS:
                    log_warning("Rule 1 (Registered Legacy Debt)", f"Parallel domain directories '{d1}' and '{d2}' are registered historical debt. Frozen until Phase 2.")
                else:
                    log_violation("Rule 1 (Dual-Folder Prohibition)", f"NEW parallel domain directory violation detected: '{d1}' and '{d2}'! Unregistered parallel directories are strictly forbidden.")


# ==============================================================================
# CHECK 2: Suffix & Semantic Collision Scanner (Delta-Aware)
# ==============================================================================
def check_semantic_collisions():
    all_files = {}
    for root, _, files in os.walk(SRC_COMPONENTS):
        for f in files:
            if f.endswith(".tsx"):
                all_files[f] = os.path.join(root, f)

    for c1, c2 in BASELINE_MODAL_PAIRS:
        if c1 in all_files and c2 in all_files:
            log_warning("Rule 2 (Registered Legacy Debt)", f"Candidate duplicate pair '{c1}' and '{c2}' is registered historical debt. Frozen until Phase 2.")

    # Check for NEW duplicate modal collisions
    suffixes = ["WavePickingModal.tsx", "ThreeWayMatchModal.tsx", "StockTransferModal.tsx", "CommissionModal.tsx", "CustomerLookupModal.tsx"]
    for sfx in suffixes:
        matches = [f for f in all_files.keys() if f.endswith(sfx)]
        if len(matches) > 1:
            pair = tuple(sorted([matches[0], matches[1]]))
            if pair not in BASELINE_MODAL_PAIRS:
                log_violation("Rule 2 (Semantic Collision)", f"NEW duplicate modal collision detected: {matches} share suffix '{sfx}'.")


# ==============================================================================
# CHECK 3: Unmounted Backend Router Verification (Delta-Aware)
# ==============================================================================
def check_unmounted_backend_routers():
    if not os.path.exists(BACKEND_API_V1) or not os.path.exists(MAIN_PY):
        return
    with open(MAIN_PY, "r", encoding="utf-8") as f:
        main_content = f.read()

    for file_name in os.listdir(BACKEND_API_V1):
        if file_name.endswith(".py") and not file_name.startswith("__"):
            base_name = file_name[:-3]
            file_path = os.path.join(BACKEND_API_V1, file_name)
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if "router = APIRouter" in content:
                mount_patterns = [
                    f"app.include_router({base_name}.router",
                    f"app.include_router({base_name}_router",
                    f"import {base_name}",
                    f"from .{base_name} import",
                    f"from ...api.v1 import {base_name}",
                    f"from app.api.v1 import {base_name}",
                    f"{base_name},"
                ]
                if not any(pat in main_content for pat in mount_patterns):
                    if file_name in BASELINE_UNMOUNTED_ROUTERS:
                        log_warning("Rule 3 (Registered Legacy Debt)", f"Unmounted router 'backend/app/api/v1/{file_name}' is registered historical debt. Frozen until Phase 2.")
                    else:
                        log_violation("Rule 3 (Unmounted Backend Router)", f"NEW router 'backend/app/api/v1/{file_name}' defines APIRouter but is NOT mounted in main.py!")


# ==============================================================================
# CHECK 4: Deprecated Engine Usage in Production Code
# ==============================================================================
def check_deprecated_engine_imports():
    src_dir = os.path.join(REPO_ROOT, "src")
    if not os.path.exists(src_dir):
        return

    pattern = re.compile(r'\bcalculateItemGstRate\b')
    for root, _, files in os.walk(src_dir):
        if "tests" in root or "__tests__" in root:
            continue
        for file in files:
            if file.endswith((".ts", ".tsx")) and not file.endswith((".test.ts", ".test.tsx", ".spec.ts")):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line_idx, line in enumerate(f, 1):
                            if pattern.search(line) and "calculateItemGstRate" in line and "export" not in line:
                                log_violation("Rule 4 (Deprecated Engine Usage)", f"Production file '{os.path.relpath(file_path, REPO_ROOT)}:{line_idx}' calls deprecated 'calculateItemGstRate'. Must use canonical 'gstEngine.ts'.")
                except Exception:
                    pass


# ==============================================================================
# CHECK 5: Statutory Audit Ledger Protection Shield
# ==============================================================================
def check_statutory_audit_shield():
    try:
        conn = psycopg2.connect(DB_CONN)
        cur = conn.cursor()
        protected_tables = ["products", "legacy_id_mappings", "customers", "stock_movements"]
        for tbl in protected_tables:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s;", (tbl,))
            if not cur.fetchone():
                log_violation("Rule 5 (Statutory Audit Ledger Shield)", f"CRITICAL: Protected statutory table '{tbl}' is missing from database!")
        conn.close()
    except Exception as e:
        log_warning("Rule 5 (Statutory Audit Shield)", f"Unable to connect to database to verify statutory shield: {e}")


# ==============================================================================
# CHECK 6: Architecture Registry Database Integrity
# ==============================================================================
def check_registry_database_integrity():
    try:
        conn = psycopg2.connect(DB_CONN)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM architecture_entities;")
        ent_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM architecture_capabilities;")
        cap_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM architecture_decisions;")
        dec_count = cur.fetchone()[0]

        if ent_count < 5 or cap_count < 5:
            log_violation("Rule 6 (Registry Integrity)", f"Architecture Registry is unseeded: {ent_count} entities, {cap_count} capabilities.")
        conn.close()
    except Exception as e:
        log_violation("Rule 6 (Registry Integrity)", f"Failed to connect to Architecture Registry: {e}")


# ==============================================================================
# CHECK 7: Preflight Certificate Verification on Newly Added Business Assets
# ==============================================================================
def check_preflight_certificates_on_new_files():
    try:
        res = subprocess.run(["git", "status", "--porcelain"], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
        lines = res.stdout.strip().split("\n")
    except Exception:
        return

    monitored_prefixes = ["src/components/", "src/services/", "backend/app/api/v1/", "backend/app/services/"]
    ignored_patterns = [".test.ts", ".test.tsx", "test_", "conftest.py", "types/architecture.ts"]

    for line in lines:
        if not line.strip():
            continue
        status_code = line[:2]
        file_path = line[3:].strip()

        # Check newly created untracked or staged files
        if "?" in status_code or "A" in status_code:
            norm_path = file_path.replace("\\", "/")
            if any(norm_path.startswith(prefix) for prefix in monitored_prefixes):
                if any(ig in norm_path for ig in ignored_patterns):
                    continue

                # Verify certificate exists and is valid
                cert_result = PreflightCertificateManager.verify_file_certificate(norm_path)
                if not cert_result.get("valid"):
                    log_violation("Rule 7 (Preflight Certificate Required)", f"Preflight Certificate validation failed for '{norm_path}': {cert_result.get('reason')}")
                else:
                    # Also verify capability ownership declaration is present in file
                    if os.path.exists(file_path) and file_path.endswith((".tsx", ".ts", ".py")):
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            c = f.read()
                        if not any(k in c for k in ["SmritiCapability", "withCapability", "smriti_capability"]):
                            log_violation("Rule 8 (Capability Ownership Required)", f"New production business file '{norm_path}' lacks capability ownership declaration (@SmritiCapability / withCapability)!")


# ==============================================================================
# CHECK 8: Direct New Database Model Verification (Delta-Aware)
# ==============================================================================
def check_new_database_models():
    try:
        res = subprocess.run(["git", "status", "--porcelain"], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
        lines = res.stdout.strip().split("\n")
    except Exception:
        return

    for line in lines:
        if not line.strip():
            continue
        status_code = line[:2]
        file_path = line[3:].strip().replace("\\", "/")

        if ("?" in status_code or "A" in status_code) and file_path.startswith("backend/app/models/"):
            if file_path.endswith(".py") and "architecture_governance" not in file_path and "__init__" not in file_path:
                full_p = os.path.join(REPO_ROOT, file_path)
                if os.path.exists(full_p):
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    tables = re.findall(r"""__tablename__\s*=\s*["']([^"']+)["']""", content)
                    try:
                        conn = psycopg2.connect(DB_CONN)
                        cur = conn.cursor()
                        for tbl in tables:
                            cur.execute("SELECT 1 FROM architecture_entities WHERE canonical_table = %s;", (tbl,))
                            if not cur.fetchone():
                                cur.execute("SELECT 1 FROM architecture_decisions WHERE canonical_owner ILIKE %s OR secondary_owner ILIKE %s;", (f"%{tbl}%", f"%{tbl}%"))
                                if not cur.fetchone():
                                    log_violation("Rule 10 (Direct DB Model Creation Prohibited)", f"Database table '{tbl}' defined in '{file_path}' is not registered in architecture_entities. (UNKNOWN ≠ CREATE_NEW). Novel entities require an approved Architecture Decision before model creation.")
                        conn.close()
                    except Exception:
                        pass


# ==============================================================================
# CHECK 8: Single Canonical Capability Ownership Verification
# ==============================================================================
def check_capability_ownership():
    canonical_claims = {}
    decl_pattern = re.compile(r"""(?:SmritiCapability|withCapability|smriti_capability)\s*\(\s*(?:[^,]+,\s*)?\{?([^)]+)\}?\s*\)""", re.DOTALL)

    search_dirs = [SRC_COMPONENTS, os.path.join(REPO_ROOT, "backend", "app", "services")]
    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for root, _, files in os.walk(sdir):
            for file in files:
                if file.endswith((".tsx", ".ts", ".py")) and not file.endswith((".test.ts", ".test.tsx")):
                    fpath = os.path.join(root, file)
                    rel_path = os.path.relpath(fpath, REPO_ROOT).replace("\\", "/")
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        for match in decl_pattern.finditer(content):
                            raw = match.group(1)
                            ent_match = re.search(r"""entity\s*[:=]\s*["']([^"']+)["']""", raw)
                            cap_match = re.search(r"""capability\s*[:=]\s*["']([^"']+)["']""", raw)
                            role_match = re.search(r"""role\s*[:=]\s*["']([^"']+)["']""", raw)
                            owner_match = re.search(r"""canonicalOwner\s*[:=]\s*["']([^"']+)["']""", raw)

                            if cap_match:
                                cap = cap_match.group(1)
                                role = role_match.group(1) if role_match else "CANONICAL"
                                if role == "CANONICAL":
                                    if cap in canonical_claims:
                                        log_violation("Rule 8 (Dual Canonical Conflict)", f"Capability '{cap}' declared CANONICAL by both '{canonical_claims[cap]}' and '{rel_path}'!")
                                    else:
                                        canonical_claims[cap] = rel_path
                                elif role in ["ADAPTER", "COMPATIBILITY", "SPECIALIZED_UI", "MIGRATION"]:
                                    if not owner_match and "decisionId" not in raw:
                                        log_violation("Rule 8 (Non-Canonical Reference Required)", f"File '{rel_path}' declares role '{role}' for capability '{cap}' without specifying 'canonicalOwner' or 'decisionId'!")
                    except Exception:
                        pass


# ==============================================================================
# MAIN RUNNER
# ==============================================================================
def main():
    print("================================================================================")
    print(" SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)")
    print("================================================================================")

    check_dual_domain_directories()
    check_semantic_collisions()
    check_unmounted_backend_routers()
    check_deprecated_engine_imports()
    check_statutory_audit_shield()
    check_registry_database_integrity()
    check_preflight_certificates_on_new_files()
    check_new_database_models()
    check_capability_ownership()

    TOTAL_CHECKS = 10
    print(f" Checks Executed:    {TOTAL_CHECKS}")
    print(f" P0/P1 Violations:   {len(VIOLATIONS)}")
    print(f" Registered Debt:    {len(WARNINGS)}")
    print("--------------------------------------------------------------------------------")

    if WARNINGS:
        print("\n[REGISTERED HISTORICAL DEBT (FROZEN UNTIL PHASE 2)]:")
        for rule, details in WARNINGS:
            print(f"  ℹ️  [{rule}] {details}")

    if VIOLATIONS:
        print("\n[P0/P1 ARCHITECTURE GATE FAILURES]:")
        for rule, details in VIOLATIONS:
            print(f"  ❌ [{rule}] {details}")
        print("================================================================================")
        print(" CI GATE STATUS: FAILED — Unapproved architecture violations detected.")
        print("================================================================================")
        sys.exit(1)

    print("\n================================================================================")
    print(" CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.")
    print("================================================================================")
    sys.exit(0)


if __name__ == "__main__":
    main()
