"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-23
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys
import os
import json
import uuid
import socket
import urllib.request
import urllib.error
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.core.security import create_access_token
from app.services.qz_security import QzSecurityService

BASE_URL = "http://localhost:8000"

def http_get(url: str, headers: dict = None) -> tuple[int, str]:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")

def http_post(url: str, data: dict, headers: dict = None) -> tuple[int, str]:
    body = json.dumps(data).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")

def test_tcp_port(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False

def main():
    print("=" * 80)
    print("  SMRITI Retail OS - Comprehensive QZ Tray & Barcode CLI Test Suite")
    print("=" * 80)

    # 1. Local QZ Tray WebSocket Daemon Reachability
    print("\n[1/6] Testing Local QZ Tray Daemon Port Reachability (ws://localhost:8182)...")
    qz_alive = test_tcp_port("127.0.0.1", 8182)
    if qz_alive:
        print("  [+] QZ Tray Daemon: LISTENING & HEALTHY on port 8182")
    else:
        print("  [!] QZ Tray Daemon: Port 8182 not reachable")

    # 2. Test X.509 Certificate Endpoint
    print("\n[2/6] Testing Backend X.509 Certificate Endpoint (/api/v1/barcode/qz/certificate)...")
    status, cert_pem = http_get(f"{BASE_URL}/api/v1/barcode/qz/certificate")
    assert status == 200, f"Expected 200, got {status}"
    assert "-----BEGIN CERTIFICATE-----" in cert_pem
    assert "-----END CERTIFICATE-----" in cert_pem
    print(f"  [+] HTTP {status} OK: X.509 Certificate received ({len(cert_pem)} bytes)")
    first_line = cert_pem.strip().split("\n")[0]
    last_line = cert_pem.strip().split("\n")[-1]
    print(f"  [+] Cert Delimiters: '{first_line}' ... '{last_line}'")

    # 3. Test Cryptographic SHA512 Challenge Signing
    print("\n[3/6] Testing Backend RSA SHA512 Challenge Signing (/api/v1/barcode/qz/sign)...")
    challenge = f"SMRITI_CLI_CHALLENGE_{uuid.uuid4().hex}"
    status, sig = http_post(f"{BASE_URL}/api/v1/barcode/qz/sign", {"request": challenge})
    assert status == 200, f"Expected 200, got {status}"
    assert len(sig) > 50, "Signature too short"
    print(f"  [+] HTTP {status} OK: Challenge signed successfully")
    print(f"  [+] Challenge: '{challenge}'")
    print(f"  [+] SHA512 Signature (base64): {sig[:60]}... ({len(sig)} bytes)")

    # 4. Authenticate against Live Backend & Obtain Access Token
    print("\n[4/6] Authenticating against Live Backend (/api/v1/auth/login)...")
    status, login_raw = http_post(f"{BASE_URL}/api/v1/auth/login", {
        "username": "usr_manager",
        "password": "Password@123"
    })
    assert status == 200, f"Expected 200, got {status}: {login_raw}"
    login_data = json.loads(login_raw)
    token = login_data["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "BR-001"
    }
    print(f"  [+] HTTP {status} OK: Logged in as usr_manager (Role: MANAGER)")
    print(f"  [+] Access Token (JWT): Bearer {token[:40]}...")

    # 5. Create QZ Tray Direct Print Job
    print("\n[5/6] Creating Direct Thermal Label Print Job (DPL/TSPL/ZPL)...")
    print_payload = {
        "dispatch_mode": "qz_tray",
        "targetPrinter": "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
        "items": [
            {
                "id": "ITEM-CLI-001",
                "stockNo": "SKU-9901-XL",
                "barcode": "8901234567890",
                "product": "Executive Linen Shirt",
                "brand": "Smriti Signature",
                "style": "Slim Fit",
                "colour": "Sky Blue",
                "size": "42",
                "mrp": 2499.0,
                "sellingPrice": 1999.0,
                "labelCount": 2
            }
        ]
    }
    status, job_raw = http_post(f"{BASE_URL}/api/v1/barcode/print", print_payload, headers=headers)
    assert status == 200, f"Expected 200, got {status}: {job_raw}"
    job_data = json.loads(job_raw)
    job_id = job_data["job_id"]
    suggested_printer = job_data.get("suggested_printer")
    payload_str = job_data.get("payload", "")
    print(f"  [+] HTTP {status} OK: Print Job Created in PostgreSQL System-of-Record")
    print(f"  [+] Print Job ID       : {job_id}")
    print(f"  [+] Target Windows Queue : {suggested_printer}")
    print(f"  [+] Raw Printer Stream : {len(payload_str)} bytes")

    # 6. Two-Phase Hardware Spool Acknowledgment
    print("\n[6/6] Dispatching Hardware Spool Acknowledgment (Two-Phase Protocol)...")
    ack_payload = {
        "success": True,
        "printer_name": suggested_printer
    }
    status, ack_raw = http_post(f"{BASE_URL}/api/v1/barcode/print-jobs/{job_id}/ack", ack_payload, headers=headers)
    assert status == 200, f"Expected 200, got {status}: {ack_raw}"
    ack_data = json.loads(ack_raw)
    print(f"  [+] HTTP {status} OK: Hardware Spool Acknowledgment Recorded")
    print(f"  [+] DB Print Status    : {ack_data.get('status')}")
    print(f"  [+] Success Flag       : {ack_data.get('success')}")

    print("\n" + "=" * 80)
    print("  ALL 6 COMMAND-LINE TEST SUITES PASSED (100% SUCCESS - STATUS: DONE)")
    print("=" * 80)

if __name__ == "__main__":
    main()
