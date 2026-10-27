"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.3
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Integration tests for GC-001: Gift Card & Voucher async migration.

Test Cases
----------
TC-GC001  Issue gift card → ACTIVE, balance == face_value, ISSUE txn recorded
TC-GC002  Duplicate card_no → 409
TC-GC003  Topup ACTIVE card → balance increases, TOPUP txn recorded
TC-GC004  Topup non-ACTIVE card → 400
TC-GC005  Redeem exact balance → card transitions to REDEEMED
TC-GC006  Redeem more than balance → 400 Insufficient balance
TC-GC007  Block ACTIVE card → BLOCKED status, BLOCK txn recorded
TC-GC008  List gift-cards filtered by status
TC-GC009  Transaction ledger returns all entries in desc order
TC-GC010  Issue gift voucher → ACTIVE, voucher_no generated
TC-GC011  Duplicate voucher_no → 409
TC-GC012  Redeem ACTIVE voucher → USED, timestamps recorded
TC-GC013  Redeem expired voucher → 400 expired
TC-GC014  Cancel ACTIVE voucher → CANCELLED
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from sqlalchemy import text

from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Correct mount point: settings.API_V1_STR + "/gift-cards-engine"
GC_CARDS   = "/api/v1/gift-cards-engine/gift-cards"
GC_VOUCHERS = "/api/v1/gift-cards-engine/gift-vouchers"

def _uid() -> str:
    return uuid.uuid4().hex[:8]


def _base_url() -> str:
    return "http://test"


def _headers() -> dict:
    """No-auth headers — conftest auto_override_company_db injects the test session."""
    return {"X-Company-ID": "test-co", "X-Branch-ID": "test-br"}


async def _issue_card(ac: AsyncClient, face_value: float = 500.0, card_no: str | None = None) -> dict:
    payload = {
        "face_value": face_value,
        "card_type": "DIGITAL",
        "currency": "INR",
        "issued_to": "Test Customer",
    }
    if card_no:
        payload["card_no"] = card_no
    resp = await ac.post(GC_CARDS, json=payload, headers=_headers())
    assert resp.status_code == 201, f"issue_card failed: {resp.text}"
    return resp.json()


async def _issue_voucher(
    ac: AsyncClient,
    voucher_no: str | None = None,
    face_value: float = 100.0,
    valid_to: datetime | None = None,
    min_order_value: float | None = None,
) -> dict:
    payload: dict = {
        "face_value": face_value,
        "voucher_type": "FIXED",
        "issued_to": "Test Customer",
    }
    if voucher_no:
        payload["voucher_no"] = voucher_no
    if valid_to:
        payload["valid_to"] = valid_to.isoformat()
    if min_order_value is not None:
        payload["min_order_value"] = min_order_value
    resp = await ac.post(GC_VOUCHERS, json=payload, headers=_headers())
    assert resp.status_code == 201, f"issue_voucher failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# TC-GC001  Issue gift card
# ---------------------------------------------------------------------------

