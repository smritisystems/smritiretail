"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Live Headless API Verification Harness for Sales Orders and Report Studios
"""

import urllib.request
import json

# 1. Login
login_data = json.dumps({'username': 'admin', 'password': 'Admin@123'}).encode()
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
token = None
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        token = res.get('access_token')
        print("Logged in successfully. Token acquired.")
except Exception as e:
    print('Login error:', e)

if token:
    headers = {
        'Authorization': f'Bearer {token}',
        'X-Company-ID': 'COMP-001',
        'X-Branch-ID': 'BR-MAIN-001',
        'X-Company-Code': '001',
        'X-Branch-Code': 'MAIN'
    }

    # 2. Test /api/v1/reports/studios
    req2 = urllib.request.Request('http://localhost:8000/api/v1/reports/studios', headers=headers)
    with urllib.request.urlopen(req2) as resp2:
        data = json.loads(resp2.read().decode())
        studios = data.get('studios', data)
        sales_studio = studios.get('sales_studio', {})
        reports = sales_studio.get('reports', [])
        print(f"\n--- Total reports in sales_studio: {len(reports)} ---")
        for r in reports:
            print(f"  [{r.get('id')}] {r.get('title')} ({r.get('category')})")

    # 3. Test /api/v1/sales/orders/
    req3 = urllib.request.Request('http://localhost:8000/api/v1/sales/orders/', headers=headers)
    with urllib.request.urlopen(req3) as resp3:
        orders = json.loads(resp3.read().decode())
        print(f"\n--- Total sales orders returned: {len(orders)} ---")
        if orders:
            first = orders[0]
            print('Sample Order Keys:', list(first.keys()))
            print('Sample Order Fields:')
            print(json.dumps({
                'order_no': first.get('order_no'),
                'po_number': first.get('po_number'),
                'customer_name': first.get('customer_name'),
                'date': first.get('date'),
                'grand_total': str(first.get('grand_total')),
                'billed_value': str(first.get('billed_value')),
                'pending_value': str(first.get('pending_value')),
                'fulfillment_status': first.get('fulfillment_status'),
                'allocations_count': len(first.get('allocations', [])),
                'items_count': len(first.get('items', []))
            }, indent=2))
