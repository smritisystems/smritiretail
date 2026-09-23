"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Governance Tool — Baseline Generator
"""

import sys
import os
import re
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
BASELINE_FILE = REPO_ROOT / "scripts" / "ux_field_governance_baseline.json"


def generate_baseline():
    print(f"Scanning {SRC_DIR} for legacy JSX input definitions...")
    violations = []
    v_id = 1

    input_regex = re.compile(r'<(?:input|Input)\b([^>]*?)(?:/>|>)', re.DOTALL)
    name_attr_regex = re.compile(r'\b(?:name|field|key|fieldKey)\s*=\s*["\']([^"\']+)["\']')

    for filepath in sorted(list(SRC_DIR.rglob("*.tsx"))):
        rel_path = str(filepath.relative_to(REPO_ROOT)).replace("\\", "/")
        try:
            content = filepath.read_text(encoding="utf-8", errors="ignore")
            lines = content.splitlines()

            for line_idx, line in enumerate(lines, 1):
                # Search for input tags
                for match in input_regex.finditer(line):
                    props_str = match.group(1)
                    nm = name_attr_regex.search(props_str)
                    if nm:
                        field_name = nm.group(1)
                        if field_name not in ("checkbox", "radio", "search", "query", "file", "button", "text", "filter", "item", "row"):
                            violations.append({
                                "violation_id": f"UX-LEGACY-{v_id:04d}",
                                "file": rel_path,
                                "line": line_idx,
                                "field": field_name,
                                "reason": "Legacy raw JSX input in component pending migration to canonical FieldRenderer/MasterFormDrawer",
                                "owner": "Chief Systems Architect",
                                "remediation_target": "v4.0.0-phase3",
                                "created_date": "2026-09-23",
                                "expiry_condition": "Migration of screen to MasterFormDrawer or canonical FieldRenderer"
                            })
                            v_id += 1
        except Exception as e:
            print(f"Error scanning {rel_path}: {e}")

    print(f"Total legacy raw JSX input violations detected: {len(violations)}")
    with open(BASELINE_FILE, "w", encoding="utf-8") as f:
        json.dump(violations, f, indent=2)
    print(f"Wrote baseline file to {BASELINE_FILE}")


if __name__ == "__main__":
    generate_baseline()