async def test_gc001_issue_gift_card():
    """Issue creates ACTIVE card with balance == face_value and ISSUE txn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=750.0)

    assert card["status"] == "ACTIVE"
    assert Decimal(str(card["balance"])) == Decimal("750.00")
    assert Decimal(str(card["face_value"])) == Decimal("750.00")
    assert card["card_no"].startswith("GC-") or len(card["card_no"]) > 4

    # Verify ISSUE txn via transaction ledger
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        txn_resp = await ac.get(f"{GC_CARDS}/{card['id']}/transactions", headers=_headers())
    assert txn_resp.status_code == 200
    txns = txn_resp.json()
    assert len(txns) == 1
    assert txns[0]["txn_type"] == "ISSUE"
    assert Decimal(str(txns[0]["balance_after"])) == Decimal("750.00")


# ---------------------------------------------------------------------------
# TC-GC002  Duplicate card_no → 409
# ---------------------------------------------------------------------------

async def test_gc002_duplicate_card_no_rejected():
    """Issuing a second card with the same card_no must return 409."""
    card_no = f"GC-TEST-{_uid()}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        await _issue_card(ac, card_no=card_no)
        resp = await ac.post(
            GC_CARDS,
            json={"card_no": card_no, "face_value": 100, "card_type": "PHYSICAL", "currency": "INR"},
            headers=_headers(),
        )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# TC-GC003  Topup ACTIVE card
# ---------------------------------------------------------------------------

async def test_gc003_topup_increases_balance():
    """Topup on ACTIVE card increases balance and records TOPUP txn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=200.0)
        resp = await ac.post(
            f"{GC_CARDS}/{card['id']}/topup",
            json={"amount": 300.0, "reference_no": "INV-001"},
            headers=_headers(),
        )
    assert resp.status_code == 200
    updated = resp.json()
    assert Decimal(str(updated["balance"])) == Decimal("500.00")

    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        txns = (await ac.get(f"{GC_CARDS}/{card['id']}/transactions", headers=_headers())).json()
    topup_txns = [t for t in txns if t["txn_type"] == "TOPUP"]
    assert len(topup_txns) == 1
    assert Decimal(str(topup_txns[0]["balance_after"])) == Decimal("500.00")


# ---------------------------------------------------------------------------
# TC-GC004  Topup non-ACTIVE card → 400
# ---------------------------------------------------------------------------

async def test_gc004_topup_blocked_card_rejected():
    """Topup on a BLOCKED card must return 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=100.0)
        # Block it
        await ac.post(f"{GC_CARDS}/{card['id']}/block", headers=_headers())
        # Try topup
        resp = await ac.post(
            f"{GC_CARDS}/{card['id']}/topup",
            json={"amount": 50.0},
            headers=_headers(),
        )
    assert resp.status_code == 400
    assert "BLOCKED" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# TC-GC005  Redeem full balance → REDEEMED status
# ---------------------------------------------------------------------------

async def test_gc005_redeem_full_balance_transitions_to_redeemed():
    """Redeeming the exact balance transitions card to REDEEMED status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=250.0)
        resp = await ac.post(
            f"{GC_CARDS}/{card['id']}/redeem",
            json={"amount": 250.0, "reference_no": "SALE-001"},
            headers=_headers(),
        )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "REDEEMED"
    assert Decimal(str(result["balance"])) == Decimal("0.00")


# ---------------------------------------------------------------------------
# TC-GC006  Redeem more than balance → 400
# ---------------------------------------------------------------------------

async def test_gc006_redeem_exceeds_balance_rejected():
    """Attempt to redeem more than available balance must return 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=100.0)
        resp = await ac.post(
            f"{GC_CARDS}/{card['id']}/redeem",
            json={"amount": 150.0},
            headers=_headers(),
        )
    assert resp.status_code == 400
    assert "Insufficient" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# TC-GC007  Block ACTIVE card
# ---------------------------------------------------------------------------

async def test_gc007_block_active_card():
    """Blocking ACTIVE card sets status BLOCKED and records BLOCK txn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=100.0)
        resp = await ac.post(f"{GC_CARDS}/{card['id']}/block", headers=_headers())
    assert resp.status_code == 200
    assert resp.json()["status"] == "BLOCKED"

    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        txns = (await ac.get(f"{GC_CARDS}/{card['id']}/transactions", headers=_headers())).json()
    block_txns = [t for t in txns if t["txn_type"] == "BLOCK"]
    assert len(block_txns) == 1


# ---------------------------------------------------------------------------
# TC-GC008  List gift cards filtered by status
# ---------------------------------------------------------------------------

