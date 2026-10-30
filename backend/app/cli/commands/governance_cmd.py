#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Governance Command

import argparse
import subprocess
import sys
from typing import Dict, Any

from app.cli.utils import find_repo_root, output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "governance",
        help="Execute CI architecture guards, tenant data boundaries, and field governance checks.",
        description="Enforces zero-drift architectural policies across database models, UI fields, and tenant boundaries."
    )
    gov_sub = parser.add_subparsers(dest="gov_action", required=True)

    # boundary
    b_parser = gov_sub.add_parser(
        "boundary",
        help="Run Tenant Data Boundary Guard (scripts/ci_tenant_boundary_guard.py)."
    )
    b_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    # fields
    f_parser = gov_sub.add_parser(
        "fields",
        help="Run UX Field Governance Guard (scripts/ci_ux_field_governance_guard.py)."
    )
    f_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    # check (all)
    c_parser = gov_sub.add_parser(
        "check",
        help="Run all CI governance checks."
    )
    c_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    parser.set_defaults(func=run_governance_cmd)


def run_script_probe(script_path: str, repo_root) -> Dict[str, Any]:
    full_path = repo_root / script_path
    if not full_path.exists():
        return {
            "name": script_path,
            "status": "MISSING",
            "exit_code": 1,
            "stdout": "",
            "stderr": f"File not found: {full_path}"
        }

    proc = subprocess.run(
        [sys.executable, str(full_path)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )

    return {
        "name": script_path,
        "status": "PASS" if proc.returncode == 0 else "FAIL",
        "exit_code": proc.returncode,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip()
    }


def run_governance_cmd(args: argparse.Namespace) -> int:
    repo_root = find_repo_root()
    as_json = getattr(args, "as_json", False)

    if args.gov_action == "boundary":
        res = run_script_probe("scripts/ci_tenant_boundary_guard.py", repo_root)
        if as_json:
            output_result(res, as_json=True)
        else:
            print(res["stdout"])
            if res["stderr"]:
                print(res["stderr"], file=sys.stderr)
        return res["exit_code"]

    elif args.gov_action == "fields":
        res = run_script_probe("scripts/ci_ux_field_governance_guard.py", repo_root)
        if as_json:
            output_result(res, as_json=True)
        else:
            print(res["stdout"])
            if res["stderr"]:
                print(res["stderr"], file=sys.stderr)
        return res["exit_code"]

    elif args.gov_action == "check":
        b_res = run_script_probe("scripts/ci_tenant_boundary_guard.py", repo_root)
        f_res = run_script_probe("scripts/ci_ux_field_governance_guard.py", repo_root)
        
        all_pass = (b_res["status"] == "PASS" and f_res["status"] == "PASS")
        result = {
            "overall_status": "PASS" if all_pass else "FAIL",
            "guards": {
                "tenant_boundary": b_res["status"],
                "ux_field_governance": f_res["status"],
            }
        }

        def format_text(r: Dict[str, Any]) -> None:
            print("========================================================================")
            print(" SMRITI Architecture & CI Governance Suite")
            print("========================================================================")
            print(f" Overall Status               : {r['overall_status']}")
            print(f" - Tenant Data Boundary       : {r['guards']['tenant_boundary']}")
            print(f" - UX Field Governance        : {r['guards']['ux_field_governance']}")
            print("========================================================================")

        output_result(result, as_json=as_json, text_formatter=format_text)
        return 0 if all_pass else 1

    return 1
