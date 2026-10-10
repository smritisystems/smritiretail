"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.45.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Guard — Zero Generated-File Drift
"""

import sys
import difflib
from pathlib import Path

# Add repo root and backend to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.governance.field_registry import (
    CANONICAL_FIELDS,
    CFOC_REGISTRY_VERSION,
    CFOC_REGISTRY_FIELDS,
    CFOC_REGISTRY_FINGERPRINT,
)
from generate_ts_field_registry import generate_typescript_content, TARGET_TS_FILE


def normalize_content(content: str) -> str:
    """Normalize line endings and trailing whitespace per line."""
    lines = [line.rstrip() for line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip() + "\n"


def verify_registry_drift() -> int:
    print("==============================================================")
    print(" SMRITI RETAIL OS -- CFOC ZERO GENERATED-FILE DRIFT GUARD")
    print("==============================================================")
    print(f"Target Version    : {CFOC_REGISTRY_VERSION}")
    print(f"Authoritative SSOT: backend/app/governance/field_registry.py")
    print(f"Generated Target  : {TARGET_TS_FILE.relative_to(REPO_ROOT)}")
    print(f"Fingerprint       : {CFOC_REGISTRY_FINGERPRINT}")
    print("--------------------------------------------------------------")

    if not TARGET_TS_FILE.exists():
        print(f"❌ ERROR: Generated file '{TARGET_TS_FILE}' does not exist!")
        print("Run: python scripts/generate_ts_field_registry.py")
        return 1

    committed_raw = TARGET_TS_FILE.read_text(encoding="utf-8")
    expected_raw = generate_typescript_content()

    committed_norm = normalize_content(committed_raw)
    expected_norm = normalize_content(expected_raw)

    if committed_norm != expected_norm:
        diff = list(difflib.unified_diff(
            committed_norm.splitlines(keepends=True),
            expected_norm.splitlines(keepends=True),
            fromfile="committed/canonicalFieldRegistry.ts",
            tofile="generated/from_field_registry.py",
            n=3
        ))
        print("[FAIL] GENERATED REGISTRY DRIFT DETECTED!")
        print(f"'{TARGET_TS_FILE.relative_to(REPO_ROOT)}' differs from authoritative Python registry.")
        print("Manual edits to this file are strictly prohibited by CFOC policy.\n")
        print("--- Unified Diff (First 40 lines) ---")
        for line in diff[:40]:
            sys.stdout.write(line)
        print("\n==============================================================")
        print(" REMEDIATION: Re-run 'python scripts/generate_ts_field_registry.py'")
        print(" Do NOT hand-edit 'src/services/canonicalFieldRegistry.ts'!")
        print("==============================================================")
        return 1

    print(f" [OK] Zero Generated-File Drift: 100% Parity Verified.")
    print(f" Committed TypeScript registry matches authoritative Python SSOT.")
    print(f" Field Count: {len(CANONICAL_FIELDS)} | Fingerprint: {CFOC_REGISTRY_FINGERPRINT}")
    print("==============================================================\n")
    return 0


if __name__ == "__main__":
    sys.exit(verify_registry_drift())
