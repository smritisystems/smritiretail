"""
Project       : SMRITI Retail OS
Author        : Jawahar Ramkripal Mallah
Designation   : Chief Systems Architect & Creator
Email         : support@smritibooks.com
Websites      : smritibooks.com | erpnbook.com | aitdl.com
Version       : 6.70.52
Created       : 2026-10-12
Modified      : 2026-10-12
Copyright     : (c) SMRITIBooks.com. All Rights Reserved.
License       : Proprietary Commercial Software
Classification: Internal
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone


def request_json(url: str, data: dict = None, headers: dict = None, method: str = "GET") -> dict:
    req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    body_bytes = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
            print(f"[HTTP {err.code}] Error: {parsed}", file=sys.stderr)
        except Exception:
            print(f"[HTTP {err.code}] Raw response: {err_body}", file=sys.stderr)
        raise
    except Exception as exc:
        print(f"Network error calling {url}: {exc}", file=sys.stderr)
        raise


def login(base_url: str, username: str, password: str) -> str:
    login_url = f"{base_url.rstrip('/')}/api/v1/auth/login"
    payload = {"username": username, "password": password}
    resp = request_json(login_url, data=payload, method="POST")
    token = resp.get("access_token")
    if not token:
        raise ValueError(f"Login response missing access_token: {resp}")
    return token


def list_staff(base_url: str, token: str, company_id: str = "COMP-001") -> list:
    url = f"{base_url.rstrip('/')}/api/v1/staff/"
    headers = {"Authorization": f"Bearer {token}", "X-Company-ID": company_id}
    res = request_json(url, headers=headers, method="GET")
    return res.get("items", [])


def push_biometric_punches(
    base_url: str,
    token: str,
    device_id: str,
    device_key: str,
    punches: list,
    company_id: str = "COMP-001",
    branch_id: str = "BR-MAIN-001",
) -> dict:
    url = f"{base_url.rstrip('/')}/api/v1/staff/attendance/device-push"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Branch-Code": branch_id,
    }
    payload = {
        "device_id": device_id,
        "device_key": device_key,
        "branch_id": branch_id,
        "punches": punches,
    }
    return request_json(url, data=payload, headers=headers, method="POST")


def punch_single_staff(
    base_url: str,
    token: str,
    user_id: str,
    punch_type: str = "AUTO",
    device_source: str = "HEADLESS_TERMINAL_01",
    register_source: str = "BIOMETRIC_TERMINAL",
    company_id: str = "COMP-001",
) -> dict:
    url = f"{base_url.rstrip('/')}/api/v1/staff/attendance/punch"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
    }
    payload = {
        "user_id": user_id,
        "punch_type": punch_type,
        "device_source": device_source,
        "register_source": register_source,
    }
    return request_json(url, data=payload, headers=headers, method="POST")


def bulk_mark_attendance(
    base_url: str,
    token: str,
    records: list,
    company_id: str = "COMP-001",
) -> list:
    url = f"{base_url.rstrip('/')}/api/v1/staff/attendance/bulk"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
    }
    return request_json(url, data=records, headers=headers, method="POST")


def query_attendance_ledger(
    base_url: str,
    token: str,
    user_id: str = None,
    from_date: str = None,
    to_date: str = None,
    company_id: str = "COMP-001",
) -> dict:
    params = {}
    if user_id:
        params["user_id"] = user_id
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date

    query_str = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{base_url.rstrip('/')}/api/v1/staff/attendance{query_str}"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
    }
    return request_json(url, headers=headers, method="GET")


def query_attendance_summary(
    base_url: str,
    token: str,
    user_id: str = None,
    period: str = None,
    company_id: str = "COMP-001",
) -> dict:
    params = {}
    if user_id:
        params["user_id"] = user_id
    if period:
        params["period"] = period

    query_str = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{base_url.rstrip('/')}/api/v1/staff/attendance/summary{query_str}"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
    }
    return request_json(url, headers=headers, method="GET")


def main():
    parser = argparse.ArgumentParser(description="Headless Staff Attendance Punch & Roster Client for SMRITI Retail OS")
    parser.add_argument("--base-url", default="http://localhost:1981", help="Base URL for SMRITI backend API")
    parser.add_argument("--username", default="admin", help="Operator or API service username")
    parser.add_argument("--password", default="Admin@123", help="Password")
    parser.add_argument(
        "--mode",
        choices=["biometric-push", "single-punch", "bulk-mark", "query-ledger", "query-summary", "list-staff"],
        default="biometric-push",
        help="Headless execution mode",
    )
    parser.add_argument("--employee-code", default="EMP-1002", help="Employee code (e.g. EMP-1002)")
    parser.add_argument("--user-id", default="usr-local-988d913cebc3", help="Staff User ID for punch/ledger/summary")
    parser.add_argument("--device-id", default="BIO-TERMINAL-FRONT-01", help="Hardware device identifier")
    parser.add_argument("--device-key", default="smriti-iot-key-secret-2026", help="IoT device push key")
    parser.add_argument("--punch-state", default="CHECK_IN", choices=["AUTO", "CHECK_IN", "CHECK_OUT"])
    parser.add_argument("--verify-type", default="FINGERPRINT", choices=["FINGERPRINT", "FACE", "CARD", "PASSWORD"])
    parser.add_argument("--attendance-date", default=None, help="Attendance date in YYYY-MM-DD format (defaults to today)")
    parser.add_argument("--status", default="PRESENT", choices=["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE", "HOLIDAY"])
    parser.add_argument("--period", default=None, help="Summary period format YYYY-MM")

    args = parser.parse_args()

    print(f"[*] Authenticating with SMRITI Retail OS at {args.base_url} as '{args.username}'...")
    token = login(args.base_url, args.username, args.password)
    print("    [+] Authentication successful. Access token acquired.\n")

    if args.mode == "list-staff":
        print("[*] Querying Staff Directory...")
        staff_list = list_staff(args.base_url, token)
        print(f"    [+] Found {len(staff_list)} active staff members:")
        print(f"    {'-'*80}")
        print(f"    {'USER ID':<20} | {'CODE':<10} | {'ROLE':<15} | {'NAME':<25}")
        print(f"    {'-'*80}")
        for s in staff_list:
            uid = s.get("id") or ""
            code = s.get("code") or ""
            role = s.get("role") or ""
            name = s.get("name") or ""
            print(f"    {uid:<20} | {code:<10} | {role:<15} | {name:<25}")
        print(f"    {'-'*80}\n")

    elif args.mode == "biometric-push":
        now_iso = datetime.now(timezone.utc).isoformat()
        punch_item = {
            "employee_code": args.employee_code,
            "timestamp": now_iso,
            "punch_state": args.punch_state,
            "verify_type": args.verify_type,
        }
        print(f"[*] Pushing headless biometric punch for employee '{args.employee_code}' (Device: {args.device_id}, State: {args.punch_state})...")
        res = push_biometric_punches(
            base_url=args.base_url,
            token=token,
            device_id=args.device_id,
            device_key=args.device_key,
            punches=[punch_item],
        )
        print("    [+] Biometric push result:")
        print(json.dumps(res, indent=2))

    elif args.mode == "single-punch":
        print(f"[*] Recording headless attendance punch for user '{args.user_id}' (Type: {args.punch_state})...")
        res = punch_single_staff(
            base_url=args.base_url,
            token=token,
            user_id=args.user_id,
            punch_type=args.punch_state,
            device_source=args.device_id,
        )
        print("    [+] Punch result:")
        print(json.dumps(res, indent=2))

    elif args.mode == "bulk-mark":
        att_date = args.attendance_date or date.today().isoformat()
        print(f"[*] Executing bulk attendance marking for date '{att_date}' (Status: {args.status})...")
        records = [
            {
                "user_id": args.user_id,
                "attendance_date": att_date,
                "status": args.status,
                "register_source": "HEADLESS_CLI_BULK",
                "device_source": "CLI-BULK-RUNNER",
                "correction_reason": "Headless batch mark operation",
            }
        ]
        res = bulk_mark_attendance(
            base_url=args.base_url,
            token=token,
            records=records,
        )
        print("    [+] Bulk mark response:")
        print(json.dumps(res, indent=2))

    elif args.mode == "query-ledger":
        print(f"[*] Fetching Attendance Ledger (User: {args.user_id or 'ALL'})...")
        res = query_attendance_ledger(
            base_url=args.base_url,
            token=token,
            user_id=args.user_id if args.user_id != "ALL" else None,
            from_date=args.attendance_date,
            to_date=args.attendance_date,
        )
        records = res.get("records", [])
        total = res.get("total", len(records))
        print(f"    [+] Retrieved {total} attendance record(s):")
        print(f"    {'-'*95}")
        print(f"    {'RECORD ID':<18} | {'USER ID':<22} | {'DATE':<10} | {'STATUS':<9} | {'CHECK IN':<10} | {'CHECK OUT':<10}")
        print(f"    {'-'*95}")
        for r in records:
            rid = r.get("id") or ""
            uid = r.get("user_id") or ""
            d = str(r.get("attendance_date") or "")
            st = r.get("status") or ""
            cin = r.get("check_in_at") or ""
            cout = r.get("check_out_at") or ""
            cin_str = cin[11:19] if len(cin) >= 19 else ("-" if not cin else cin)
            cout_str = cout[11:19] if len(cout) >= 19 else ("-" if not cout else cout)
            print(f"    {rid:<18} | {uid:<22} | {d:<10} | {st:<9} | {cin_str:<10} | {cout_str:<10}")
        print(f"    {'-'*95}\n")

    elif args.mode == "query-summary":
        print(f"[*] Fetching Period Attendance Summary...")
        res = query_attendance_summary(
            base_url=args.base_url,
            token=token,
            user_id=args.user_id if args.user_id != "ALL" else None,
            period=args.period,
        )
        print("    [+] Summary KPIs:")
        print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
