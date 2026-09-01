#!/usr/bin/env python
import requests
import json

# First, login to get a token
login_response = requests.post('http://localhost:8000/api/v1/auth/login', json={
    'username': 'admin',
    'password': 'admin'
})

if login_response.status_code != 200:
    print('Login failed:', login_response.status_code)
    print(login_response.text)
else:
    data = login_response.json()
    token = data.get('access_token')
    company_id = data.get('company_id', 'COMP-001')
    company_code = data.get('company_code', '001')
    print(f'Login successful')
    print(f'Company ID: {company_id}')
    print(f'Company Code: {company_code}')
    
    # Now fetch the report with proper headers
    headers = {
        'Authorization': f'Bearer {token}',
        'X-Company-Code': company_code,
        'X-Company-ID': company_id,
        'X-Branch-ID': 'MAIN',
        'X-Branch-Code': 'MAIN'
    }
    
    report_response = requests.get(
        'http://localhost:8000/api/v1/reports/sales-orders/detailed?from_date=2026-04-01&to_date=2026-09-01',
        headers=headers
    )
    
    print(f'\nReport API Status: {report_response.status_code}')
    if report_response.status_code == 200:
        report_data = report_response.json()
        print(f'Report keys: {list(report_data.keys())}')
        if 'data' in report_data:
            print(f'Number of orders: {len(report_data["data"])}')
            if report_data['data']:
                print(f'First order: {json.dumps(report_data["data"][0], indent=2, default=str)}')
    else:
        print(f'Report error: {report_response.text}')
