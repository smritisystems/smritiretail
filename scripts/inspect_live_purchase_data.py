import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

import urllib.request
import json
from app.core.security import create_access_token

token = create_access_token(data={'sub': 'usr-admin', 'role': 'SYSADMIN', 'company_id': 'COMP-001', 'branch_id': 'MAIN'})
headers = {'Authorization': f'Bearer {token}', 'X-Company-Id': 'COMP-001', 'X-Branch-Id': 'MAIN', 'Content-Type': 'application/json'}

order_id = '01a0b9b4-4282-7000-a28e-8a01df4be61d' # PO13-63
req = urllib.request.Request(f'http://localhost:8000/api/v1/purchase/orders/{order_id}', headers=headers)
with urllib.request.urlopen(req) as resp:
    order = json.loads(resp.read().decode())
    print(f"=== ORDER {order.get('order_no')} ITEMS ===")
    for it in order.get('items', []):
        print(f"  Item: {it.get('code')} | {it.get('name')} | Qty: {it.get('quantity')} | Cost: Rs {it.get('cost_price')} | Total: Rs {it.get('line_total')}")

req = urllib.request.Request('http://localhost:8000/api/v1/inventory/?page_size=5', headers=headers)
with urllib.request.urlopen(req) as resp:
    inv = json.loads(resp.read().decode())
    print(f"\n=== SAMPLE INVENTORY PRODUCTS ({inv.get('total')} total) ===")
    for p in inv.get('items', []):
        print(f"  Product: {p.get('code')} | Barcode: {p.get('barcode')} | {p.get('name')} | Cost: Rs {p.get('cost_price')} | Price: Rs {p.get('price')} | MRP: Rs {p.get('mrp')}")
