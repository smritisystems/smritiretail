"""Live barcode engine API demo — run inside smriti-api container."""
import urllib.request
import json
import sys

API = "http://localhost:8000"

# 1. Login
login_data = json.dumps({"username": "admin", "password": "admin123"}).encode()
login_req = urllib.request.Request(f"{API}/api/v1/auth/login", data=login_data, headers={"Content-Type": "application/json"})
try:
    login_resp = urllib.request.urlopen(login_req)
    login_json = json.loads(login_resp.read())
    token = login_json.get("access_token", "")
    if not token:
        print("ERROR: No access_token in login response")
        print(json.dumps(login_json, indent=2))
        sys.exit(1)
    print(f"[OK] Login successful. Token: {token[:40]}...")
except Exception as e:
    print(f"Login failed: {e}")
    sys.exit(1)

AUTH = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 2. Get Token Registry
print("\n=== TOKEN REGISTRY ===")
try:
    req = urllib.request.Request(f"{API}/api/v1/barcode/tokens", headers=AUTH)
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    tokens = data.get("tokens", [])
    print(f"Total Registered Tokens: {len(tokens)}")
    for t in tokens[:5]:
        print(f"  {t['token']:20s} | {t['category']:12s} | {t['description'][:50]}")
    if len(tokens) > 5:
        print(f"  ... and {len(tokens) - 5} more")
except Exception as e:
    print(f"Token registry request failed: {e}")

# 3. Generate PRN Script
print("\n=== PRN GENERATION ===")
prn_payload = json.dumps({
    "items": [
        {
            "code": "BBM-SPORTS-BLK-08",
            "name": "BBM Sports Black Shoe",
            "brand": "Tattly Threads",
            "barcode": "8901234567890",
            "mrp": 1899,
            "size": "8",
            "color": "BLACK",
            "material": "100% LEATHER"
        },
        {
            "code": "TS-POLO-WHT-L",
            "name": "Classic White Polo Shirt",
            "brand": "SMRITI Fashion",
            "barcode": "8901234567891",
            "mrp": 999,
            "size": "L",
            "color": "WHITE",
            "material": "100% COTTON"
        }
    ],
    "protocol": "ZPL",
    "label_size": "50x25",
    "company_name": "SMRITI RETAIL PVT LTD"
}).encode()

try:
    req = urllib.request.Request(f"{API}/api/v1/barcode/generate-prn", data=prn_payload, headers=AUTH)
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    print(f"Success: {data.get('success')}")
    print(f"Protocol: {data.get('protocol')}")
    print(f"Total Labels: {data.get('total_labels')}")
    print(f"Items Processed: {data.get('items_processed')}")
    prn = data.get("prn", "")
    print(f"PRN Script Length: {len(prn)} bytes")
    print("\n--- RAW ZPL SCRIPT (First Label) ---")
    print(prn[:400])
    print("--- END ---")
except Exception as e:
    print(f"PRN generation request failed: {e}")

# 4. List Registered Printers
print("\n=== REGISTERED PRINTERS ===")
try:
    req = urllib.request.Request(f"{API}/api/v1/barcode/printers", headers=AUTH)
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    printers = data.get("printers", [])
    print(f"Total Printers: {len(printers)}")
    for p in printers:
        print(f"  [{p.get('printer_id')}] {p.get('name')} ({p.get('connection_type')}) @ {p.get('address')}:{p.get('port')} [{p.get('protocol')}]")
except Exception as e:
    print(f"Printer list request failed: {e}")

print("\n[DEMO COMPLETE]")
