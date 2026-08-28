"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Government Integration Platform (SGIP) — Master Test Suite.
Verifies GSTN Schema v1.03, deterministic IRN generation, signed QR construction,
NIC E-Way Bill generation, statutory thresholds, and transactional outbox retries.
"""

import pytest
import pytest_asyncio
import hashlib
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.compliance.connectors.einvoice.connector import EInvoiceConnector
from app.compliance.connectors.ewaybill.connector import EWayBillConnector
from app.compliance.services.einvoice_service import EInvoiceService
from app.compliance.services.ewaybill_service import EWayBillService
from app.compliance.services.retry_worker import ComplianceRetryWorker
from app.compliance.services.registry_service import RegistryService
from app.compliance.schemas.compliance import (
    EInvoiceGenerationRequest,
    EInvoiceItem,
    EWayBillGenerationRequest,
    CancelComplianceDocRequest,
)
from app.compliance.models.compliance import ComplianceOutbox


from app.api.deps import get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole


async def mock_admin_user():
    return User(
        id="USR-TEST-ADMIN",
        username="admin_test",
        role=UserRole.SYSADMIN,
        is_active=True,
    )


async def mock_tenant():
    return TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
    )


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[get_tenant_context] = mock_tenant
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def registry_svc():
    return RegistryService()


@pytest.fixture
def einvoice_connector():
    return EInvoiceConnector()


@pytest.fixture
def ewaybill_connector():
    return EWayBillConnector()


# ---------------------------------------------------------------------------
# Test 1: Connector Manifest Discovery
# ---------------------------------------------------------------------------
def test_01_connector_manifest_discovery(registry_svc):
    manifests = registry_svc.list_manifests()
    connector_ids = [m["id"] for m in manifests]
    
    assert "einvoice" in connector_ids, "E-Invoice connector manifest must be discovered."
    assert "ewaybill" in connector_ids, "E-Way Bill connector manifest must be discovered."

    einvoice_m = registry_svc.get_manifest("einvoice")
    assert einvoice_m["provider"] == "NIC"
    assert "generate_irn" in einvoice_m["capabilities"]
    assert "generate_qr_code" in einvoice_m["capabilities"]

    ewaybill_m = registry_svc.get_manifest("ewaybill")
    assert ewaybill_m["provider"] == "NIC"
    assert "generate_ewb" in ewaybill_m["capabilities"]


# ---------------------------------------------------------------------------
# Test 2: Deterministic SHA-256 IRN Invariance
# ---------------------------------------------------------------------------
def test_02_deterministic_irn_computation(einvoice_connector):
    supplier_gstin = "27AABCU9603R1ZM"
    financial_year = "2026-27"
    doc_type = "INV"
    doc_no = "INV/2026/0042"

    raw_token = f"{supplier_gstin}{financial_year}{doc_type}{doc_no}"
    expected_irn = hashlib.sha256(raw_token.encode("utf-8")).hexdigest().upper()

    computed_irn = einvoice_connector.compute_irn(
        supplier_gstin=supplier_gstin,
        doc_type=doc_type,
        doc_no=doc_no,
        financial_year=financial_year
    )

    assert len(computed_irn) == 64, "IRN must be exactly 64 hexadecimal characters."
    assert computed_irn == expected_irn, "IRN computation must strictly follow SHA256 formula."


# ---------------------------------------------------------------------------
# Test 3: Signed QR Code Structure
# ---------------------------------------------------------------------------
def test_03_signed_qr_payload_generation(einvoice_connector):
    qr_b64 = einvoice_connector.generate_signed_qr_payload(
        supplier_gstin="27AABCU9603R1ZM",
        buyer_gstin="29ABCDE1234F1Z5",
        doc_no="INV/2026/0042",
        doc_date="28/08/2026",
        total_inv_val=14500.50,
        item_count=3,
        main_hsn="6203",
        irn="3A5F8E1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890"
    )

    assert isinstance(qr_b64, str)
    assert len(qr_b64) > 50, "Base64 signed QR string must contain full statutory payload."


# ---------------------------------------------------------------------------
# Test 4: E-Invoice Submission & Payload Validation
# ---------------------------------------------------------------------------
def test_04_einvoice_submission(einvoice_connector):
    token = einvoice_connector.authenticate({"username": "TEST_NIC", "password": "SECRET_PASSWORD"})
    assert token.startswith("NIC-TOKEN-")

    payload = {
        "TranDtls": {"TaxSch": "GST", "SupTyp": "B2B"},
        "DocDtls": {"Typ": "INV", "No": "INV-001", "Dt": "28/08/2026", "FinYear": "2026-27"},
        "SellerDtls": {"Gstin": "27AABCU9603R1ZM", "LglNm": "SMRITI RETAIL CORP"},
        "BuyerDtls": {"Gstin": "27BBBCU9603R1ZM", "LglNm": "BUYER CORP"},
        "ItemList": [{"HsnCd": "6203", "Qty": 2, "UnitPrice": 1000}],
        "ValDtls": {"TotInvVal": 2000.0}
    }

    result = einvoice_connector.submit(payload, token=token)
    assert result["status"] == "SUCCESS"
    assert len(result["irn"]) == 64
    assert result["ack_no"] > 0
    assert result["status_code"] == "ACT"


# ---------------------------------------------------------------------------
# Test 5: Statutory E-Way Bill Threshold & Validity
# ---------------------------------------------------------------------------
def test_05_eway_bill_statutory_thresholds():
    assert EWayBillService.requires_eway_bill(50000.00) is True
    assert EWayBillService.requires_eway_bill(50000.01) is True
    assert EWayBillService.requires_eway_bill(49999.99) is False
    assert EWayBillService.requires_eway_bill(1000.00, is_interstate=True) is True

    # Validity rules: 1 day per 200 km
    assert EWayBillConnector.compute_validity_hours(50) == 24
    assert EWayBillConnector.compute_validity_hours(200) == 24
    assert EWayBillConnector.compute_validity_hours(201) == 48
    assert EWayBillConnector.compute_validity_hours(450) == 72


# ---------------------------------------------------------------------------
# Test 6: E-Way Bill Submission & 12-Digit Number Generation
# ---------------------------------------------------------------------------
def test_06_eway_bill_submission(ewaybill_connector):
    token = ewaybill_connector.authenticate({"username": "EWB_USER", "password": "EWB_PASSWORD"})
    assert token.startswith("EWB-TOKEN-")

    payload = {
        "docNo": "INV-001",
        "fromGstin": "27AABCU9603R1ZM",
        "toGstin": "27BBBCU9603R1ZM",
        "totInvValue": 75000.00,
        "transDistance": 350,
        "vehicleNo": "MH01AB1234",
    }

    result = ewaybill_connector.submit(payload, token=token)
    assert result["status"] == "SUCCESS"
    assert len(result["eway_bill_no"]) == 12, "E-Way Bill Number must be exactly 12 digits."
    assert result["trans_distance_km"] == 350
    assert result["status_code"] == "GEN"


# ---------------------------------------------------------------------------
# Test 7: Cancellation Within Window
# ---------------------------------------------------------------------------
def test_07_cancellation_workflow(einvoice_connector, ewaybill_connector):
    token1 = einvoice_connector.authenticate({"username": "U", "password": "P"})
    res1 = einvoice_connector.cancel(document_no="TEST_IRN_HASH", reason="Customer Request", token=token1)
    assert res1["status"] == "CANCELLED"
    assert res1["status_code"] == "CNL"

    token2 = ewaybill_connector.authenticate({"username": "U", "password": "P"})
    res2 = ewaybill_connector.cancel(document_no="260812345678", reason="Vehicle Breakdown", token=token2)
    assert res2["status"] == "CANCELLED"
    assert res2["status_code"] == "CAN"


# ---------------------------------------------------------------------------
# Test 8: Transactional Retry Worker State Transitions
# ---------------------------------------------------------------------------
def test_08_retry_worker_exponential_backoff():
    # Attempt 1: 15s
    t1 = ComplianceRetryWorker.compute_next_retry(1)
    # Attempt 2: 30s
    t2 = ComplianceRetryWorker.compute_next_retry(2)
    # Attempt 3: 60s
    t3 = ComplianceRetryWorker.compute_next_retry(3)

    assert (t2 - t1).total_seconds() >= 14
    assert (t3 - t2).total_seconds() >= 29


# ---------------------------------------------------------------------------
# Test 9: FastAPI Compliance Endpoints (Async Integration)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_09_fastapi_compliance_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        res_health = await client.get("/api/v1/compliance/health")
        assert res_health.status_code == 200
        health_data = res_health.json()
        assert health_data["status"] == "healthy"
        assert health_data["connectors"] >= 2

        # 2. List connectors
        res_conn = await client.get("/api/v1/compliance/connectors")
        assert res_conn.status_code == 200
        connectors = res_conn.json()
        ids = [c["id"] for c in connectors]
        assert "einvoice" in ids
        assert "ewaybill" in ids

        # 3. Generate E-Invoice endpoint
        req_einvoice = {
            "invoice_id": "INV-TEST-001",
            "invoice_no": "SMRITI/2026/001",
            "invoice_date": "28/08/2026",
            "supplier_gstin": "27AABCU9603R1ZM",
            "supplier_legal_name": "SMRITI ENTERPRISES",
            "supplier_address": "Retail Park, Mumbai",
            "supplier_pincode": "400001",
            "supplier_state_code": "27",
            "buyer_gstin": "27BBBCU9603R1ZM",
            "buyer_legal_name": "WHOLESALE TRADERS",
            "buyer_address": "Market Yard, Pune",
            "buyer_pincode": "411001",
            "buyer_state_code": "27",
            "items": [
                {
                    "item_code": "SKU-1001",
                    "description": "Cotton Shirt Blue 40",
                    "hsn_code": "6203",
                    "quantity": 10,
                    "unit": "PCS",
                    "unit_price": 1200.0,
                    "gross_amount": 12000.0,
                    "discount_amount": 1000.0,
                    "taxable_amount": 11000.0,
                    "gst_rate": 12.0,
                    "cgst_amount": 660.0,
                    "sgst_amount": 660.0,
                    "igst_amount": 0.0,
                    "total_item_value": 12320.0,
                }
            ],
            "total_taxable_value": 11000.0,
            "total_cgst_value": 660.0,
            "total_sgst_value": 660.0,
            "total_igst_value": 0.0,
            "total_invoice_value": 12320.0,
            "financial_year": "2026-27",
        }

        res_einv = await client.post("/api/v1/compliance/einvoice/generate", json=req_einvoice)
        assert res_einv.status_code == 200
        einv_data = res_einv.json()
        assert einv_data["status"] == "SUCCESS"
        assert len(einv_data["irn"]) == 64
        assert len(einv_data["signed_qr_code"]) > 0

        # 4. Generate E-Way Bill endpoint
        req_ewb = {
            "invoice_id": "INV-TEST-001",
            "doc_no": "SMRITI/2026/001",
            "doc_type": "INV",
            "from_gstin": "27AABCU9603R1ZM",
            "to_gstin": "27BBBCU9603R1ZM",
            "from_pincode": "400001",
            "to_pincode": "411001",
            "trans_distance_km": 150,
            "vehicle_no": "MH12AB9999",
            "total_invoice_value": 12320.0,
        }

        res_ewb = await client.post("/api/v1/compliance/ewaybill/generate", json=req_ewb)
        assert res_ewb.status_code == 200
        ewb_data = res_ewb.json()
        assert ewb_data["status"] == "SUCCESS"
        assert len(ewb_data["eway_bill_no"]) == 12

        # 5. Cancel E-Invoice
        res_cnl_einv = await client.post(
            "/api/v1/compliance/einvoice/cancel",
            json={"document_type": "EINVOICE", "document_no": einv_data["irn"], "reason": "Test Cancellation"}
        )
        assert res_cnl_einv.status_code == 200
        assert res_cnl_einv.json()["status"] == "CANCELLED"

        # 6. Cancel E-Way Bill
        res_cnl_ewb = await client.post(
            "/api/v1/compliance/ewaybill/cancel",
            json={"document_type": "EWAYBILL", "document_no": ewb_data["eway_bill_no"], "reason": "Order Cancelled"}
        )
        assert res_cnl_ewb.status_code == 200
        assert res_cnl_ewb.json()["status"] == "CANCELLED"
