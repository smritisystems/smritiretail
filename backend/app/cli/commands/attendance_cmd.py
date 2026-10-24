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
#  Classification: Unified SMRITI CLI Attendance Command

import argparse
import sys
from typing import Dict, Any

from app.cli.utils import find_repo_root, output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "attendance",
        help="Biometric IoT and workforce attendance automation client.",
        description="Executes authenticated attendance recording and staff roster lookups."
    )
    att_sub = parser.add_subparsers(dest="att_action", required=True)

    # list-staff
    ls_parser = att_sub.add_parser(
        "list-staff",
        help="Query active staff roster from company directory."
    )
    ls_parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base API URL")
    ls_parser.add_argument("--company", default="COMP-001", help="Target company ID")
    ls_parser.add_argument("--username", default="admin", help="Auth username")
    ls_parser.add_argument("--password", default="admin123", help="Auth password")
    ls_parser.add_argument("--json", action="store_true", dest="as_json", help="Output JSON")

    # punch
    p_parser = att_sub.add_parser(
        "punch",
        help="Record a staff attendance punch (IN / OUT)."
    )
    p_parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base API URL")
    p_parser.add_argument("--company", default="COMP-001", help="Target company ID")
    p_parser.add_argument("--username", default="admin", help="Auth username")
    p_parser.add_argument("--password", default="admin123", help="Auth password")
    p_parser.add_argument("--employee-id", required=True, help="Employee UUID or code")
    p_parser.add_argument("--type", choices=["IN", "OUT"], default="IN", dest="punch_type", help="Punch type")
    p_parser.add_argument("--device-id", default="CLI-TERMINAL-01", help="Biometric or terminal ID")
    p_parser.add_argument("--json", action="store_true", dest="as_json", help="Output JSON")

    parser.set_defaults(func=run_attendance_cmd)


def run_attendance_cmd(args: argparse.Namespace) -> int:
    repo_root = find_repo_root()
    sys.path.insert(0, str(repo_root / "scripts"))

    try:
        import headless_attendance_client as att_client
    except Exception as exc:
        print(f"Error importing headless_attendance_client: {exc}", file=sys.stderr)
        return 1

    as_json = getattr(args, "as_json", False)

    try:
        token = att_client.login(args.base_url, args.username, args.password)
    except Exception as exc:
        err = {"status": "AUTH_FAILED", "error": str(exc)}
        output_result(err, as_json=as_json, text_formatter=lambda d: print(f"Authentication failed: {exc}"))
        return 1

    if args.att_action == "list-staff":
        try:
            staff = att_client.list_staff(args.base_url, token, args.company)
            output_result(staff, as_json=as_json, text_formatter=lambda roster: print(f"Staff Count: {len(roster)}"))
            return 0
        except Exception as exc:
            print(f"Error listing staff: {exc}", file=sys.stderr)
            return 1

    elif args.att_action == "punch":
        try:
            res = att_client.record_punch(
                args.base_url, token, args.employee_id,
                punch_type=args.punch_type, device_id=args.device_id, company_id=args.company
            )
            output_result(res, as_json=as_json, text_formatter=lambda r: print(f"Punch Recorded: {r}"))
            return 0
        except Exception as exc:
            print(f"Error recording punch: {exc}", file=sys.stderr)
            return 1

    return 1
