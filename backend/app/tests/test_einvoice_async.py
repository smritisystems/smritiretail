"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.121.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Integration tests for E-Invoice Studio async migration (v3.121.0).

All endpoints use the conftest disposable_company_database + auto_override_company_db
fixtures — each test gets a fresh PostgreSQL clone. No manual DB teardown needed.

Test Cases
----------
TC-EI-001  List e-invoices — empty list on fresh DB
TC-EI-002  Generate IRN — creates GENERATED record with valid IRN + ack_no
TC-EI-003  Generate IRN — idempotency: second call returns same record
TC-EI-004  List e-invoices — returns the generated record, status filter works
TC-EI-005  Get e-invoice by ID — 200 with correct data
TC-EI-006  Get e-invoice by ID — 404 on unknown ID
TC-EI-007  Cancel IRN — transitions GENERATED -> CANCELLED
TC-EI-008  Cancel IRN — 409 on already-cancelled IRN
TC-EI-009  Cancel IRN — 400 on invalid cancel_reason
TC-EI-010  Submit batch — creates QUEUED batch with correct total_invoices
TC-EI-011  Get batch by ID — 200 with correct data
TC-EI-012  Get batch by ID — 404 on unknown batch ID
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from sqlalchemy import text

from app.main import app


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE  = "http://test"
EI    = "/api/v1/einvoice-studio"         # mount prefix from main.py


def _uid() -> str:
    return uuid.uuid4().hex[:10]


def _headers() -> dict:
    """Minimal headers — conftest auto_override_company_db injects test session."""
    return {"X-Company-ID": "test-co", "X-Branch-ID": "test-br"}


# ---------------------------------------------------------------------------
# Helper: generate a single e-invoice
# ---------------------------------------------------------------------------

async def _generate(ac: AsyncClient, invoice_id: str | None = None, invoice_no: str | None = None) -> dict:
    uid = _uid()
    payload = {
        "invoice_id":     invoice_id or f"INV-{uid}",
        "invoice_no":     invoice_no or f"TAX/{uid}/2026-27",
        "gstin_supplier": "29AABCU9603R1ZX",
        "gstin_buyer":    "27AAPFU0939F1ZV",
        "invoice_value":  "12500.00",
    }
    resp = await ac.post(f"{EI}/einvoice/generate", json=payload, headers=_headers())
    assert resp.status_code == 201, f"generate failed: {resp.status_code} {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# TC-EI-001  List — empty on fresh DB
# ---------------------------------------------------------------------------

async def test_ei001_list_empty():
    """Fresh DB: GET /einvoice returns an empty list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        resp = await ac.get(f"{EI}/einvoice", headers=_headers())
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) == 0


# ---------------------------------------------------------------------------
# TC-EI-002  Generate IRN
# ---------------------------------------------------------------------------

async def test_ei002_generate_irn():
    """POST /einvoice/generate creates a GENERATED record with a 64-char IRN."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)

    assert rec["status"] == "GENERATED"
    assert rec["irn"] is not None
    assert len(rec["irn"]) == 64,            f"IRN should be 64 hex chars, got {len(rec['irn'])}"
    assert rec["ack_no"] is not None
    assert rec["ack_no"].startswith("AC")
    assert rec["cancel_reason"] is None
    assert rec["cancelled_at"] is None
    assert "id" in rec


# ---------------------------------------------------------------------------
# TC-EI-003  Idempotency — same invoice_id returns same record
# ---------------------------------------------------------------------------

async def test_ei003_generate_idempotent():
    """Second generate call for the same invoice_id returns the existing record."""
    invoice_id = f"INV-IDEM-{_uid()}"
    invoice_no = f"TAX/IDEM/{_uid()}/2026-27"
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        first  = await _generate(ac, invoice_id=invoice_id, invoice_no=invoice_no)
        second = await _generate(ac, invoice_id=invoice_id, invoice_no=invoice_no)

    assert first["id"] == second["id"],  "Idempotency violation: different IDs returned"
    assert first["irn"] == second["irn"], "Idempotency violation: different IRNs returned"


# ---------------------------------------------------------------------------
# TC-EI-004  List — status filter
# ---------------------------------------------------------------------------

