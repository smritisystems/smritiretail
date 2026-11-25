from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.store_day_svc import StoreDayService


class CountResult:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value


class CountDatabase:
    def __init__(self, value):
        self.value = value
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return CountResult(self.value)


class EmptyResult:
    def scalars(self):
        return self

    def all(self):
        return []

    def scalar_one_or_none(self):
        return None


class ReportDatabase:
    async def execute(self, _statement):
        return EmptyResult()

    async def flush(self):
        pass


class SequenceResult:
    def __init__(self, rows=None, row=None):
        self.rows = rows or []
        self.row = row

    def scalars(self):
        return self

    def all(self):
        return self.rows

    def scalar_one_or_none(self):
        return self.row


class SequenceDatabase:
    def __init__(self, results):
        self.results = iter(results)

    async def execute(self, _statement):
        return next(self.results)

class AssignmentDatabase:
    def __init__(self, results):
        self.results = iter(results)
        self.added = []
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return next(self.results)

    def add(self, entity):
        self.added.append(entity)

    async def flush(self):
        pass


@pytest.mark.asyncio
async def test_open_shift_count_is_scoped_to_company_and_branch():
    db = CountDatabase(2)
    service = StoreDayService(
        db,
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    assert await service._count_open_shifts("BR-001") == 2
    sql = str(db.statement.compile(compile_kwargs={"literal_binds": True}))
    assert "company_id = 'COMP-001'" in sql
    assert "branch_id = 'BR-001'" in sql
    assert "status = 'OPEN'" in sql
    assert "is_deleted IS false" in sql


@pytest.mark.asyncio
async def test_store_day_close_rejects_open_shift_even_when_force_is_requested():
    day = SimpleNamespace(id="day-1", status="OPEN", branch_id="BR-001")

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

        async def _count_open_shifts(self, _branch_id):
            return 1

    service = TestStoreDayService(
        ReportDatabase(),
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    with pytest.raises(ValueError, match="cashier shift.*still OPEN"):
        await service.close_store_day("day-1", "manager-1", force=True)

    assert day.status == "OPEN"

@pytest.mark.asyncio
async def test_store_day_close_rejects_unassigned_closed_shifts_even_when_forced():
    day = SimpleNamespace(id="day-1", status="OPEN", branch_id="BR-001")
    unassigned = [SimpleNamespace(id="shift-1")]

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

        async def _count_open_shifts(self, _branch_id):
            return 0

        async def _list_unassigned_closed_shifts(self, _day):
            return unassigned

    service = TestStoreDayService(
        ReportDatabase(),
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    with pytest.raises(ValueError, match="closed cashier shift.*not included"):
        await service.close_store_day("day-1", "manager-1", force=True)

    assert day.status == "OPEN"


@pytest.mark.asyncio
async def test_eod_report_includes_branch_open_shift_count():
    day = SimpleNamespace(
        id="day-1",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="OPEN",
        opened_at=None,
        closed_at=None,
        opened_by="manager-1",
        closed_by=None,
        sign_off_notes=None,
        exception_summary_json=None,
    )

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

        async def _count_pending_approvals(self, _branch_id):
            return 0

        async def _count_pending_sync(self, _branch_id):
            return 0

        async def _count_open_shifts(self, _branch_id):
            return 2

    service = TestStoreDayService(
        ReportDatabase(),
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    report = await service.get_eod_report("day-1")

    assert report["open_shifts"] == 2


@pytest.mark.asyncio
async def test_eod_report_shows_tender_totals_and_hides_incomplete_variance_sum():
    day = SimpleNamespace(
        id="day-1",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="CLOSED",
        opened_at=None,
        closed_at=None,
        opened_by="manager-1",
        closed_by="manager-1",
        sign_off_notes=None,
        exception_summary_json=None,
    )
    shifts = [
        SimpleNamespace(
            id="shift-1",
            cashier_id="cashier-1",
            status="CLOSED",
            opened_at=None,
            closed_at=None,
            opening_balance=0,
            closing_balance="50.00",
            cash_sales_total=0,
            cash_in_total="50.00",
            cash_drops_total=0,
            till_expenses_total=0,
            card_sales_total="75.50",
            actual_card_counted="70.00",
            card_variance="-5.50",
            upi_sales_total="24.50",
            actual_upi_counted="25.00",
            upi_variance="0.50",
            total_sales="100.00",
            total_invoices="1",
        ),
        SimpleNamespace(
            id="shift-2",
            cashier_id="cashier-2",
            status="CLOSED",
            opened_at=None,
            closed_at=None,
            opening_balance=0,
            closing_balance=0,
            cash_sales_total=0,
            cash_in_total=0,
            cash_drops_total=0,
            till_expenses_total=0,
            card_sales_total="20.00",
            actual_card_counted=None,
            card_variance=None,
            upi_sales_total="10.00",
            actual_upi_counted="10.00",
            upi_variance="0.00",
            total_sales="30.00",
            total_invoices="1",
        ),
    ]
    unassigned_shift = SimpleNamespace(
        id="shift-unassigned",
        cashier_id="cashier-3",
        closed_at=None,
        total_sales="42.00",
    )
    db = SequenceDatabase([
        SequenceResult(rows=[
            SimpleNamespace(shift_id="shift-1"),
            SimpleNamespace(shift_id="shift-2"),
        ]),
        SequenceResult(rows=[unassigned_shift]),
        SequenceResult(row=shifts[0]),
        SequenceResult(row=shifts[1]),
    ])

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

        async def _count_pending_approvals(self, _branch_id):
            return 0

        async def _count_pending_sync(self, _branch_id):
            return 0

        async def _count_open_shifts(self, _branch_id):
            return 0

    service = TestStoreDayService(
        db,
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    report = await service.get_eod_report("day-1")

    assert report["shifts"][0]["actual_card_counted"] == "70.00"
    assert report["shifts"][0]["card_variance"] == "-5.50"
    assert report["shifts"][0]["actual_upi_counted"] == "25.00"
    assert report["shifts"][0]["upi_variance"] == "0.50"
    assert report["shifts"][0]["expected_cash"] == "50.00"
    assert report["shifts"][0]["cash_variance"] == "0.00"
    assert report["unassigned_closed_shifts"] == [{
        "shift_id": "shift-unassigned",
        "cashier_id": "cashier-3",
        "closed_at": None,
        "total_sales": "42.00",
    }]
    assert report["tender_reconciliation"] == {
        "assigned_shifts": 2,
        "card_reconciled_shifts": 1,
        "card_variance": None,
        "upi_reconciled_shifts": 2,
        "upi_variance": "0.50",
    }


@pytest.mark.asyncio
async def test_assign_shift_validates_branch_day_and_closed_date_and_is_idempotent():
    day = SimpleNamespace(
        id="day-1",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="OPEN",
    )
    shift = SimpleNamespace(
        id="shift-1",
        status="CLOSED",
        closed_at=datetime(2026, 11, 24, 19, tzinfo=timezone.utc),
    )
    existing_assignment = SimpleNamespace(
        id="assignment-1",
        store_day_id="day-1",
        shift_id="shift-1",
    )

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

    db = AssignmentDatabase([
        SequenceResult(row=shift),
        SequenceResult(row=existing_assignment),
    ])
    service = TestStoreDayService(
        db,
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    result = await service.assign_shift_to_day("day-1", "shift-1", "manager-1")

    assert result is existing_assignment
    assert db.added == []
    shift_lookup_sql = str(db.statements[0].compile(compile_kwargs={"literal_binds": True}))
    assert "company_id = 'COMP-001'" in shift_lookup_sql
    assert "branch_id = 'BR-001'" in shift_lookup_sql


@pytest.mark.asyncio
async def test_assign_shift_rejects_a_closed_shift_from_a_different_business_date():
    day = SimpleNamespace(
        id="day-1",
        branch_id="BR-001",
        business_date=date(2026, 11, 25),
        status="OPEN",
    )
    shift = SimpleNamespace(
        id="shift-1",
        status="CLOSED",
        closed_at=datetime(2026, 11, 24, 10, tzinfo=timezone.utc),
    )

    class TestStoreDayService(StoreDayService):
        async def _get_day_or_raise(self, _store_day_id):
            return day

    service = TestStoreDayService(
        AssignmentDatabase([SequenceResult(row=shift)]),
        SimpleNamespace(company_id="COMP-001", branch_id="BR-001"),
    )

    with pytest.raises(ValueError, match="different business date"):
        await service.assign_shift_to_day("day-1", "shift-1", "manager-1")
