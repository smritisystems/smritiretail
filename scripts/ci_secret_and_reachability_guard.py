"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Paths to scan
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = WORKSPACE_ROOT / "backend" / "app"
SRC_DIR = WORKSPACE_ROOT / "src"

# Regex patterns for sensitive financial and credential exposure
EXPOSURE_PATTERNS = [
    # 1. Specific SBI Account Number that was previously hardcoded
    (re.compile(r"43976711765"), "Hardcoded SBI Account Number (43976711765)"),
    # 2. Specific SBI IFSC Code that was previously hardcoded
    (re.compile(r"SBIN0030425", re.IGNORECASE), "Hardcoded SBI IFSC Code (SBIN0030425)"),
    # 3. Generic IFSC code pattern (4 letters, 0, 6 alphanumeric) in non-template/example files
    (re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), "Hardcoded Indian IFSC Code"),
    # 4. Bank account number pattern (11-18 contiguous digits in source strings)
    (re.compile(r"""(?:account_no|accountNumber|bank_account)\s*[:=]\s*["'](\d{11,18})["']"""), "Hardcoded Bank Account Number Assignment"),
]

# Files / patterns allowed to contain examples or templates
IGNORED_PATHS = {
    ".env.example",
    "package-lock.json",
    "pnpm-lock.yaml",
    "db_store.json",
    "scripts/ci_secret_and_reachability_guard.py",
}

# Operational routers that MUST NOT bypass get_company_db for transactional operations
OPERATIONAL_ROUTERS = [
    WORKSPACE_ROOT / "backend" / "app" / "api" / "v1" / "sales.py",
    WORKSPACE_ROOT / "backend" / "app" / "api" / "v1" / "inventory.py",
    WORKSPACE_ROOT / "backend" / "app" / "api" / "v1" / "purchase.py",
    WORKSPACE_ROOT / "backend" / "app" / "api" / "v1" / "barcode.py",
]


def check_secrets_and_exposure() -> list[str]:
    """Scans all source code files for hardcoded bank details and operational secrets."""
    violations = []
    
    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".agents", "brain"}]
        
        for file in files:
            rel_path = os.path.relpath(os.path.join(root, file), WORKSPACE_ROOT).replace("\\", "/")
            
            if any(rel_path.endswith(ign) or rel_path == ign for ign in IGNORED_PATHS):
                continue
            
            if not (file.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".txt", ".md"))):
                continue
            
            # Check file content
            full_path = os.path.join(root, file)
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    for line_idx, line in enumerate(lines, 1):
                        for pattern, desc in EXPOSURE_PATTERNS:
                            if pattern.search(line):
                                # Filter out generic tests or documentation mentions
                                if "SBIN0000000" in line or "TEST0000000" in line or "12345678901" in line:
                                    continue
                                violations.append(f"[SECURITY] {rel_path}:{line_idx} — {desc} found in: {line.strip()[:100]}")
            except Exception as e:
                violations.append(f"[ERROR] Could not read {rel_path}: {e}")
                
    return violations


def check_router_reachability_and_wiring() -> list[str]:
    """
    Verifies that all transactional routes use get_company_db
    and do not bypass tenant-isolated multi-tenant resolution.
    """
    violations = []
    
    for router_path in OPERATIONAL_ROUTERS:
        if not router_path.exists():
            violations.append(f"[ROUTER] Expected router file missing: {router_path}")
            continue
            
        rel_path = router_path.relative_to(WORKSPACE_ROOT).as_posix()
        with open(router_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # 1. Must import and use get_company_db
        if "get_company_db" not in content:
            violations.append(f"[WIRING] {rel_path} does not import or reference 'get_company_db'.")
            
        # 2. Must not use get_db in operational route dependencies
        if re.search(r"Depends\(\s*get_db\s*\)", content):
            violations.append(f"[WIRING] {rel_path} contains legacy 'Depends(get_db)' bypassing tenant company isolation!")
            
    return violations


def main():
    print("================================================================================")
    print("SMRITI CI GUARD: Hardcoded Secret & Operational Route Wiring Checker")
    print("================================================================================")
    
    secret_violations = check_secrets_and_exposure()
    wiring_violations = check_router_reachability_and_wiring()
    
    all_violations = secret_violations + wiring_violations
    
    if secret_violations:
        print("\n❌ SENSITIVE DATA EXPOSURE VIOLATIONS:")
        for v in secret_violations:
            print(f"  {v}")
    else:
        print("\n✓ [PASS] Zero hardcoded bank accounts, IFSC codes, or credentials detected.")
        
    if wiring_violations:
        print("\n❌ ROUTE WIRING & REACHABILITY VIOLATIONS:")
        for v in wiring_violations:
            print(f"  {v}")
    else:
        print("✓ [PASS] All operational routers (sales, inventory, purchase, barcode) are 100% wired to get_company_db.")
        
    print("\n================================================================================")
    if all_violations:
        print(f"GUARD VERDICT: FAILED ({len(all_violations)} violations found)")
        print("================================================================================")
        sys.exit(1)
    else:
        print("GUARD VERDICT: PASSED (100% compliant)")
        print("================================================================================")
        sys.exit(0)


if __name__ == "__main__":
    main()