async def test_ei004_list_with_status_filter():
    """After generating a record, list returns it; status filter works correctly."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)

        # Unfiltered list must contain our record
        all_resp = await ac.get(f"{EI}/einvoice", headers=_headers())
        assert all_resp.status_code == 200
        ids = [r["id"] for r in all_resp.json()]
        assert rec["id"] in ids

        # Filter by GENERATED — must include ours
        gen_resp = await ac.get(f"{EI}/einvoice?status=GENERATED", headers=_headers())
        assert gen_resp.status_code == 200
        gen_ids = [r["id"] for r in gen_resp.json()]
        assert rec["id"] in gen_ids

        # Filter by CANCELLED — must NOT include ours (not cancelled yet)
        can_resp = await ac.get(f"{EI}/einvoice?status=CANCELLED", headers=_headers())
        assert can_resp.status_code == 200
        can_ids = [r["id"] for r in can_resp.json()]
        assert rec["id"] not in can_ids


# ---------------------------------------------------------------------------
# TC-EI-005  Get by ID — 200
# ---------------------------------------------------------------------------

async def test_ei005_get_by_id():
    """GET /einvoice/{id} returns the correct record."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)
        resp = await ac.get(f"{EI}/einvoice/{rec['id']}", headers=_headers())

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == rec["id"]
    assert data["irn"] == rec["irn"]
    assert data["status"] == "GENERATED"


# ---------------------------------------------------------------------------
# TC-EI-006  Get by ID — 404
# ---------------------------------------------------------------------------

async def test_ei006_get_by_id_not_found():
    """GET /einvoice/{unknown_id} returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        resp = await ac.get(f"{EI}/einvoice/nonexistent-id-xyz", headers=_headers())
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TC-EI-007  Cancel IRN — GENERATED -> CANCELLED
# ---------------------------------------------------------------------------

async def test_ei007_cancel_irn():
    """POST /einvoice/cancel transitions a GENERATED record to CANCELLED."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)

        cancel_resp = await ac.post(
            f"{EI}/einvoice/cancel",
            json={"irn": rec["irn"], "cancel_reason": "2", "cancel_remark": "Test data entry mistake"},
            headers=_headers(),
        )

    assert cancel_resp.status_code == 200, f"cancel failed: {cancel_resp.status_code} {cancel_resp.text}"
    data = cancel_resp.json()
    assert data["status"] == "CANCELLED"
    assert data["cancel_reason"] == "2"
    assert data["cancel_remark"] == "Test data entry mistake"
    assert data["cancelled_at"] is not None


# ---------------------------------------------------------------------------
# TC-EI-008  Cancel IRN — 409 already cancelled
# ---------------------------------------------------------------------------

async def test_ei008_cancel_already_cancelled():
    """Cancelling an already-CANCELLED IRN returns 409."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)
        await ac.post(
            f"{EI}/einvoice/cancel",
            json={"irn": rec["irn"], "cancel_reason": "1"},
            headers=_headers(),
        )
        # Second cancel
        resp2 = await ac.post(
            f"{EI}/einvoice/cancel",
            json={"irn": rec["irn"], "cancel_reason": "1"},
            headers=_headers(),
        )
    assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# TC-EI-009  Cancel IRN — 400 invalid cancel_reason
# ---------------------------------------------------------------------------

async def test_ei009_cancel_invalid_reason():
    """cancel_reason outside {1,2,3,4} returns 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        rec = await _generate(ac)
        resp = await ac.post(
            f"{EI}/einvoice/cancel",
            json={"irn": rec["irn"], "cancel_reason": "9"},
            headers=_headers(),
        )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# TC-EI-010  Submit batch
# ---------------------------------------------------------------------------

async def test_ei010_submit_batch():
    """POST /einvoice/batch creates a QUEUED batch with correct total_invoices count."""
    invoice_ids = [f"INV-{_uid()}" for _ in range(5)]
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        resp = await ac.post(
            f"{EI}/einvoice/batch",
            json={"invoice_ids": invoice_ids, "notes": "Test batch submission"},
            headers=_headers(),
        )

    assert resp.status_code == 201, f"batch submit failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert data["status"] == "QUEUED"
    assert data["total_invoices"] == 5
    assert data["batch_no"].startswith("EIB-")
    assert data["notes"] == "Test batch submission"
    assert data["success_count"] == 0
    assert data["failed_count"] == 0


# ---------------------------------------------------------------------------
# TC-EI-011  Get batch by ID — 200
# ---------------------------------------------------------------------------

async def test_ei011_get_batch_by_id():
    """GET /einvoice/batch/{id} returns the correct batch record."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        batch = (await ac.post(
            f"{EI}/einvoice/batch",
            json={"invoice_ids": ["INV-A", "INV-B"], "notes": None},
            headers=_headers(),
        )).json()

        resp = await ac.get(f"{EI}/einvoice/batch/{batch['id']}", headers=_headers())

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == batch["id"]
    assert data["batch_no"] == batch["batch_no"]
    assert data["total_invoices"] == 2


# ---------------------------------------------------------------------------
# TC-EI-012  Get batch by ID — 404
# ---------------------------------------------------------------------------

async def test_ei012_get_batch_not_found():
    """GET /einvoice/batch/{unknown} returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as ac:
        resp = await ac.get(f"{EI}/einvoice/batch/no-such-batch-xyz", headers=_headers())
    assert resp.status_code == 404