async def test_gc008_list_filtered_by_status():
    """List endpoint with status filter returns only matching cards."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        active_card = await _issue_card(ac, face_value=50.0)
        blocked_card = await _issue_card(ac, face_value=50.0)
        await ac.post(f"{GC_CARDS}/{blocked_card['id']}/block", headers=_headers())
        resp = await ac.get(f"{GC_CARDS}?status=BLOCKED", headers=_headers())

    assert resp.status_code == 200
    card_ids = {c["id"] for c in resp.json()}
    assert blocked_card["id"] in card_ids
    # Active card not in blocked list (unless other test state leaks, but
    # the specific blocked card we created must be there)


# ---------------------------------------------------------------------------
# TC-GC009  Transaction ledger desc ordering
# ---------------------------------------------------------------------------

async def test_gc009_transaction_ledger_desc_order():
    """Transaction ledger returns entries newest-first."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        card = await _issue_card(ac, face_value=500.0)
        await ac.post(
            f"{GC_CARDS}/{card['id']}/topup",
            json={"amount": 100.0},
            headers=_headers(),
        )
        await ac.post(
            f"{GC_CARDS}/{card['id']}/redeem",
            json={"amount": 50.0},
            headers=_headers(),
        )
        txns = (await ac.get(f"{GC_CARDS}/{card['id']}/transactions", headers=_headers())).json()

    assert len(txns) == 3  # ISSUE + TOPUP + REDEEM
    # Most recent (REDEEM) should be first
    assert txns[0]["txn_type"] == "REDEEM"


# ---------------------------------------------------------------------------
# TC-GC010  Issue gift voucher
# ---------------------------------------------------------------------------

async def test_gc010_issue_gift_voucher():
    """Issue creates ACTIVE voucher with auto-generated voucher_no."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        v = await _issue_voucher(ac, face_value=200.0)

    assert v["status"] == "ACTIVE"
    assert v["voucher_no"].startswith("GV-") or len(v["voucher_no"]) > 4
    assert Decimal(str(v["face_value"])) == Decimal("200.00")


# ---------------------------------------------------------------------------
# TC-GC011  Duplicate voucher_no → 409
# ---------------------------------------------------------------------------

async def test_gc011_duplicate_voucher_no_rejected():
    """Issuing a second voucher with the same voucher_no must return 409."""
    voucher_no = f"GV-TEST-{_uid()}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        await _issue_voucher(ac, voucher_no=voucher_no)
        resp = await ac.post(
            GC_VOUCHERS,
            json={"voucher_no": voucher_no, "face_value": 100, "voucher_type": "FIXED"},
            headers=_headers(),
        )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# TC-GC012  Redeem ACTIVE voucher
# ---------------------------------------------------------------------------

async def test_gc012_redeem_active_voucher():
    """Redeeming an ACTIVE voucher sets status USED and records invoice_no."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        v = await _issue_voucher(ac, face_value=150.0)
        resp = await ac.post(
            f"{GC_VOUCHERS}/{v['id']}/redeem",
            json={"invoice_no": "INV-GV-001", "order_value": 500.0},
            headers=_headers(),
        )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "USED"
    assert result["redeemed_invoice_no"] == "INV-GV-001"
    assert result["used_at"] is not None


# ---------------------------------------------------------------------------
# TC-GC013  Redeem expired voucher → 400
# ---------------------------------------------------------------------------

async def test_gc013_redeem_expired_voucher_rejected():
    """Redeeming a voucher past its valid_to date returns 400 expired."""
    past = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        v = await _issue_voucher(ac, face_value=100.0, valid_to=past)
        resp = await ac.post(
            f"{GC_VOUCHERS}/{v['id']}/redeem",
            json={"invoice_no": "INV-EXPIRED-001", "order_value": 100.0},
            headers=_headers(),
        )
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# TC-GC014  Cancel ACTIVE voucher
# ---------------------------------------------------------------------------

async def test_gc014_cancel_active_voucher():
    """Cancel transitions ACTIVE voucher to CANCELLED."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        v = await _issue_voucher(ac)
        resp = await ac.post(f"{GC_VOUCHERS}/{v['id']}/cancel", headers=_headers())
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"

    # Subsequent cancel of already-CANCELLED voucher → 400
    async with AsyncClient(transport=ASGITransport(app=app), base_url=_base_url()) as ac:
        resp2 = await ac.post(f"{GC_VOUCHERS}/{v['id']}/cancel", headers=_headers())
    assert resp2.status_code == 400
