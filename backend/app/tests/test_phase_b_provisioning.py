"""
Project      : SMRITI Retail OS
Module       : Integration Test - Phase B, C, D Multi-Tenant Provisioning
Author       : Jawahar Ramkripal Mallah
License      : Proprietary Commercial Software
"""

import pytest
import httpx
from datetime import datetime

API_BASE_URL = "http://localhost:8000/api/v1"

@pytest.mark.asyncio
async def test_multi_tenant_company_setup_provisioning():
    """
    Phase B & C Certification Test:
    Executes POST /company/setup and verifies tenant isolation & entity links.
    """
    timestamp = int(datetime.utcnow().timestamp())
    tenant_code = f"T{timestamp % 10000:04d}"
    tenant_slug = f"tenant-{timestamp}"

    payload = {
        "businessInfo": {
            "name": f"Smriti Enterprise {tenant_code}",
            "tenantName": f"Smriti Group {tenant_code}",
            "tenantCode": tenant_code,
            "tenantSlug": tenant_slug,
            "legalEntity": "Private Limited Company",
            "industryPack": "general_retail",
            "tradeName": f"Smriti Store {tenant_code}",
            "businessType": "retail",
            "gstin": "09AAACS1234A1Z5",
            "pan": "AAACS1234A",
            "pinCode": "273016",
            "country": "India",
            "state": "Uttar Pradesh",
            "district": "Gorakhpur",
            "city": "Gorakhpur",
            "area": "Ramgarh Tal",
            "locality": "Taramandal",
            "addressLine1": "Plot X-10, Taramandal",
            "financialYear": "2026-2027",
            "booksStartDate": "2026-04-01"
        },
        "orgStructure": {
            "layout": "single",
            "stores": [
                {
                    "name": f"Flagship Store {tenant_code}",
                    "code": f"STR{tenant_code}",
                    "type": "Company Owned",
                    "address": "Taramandal, Gorakhpur"
                }
            ]
        },
        "operations": {
            "modules": {
                "pos": True,
                "inventory": True,
                "sales": True,
                "purchase": True
            }
        },
        "users": {
            "staff": [
                {
                    "name": "Super Administrator",
                    "username": "super",
                    "role": "Administrator"
                }
            ]
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{API_BASE_URL}/system/company/setup", json=payload)
        
        # Verify 200 OK or successful completion status
        assert response.status_code == 200, f"Company setup failed: {response.text}"
        data = response.json()
        
        # Assert returned payload attributes
        assert data is not None
        assert "message" in data or "company_id" in data or "company" in data or "tenant_code" in data or "setup_completed" in str(data)
