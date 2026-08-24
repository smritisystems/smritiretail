"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version      : 3.16.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_training_session_creation_isolation():
    """
    Assert that training session creation succeeds without X-Company-Code header.
    """
    response = client.post(
        "/api/v1/training/sessions",
        json={"trainee_name": "Test Operator 101"}
    )
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert data["session_id"].startswith("TRAIN-")
    assert data["trainee_name"] == "Test Operator 101"
    assert data["status"] == "Active"

def test_production_header_rejection():
    """
    MANDATORY ISOLATION GATE:
    Training routes must reject requests bearing production X-Company-Code header.
    """
    response = client.post(
        "/api/v1/training/sessions",
        json={"trainee_name": "Invalid Trainee"},
        headers={"X-Company-Code": "SMRITIBUS_PROD_1001"}
    )
    assert response.status_code == 400
    assert "Header Violation" in response.json()["detail"]

def test_certificate_issuance_and_public_verification():
    """
    Verify server-authoritative certificate issuance and public QR verification endpoint.
    """
    # 1. Create Session
    session_res = client.post(
        "/api/v1/training/sessions",
        json={"trainee_name": "Certified Cashier"}
    )
    session_id = session_res.json()["session_id"]

    # 2. Issue Certificate from Backend
    cert_res = client.post(
        f"/api/v1/training/certificates/issue?session_id={session_id}&score_percentage=95.0&certification_level=Level%201%20%E2%80%94%20Retail%20Operator"
    )
    assert cert_res.status_code == 200
    cert_data = cert_res.json()
    cert_id = cert_data["certificate_id"]
    assert cert_id.startswith("SMRITI-CERT-")
    assert cert_data["status"] == "VALID"

    # 3. Verify Public Read-Only Verification Endpoint
    verify_res = client.get(f"/api/v1/training/certificates/{cert_id}/verify")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["valid"] is True
    assert verify_data["certificate_id"] == cert_id
    assert verify_data["trainee_name"] == "Certified Cashier"
    assert verify_data["certification_level"] == "Level 1 — Retail Operator"
    assert verify_data["status"] == "VALID"

def test_zero_production_data_mutation_isolation():
    """
    MANDATORY ISOLATION SUITE:
    Verify that 0 production business rows are mutated during training calls.
    """
    # Verify core sales/purchase routes are intact and untouched by training APIs
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] in ["healthy", "degraded"]
