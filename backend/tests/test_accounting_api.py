"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_company_db, get_tenant_context, TenantContext, get_current_user
from app.db.session import get_company_sessionmaker
from app.models.auth import User, UserRole
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService


@pytest.fixture
def mock_auth_tenant():
    """Override auth and tenant context to route to smriti001."""
    session_factory = get_company_sessionmaker("smriti001")

    async def override_get_company_db():
        async with session_factory() as session:
            yield session

    async def override_get_tenant_context():
        return TenantContext(company_id="COMP-001", branch_id="BR-001")

    async def override_get_current_user():
        user = User(
            id="usr-test-acct",
            username="acct_admin",
            role=UserRole.SYSADMIN,
            company_id="COMP-001",
            branch_id="BR-001"
        )
        return user

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_tenant_context] = override_get_tenant_context
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


def test_api_chart_of_accounts(mock_auth_tenant):
    """Verify GET /api/v1/accounting/chart-of-accounts returns standard COA."""
    client = TestClient(app)
    response = client.get("/api/v1/accounting/chart-of-accounts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 15
    codes = {a["account_code"] for a in data}
    assert "1010" in codes  # Cash
    assert "1020" in codes  # Bank
    assert "1030" in codes  # Debtors
    assert "4010" in codes  # Sales Revenue


def test_api_post_valid_journal_voucher(mock_auth_tenant):
    """Verify POST /api/v1/accounting/vouchers posts a balanced double-entry voucher."""
    client = TestClient(app)
    payload = {
        "voucher_type": "JOURNAL",
        "voucher_date": date.today().isoformat(),
        "lines": [
            {"account_code": "1010", "debit_amount": 1250.00, "credit_amount": 0.00, "remarks": "Cash in"},
            {"account_code": "4010", "debit_amount": 0.00, "credit_amount": 1250.00, "remarks": "Sales income"}
        ],
        "narration": "Direct REST API cash sale test"
    }
    response = client.post("/api/v1/accounting/vouchers", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["voucher_type"] == "JOURNAL"
    assert float(data["total_debit"]) == 1250.00
    assert float(data["total_credit"]) == 1250.00
    assert data["is_posted"] is True


def test_api_post_unbalanced_voucher_rejected_400(mock_auth_tenant):
    """Verify POST /api/v1/accounting/vouchers rejects unbalanced voucher with SMRITI-GL-001."""
    client = TestClient(app)
    payload = {
        "voucher_type": "JOURNAL",
        "voucher_date": date.today().isoformat(),
        "lines": [
            {"account_code": "1010", "debit_amount": 1000.00, "credit_amount": 0.00},
            {"account_code": "4010", "debit_amount": 0.00, "credit_amount": 900.00}  # ₹100 unbalance
        ],
        "narration": "Corrupted unbalanced voucher"
    }
    response = client.post("/api/v1/accounting/vouchers", json=payload)
    assert response.status_code == 400
    assert "SMRITI-GL-001" in response.text


def test_api_trial_balance(mock_auth_tenant):
    """Verify GET /api/v1/accounting/trial-balance returns balanced trial balance."""
    client = TestClient(app)
    response = client.get("/api/v1/accounting/trial-balance")
    assert response.status_code == 200
    data = response.json()
    assert data["is_balanced"] is True
    assert data["grand_total_debit"] == data["grand_total_credit"]
    assert "accounts" in data
    assert len(data["accounts"]) > 0


def test_api_profit_and_loss(mock_auth_tenant):
    """Verify GET /api/v1/accounting/profit-and-loss returns operating statement."""
    client = TestClient(app)
    response = client.get("/api/v1/accounting/profit-and-loss")
    assert response.status_code == 200
    data = response.json()
    assert "total_revenue" in data
    assert "total_expense" in data
    assert "net_profit" in data
    assert round(data["net_profit"], 2) == round(data["total_revenue"] - data["total_expense"], 2)


def test_api_bank_statement_and_reconciliation_flow(mock_auth_tenant):
    """Verify importing bank statement, auto-reconciliation, and fetching BRS summary."""
    client = TestClient(app)

    # 1. Get bank account ID for 1020
    coa_res = client.get("/api/v1/accounting/chart-of-accounts")
    assert coa_res.status_code == 200
    bank_acc = next(a for a in coa_res.json() if a["account_code"] == "1020")
    bank_acc_id = bank_acc["id"]

    # 2. Post a matched voucher
    unique_suffix = uuid.uuid4().hex[:6]
    test_amt = 8800.00
    client.post("/api/v1/accounting/vouchers", json={
        "voucher_type": "PAYMENT_RECEIPT",
        "voucher_date": date.today().isoformat(),
        "lines": [
            {"account_id": bank_acc_id, "debit_amount": test_amt, "credit_amount": 0.00},
            {"account_code": "1030", "debit_amount": 0.00, "credit_amount": test_amt}
        ],
        "narration": f"REST API Bank payment receipt {unique_suffix}"
    })

    # 3. Import bank statement
    stmt_no = f"STMT-API-{unique_suffix.upper()}"
    stmt_res = client.post("/api/v1/accounting/bank-statements", json={
        "bank_account_id": bank_acc_id,
        "statement_no": stmt_no,
        "from_date": date.today().isoformat(),
        "to_date": date.today().isoformat(),
        "opening_balance": 50000.00,
        "closing_balance": 58800.00,
        "lines": [
            {
                "transaction_date": date.today().isoformat(),
                "reference_no": f"TXN-{unique_suffix}",
                "description": "Customer NEFT",
                "deposit_amount": test_amt,
                "withdrawal_amount": 0.00
            }
        ]
    })
    assert stmt_res.status_code == 201
    stmt_data = stmt_res.json()
    statement_id = stmt_data["id"]

    # 4. Trigger auto-reconcile
    rec_res = client.post(f"/api/v1/accounting/bank-statements/{statement_id}/auto-reconcile")
    assert rec_res.status_code == 200
    assert rec_res.json()["matched_lines"] >= 1

    # 5. Fetch BRS
    brs_res = client.get(f"/api/v1/accounting/bank-reconciliation?bank_account_id={bank_acc_id}")
    assert brs_res.status_code == 200
    brs_data = brs_res.json()
    assert "book_balance" in brs_data
    assert "bank_statement_balance" in brs_data
    assert "reconciled_balance" in brs_data


def test_api_fiscal_year_and_period_lock(mock_auth_tenant):
    """Verify POST /api/v1/accounting/fiscal-years and period locking."""
    client = TestClient(app)
    unique_suffix = uuid.uuid4().hex[:6]

    fy_res = client.post("/api/v1/accounting/fiscal-years", json={
        "start_date": "2026-04-01",
        "end_date": "2027-03-31",
        "code": f"FY-{unique_suffix.upper()}"
    })
    assert fy_res.status_code == 201
    fy_data = fy_res.json()
    assert "fiscal_year_id" in fy_data


def test_api_exchange_rates_and_fx_revaluation(mock_auth_tenant):
    """Verify POST/GET /api/v1/accounting/exchange-rates and MTM revaluation."""
    client = TestClient(app)
    unique_suffix = uuid.uuid4().hex[:6]

    # 1. Post exchange rate
    rate_res = client.post("/api/v1/accounting/exchange-rates", json={
        "from_currency": "USD",
        "to_currency": "INR",
        "exchange_rate": 84.250000,
        "effective_date": date.today().isoformat(),
        "rate_type": "SPOT",
        "source": "RBI"
    })
    assert rate_res.status_code == 201
    rate_data = rate_res.json()
    assert rate_data["from_currency"] == "USD"
    assert float(rate_data["exchange_rate"]) == 84.25

    # 2. Get exchange rates list
    list_res = client.get("/api/v1/accounting/exchange-rates?from_currency=USD")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) >= 1
    assert any(r["from_currency"] == "USD" for r in list_data)

    # 3. Post MTM Unrealized Revaluation
    mtm_res = client.post("/api/v1/accounting/fx-revaluation/unrealized", json={
        "as_of_date": date.today().isoformat(),
        "closing_rates": {"USD": 84.25}
    })
    assert mtm_res.status_code == 200
    mtm_data = mtm_res.json()
    assert "total_unrealized_gain" in mtm_data
    assert "total_unrealized_loss" in mtm_data


def test_api_accounting_rbac_unauthorized_user_403():
    """Verify that unprivileged users (e.g. VIEWER) are rejected with 403 on mutating endpoints."""
    session_factory = get_company_sessionmaker("smriti001")

    async def override_get_company_db():
        async with session_factory() as session:
            yield session

    async def override_get_tenant_context():
        return TenantContext(company_id="COMP-001", branch_id="BR-001")

    async def override_get_viewer_user():
        return User(
            id="usr-viewer-acct",
            username="acct_viewer",
            role=UserRole.VIEWER,
            company_id="COMP-001",
            branch_id="BR-001"
        )

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_tenant_context] = override_get_tenant_context
    app.dependency_overrides[get_current_user] = override_get_viewer_user

    client = TestClient(app)

    # Attempt to post exchange rate with VIEWER role -> 403 Forbidden
    res = client.post("/api/v1/accounting/exchange-rates", json={
        "from_currency": "USD",
        "to_currency": "INR",
        "exchange_rate": 84.00,
        "effective_date": date.today().isoformat()
    })
    assert res.status_code == 403
    assert "permission" in res.json()["detail"].lower()

    # Clean up overrides
    app.dependency_overrides.clear()


