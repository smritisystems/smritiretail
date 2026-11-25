from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.api.v1 import store_day as store_day_api
from app.services.store_day_svc import StoreDayService


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeDatabase:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeResult(self.rows)


@pytest.mark.asyncio
async def test_list_store_days_filters_company_branch_date_and_deleted_rows():
    day = SimpleNamespace(
        id="day-1",
        company_id="COMP-001",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="OPEN",
        opened_at=datetime(2026, 11, 25, 3, tzinfo=timezone.utc),
        is_deleted=False,
    )
    db = FakeDatabase([day])
    service = StoreDayService(db, SimpleNamespace(company_id="COMP-001"))

    result = await service.list_store_days("BR-001", date(2026, 11, 25))

    assert result == [day]
    sql = str(db.statement.compile(compile_kwargs={"literal_binds": True}))
    assert "company_id = 'COMP-001'" in sql
    assert "branch_id = 'BR-001'" in sql
    assert "business_date = '2026-11-25'" in sql
    assert "is_deleted = false" in sql


@pytest.mark.asyncio
async def test_list_store_days_route_returns_frontend_store_day_contract(monkeypatch):
    day = SimpleNamespace(
        id="day-1",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="OPEN",
        opened_at=datetime(2026, 11, 25, 3, tzinfo=timezone.utc),
        closed_at=None,
        locked_at=None,
        opened_by="manager-1",
        closed_by=None,
        locked_by=None,
        sign_off_notes=None,
        exception_summary_json=None,
    )
    observed = {}

    class StubStoreDayService:
        def __init__(self, db, tenant):
            pass

        async def list_store_days(self, branch_id, business_date):
            observed.update(branch_id=branch_id, business_date=business_date)
            return [day]

    monkeypatch.setattr(store_day_api, "StoreDayService", StubStoreDayService)

    result = await store_day_api.list_store_days(
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        current_user=SimpleNamespace(),
        db=object(),
        tenant=object(),
    )

    assert observed == {
        "branch_id": "BR-001",
        "business_date": date(2026, 11, 25),
    }
    assert result == [{
        "id": "day-1",
        "branch_id": "BR-001",
        "business_date": "2026-11-25",
        "status": "OPEN",
        "opened_at": "2026-11-25T03:00:00+00:00",
        "closed_at": None,
        "locked_at": None,
        "opened_by": "manager-1",
        "closed_by": None,
        "locked_by": None,
        "sign_off_notes": None,
        "exception_summary": None,
    }]
