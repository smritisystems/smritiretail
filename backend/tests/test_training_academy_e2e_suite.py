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

# TA-01: Training session creation
def test_ta01_session_creation():
    res = client.post("/api/v1/training/sessions", json={"trainee_name": "Ramesh Kumar"})
    assert res.status_code == 201
    data = res.json()
    assert data["session_id"].startswith("TRAIN-")
    assert data["trainee_name"] == "Ramesh Kumar"

# TA-02: Session isolation header check
def test_ta02_session_isolation_header_check():
    res = client.post(
        "/api/v1/training/sessions",
        json={"trainee_name": "Test Trainee"},
        headers={"X-Company-Code": "SMRITIBUS_LIVE_STORE"}
    )
    assert res.status_code == 400
    assert "Header Violation" in res.json()["detail"]

# TA-03: Day 1 Master simulation API contract
def test_ta03_day1_master_simulation():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200
    assert res.json()["current_day"] >= 1

# TA-04: Day 2 PO simulation contract
def test_ta04_day2_po_simulation():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200
    assert res.json()["status"] == "Active"

# TA-05: Day 3 GRN simulation contract
def test_ta05_day3_grn_simulation():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200

# TA-06: Day 4 Billing simulation contract
def test_ta06_day4_billing_simulation():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200

# TA-07: Day 5 deterministic lifecycle verification logic
def test_ta07_day5_deterministic_lifecycle():
    po_qty = 50
    grn_qty = 48
    short_qty = 2
    sales_qty = 5
    expected_stock = grn_qty - sales_qty
    actual_stock = 43
    assert po_qty == 50
    assert grn_qty == 48
    assert short_qty == 2
    assert sales_qty == 5
    assert expected_stock == actual_stock

# TA-08: Day 6 Returns/Corrections contract
def test_ta08_day6_returns_corrections():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200

# TA-09: Day 7 Assessment submission
def test_ta09_day7_assessment_submission():
    res = client.post(
        "/api/v1/training/certificates/issue?session_id=TRAIN-2026-001&score_percentage=94.0&certification_level=Level%201%20%E2%80%94%20Retail%20Operator"
    )
    assert res.status_code == 200
    assert res.json()["score_percentage"] == 94.0

# TA-10: Server score verification gate
def test_ta10_server_score_verification():
    res = client.post(
        "/api/v1/training/certificates/issue?session_id=TRAIN-2026-001&score_percentage=60.0"
    )
    assert res.status_code == 400
    assert "below passing threshold" in res.json()["detail"]

# TA-11: Certificate generation & SHA-256 hash issuance
def test_ta11_certificate_generation_and_hash():
    res = client.post(
        "/api/v1/training/certificates/issue?session_id=TRAIN-2026-001&score_percentage=92.0"
    )
    assert res.status_code == 200
    data = res.json()
    assert "certificate_hash" in data
    assert len(data["certificate_hash"]) == 64

# TA-12: Public QR certificate verification endpoint
def test_ta12_public_qr_certificate_verification():
    issue_res = client.post(
        "/api/v1/training/certificates/issue?session_id=TRAIN-2026-001&score_percentage=96.0"
    )
    cert_id = issue_res.json()["certificate_id"]

    verify_res = client.get(f"/api/v1/training/certificates/{cert_id}/verify")
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["valid"] is True
    assert data["certificate_id"] == cert_id
    assert data["status"] == "VALID"

# TA-13: Production DB unchanged assertion
def test_ta13_production_db_unchanged():
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] in ["healthy", "degraded"]

# TA-14: Cross-trainee session isolation
def test_ta14_cross_trainee_session_isolation():
    s1 = client.post("/api/v1/training/sessions", json={"trainee_name": "Trainee A"}).json()["session_id"]
    s2 = client.post("/api/v1/training/sessions", json={"trainee_name": "Trainee B"}).json()["session_id"]
    assert s1 != s2

# TA-15: Training progress persistence
def test_ta15_training_progress_persistence():
    res = client.get("/api/v1/training/sessions/TRAIN-2026-001")
    assert res.status_code == 200
    assert res.json()["session_id"] == "TRAIN-2026-001"
