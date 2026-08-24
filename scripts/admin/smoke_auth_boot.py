"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

smoke_test_auth_bootstrap_endpoint.py
=======================================
Admin smoke-test utility: issues an HTTP POST to /api/v1/auth/bootstrap to
confirm the endpoint is reachable and the admin account seeding response is
correct. Intended for use immediately after deploying a fresh instance.

Usage:
    python scripts/admin/smoke_test_auth_bootstrap_endpoint.py

SECURITY NOTE: Targets 127.0.0.1:8001 by default. Verify BOOTSTRAP_URL
below before pointing at any non-local server.
"""

import json
import urllib.request
import urllib.error

BOOTSTRAP_URL = "http://127.0.0.1:8001/api/v1/auth/bootstrap"
PAYLOAD = {
    "username": "admin",
    "password": "Admin@123",
    "email": "admin@smriti.local",
}


def main() -> None:
    body = json.dumps(PAYLOAD).encode("utf-8")
    request = urllib.request.Request(
        BOOTSTRAP_URL,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            print("STATUS", resp.status)
            print(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        print("STATUS", err.code)
        print(err.read().decode("utf-8"))
    except Exception as err:
        print("ERROR", repr(err))


if __name__ == "__main__":
    main()
