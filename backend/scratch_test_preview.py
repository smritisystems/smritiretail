import urllib.request
import json
import sys

data = json.dumps({"username": "admin", "password": "Admin@123"}).encode("utf-8")
req = urllib.request.Request("http://localhost:1981/api/v1/auth/login", data=data, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as resp:
    token_data = json.loads(resp.read().decode())
    token = token_data.get("access_token")

def test_items(name, items):
    payload = {
        "context": {
            "company_id": "COMP-001",
            "branch_id": "MAIN",
            "source_channel": "MODERN_TRADE",
            "sales_channel": "MODERN_TRADE"
        },
        "items": items,
        "customer_id": "cust-rrl-192b561d",
        "customer_name": "Reliance Retail Limited"
    }

    req2 = urllib.request.Request(
        "http://localhost:1981/api/v1/billing/preview",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req2) as resp2:
            print(f"[{name}] STATUS: 200")
    except urllib.error.HTTPError as err:
        print(f"[{name}] STATUS: {err.code} DETAIL: {err.read().decode('utf-8', 'replace')}")

l1 = {
    "code": "CH-03-A-ROSEGOLD-41",
    "product_id": "itm_dee5ba353edc",
    "quantity": 1,
    "unit_price": 2599,
    "disc_pct": 0,
    "disc_amt": 1137.32,
    "gst_rate": 5,
    "hsn_code": "64032012",
    "mrp": 2599,
    "is_tax_inclusive": False
}
l2 = {
    "code": "CH-03-A-ROSEGOLD-41",
    "product_id": "prod-ch-03-a-rose-gold-41",
    "quantity": 2,
    "unit_price": 2599,
    "disc_pct": 0,
    "disc_amt": 2274.64,
    "gst_rate": 5,
    "hsn_code": "64032012",
    "mrp": 2599,
    "is_tax_inclusive": True
}
test_items("LINE 1 ONLY", [l1])
test_items("LINE 2 ONLY", [l2])
