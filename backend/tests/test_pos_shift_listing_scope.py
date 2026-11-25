from types import SimpleNamespace

import pytest

from app.api.v1 import pos as pos_api
from app.models.auth import UserRole


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role", "expected_cashier_id"),
    [
        (UserRole.CASHIER, "cashier-1"),
        (UserRole.MANAGER, None),
    ],
)
async def test_list_shifts_scopes_cashier_results(monkeypatch, role, expected_cashier_id):
    observed = {}

    class StubPOSService:
        def __init__(self, db, tenant):
            pass

        async def list_shifts(self, cashier_id=None):
            observed["cashier_id"] = cashier_id
            return []

    monkeypatch.setattr(pos_api, "POSService", StubPOSService)

    result = await pos_api.list_shifts(
        tenant=object(),
        db=object(),
        current_user=SimpleNamespace(id="cashier-1", role=role),
    )

    assert result == []
    assert observed["cashier_id"] == expected_cashier_id


@pytest.mark.asyncio
async def test_z_report_route_passes_requesting_cashier_to_service(monkeypatch):
    observed = {}

    class StubPOSService:
        def __init__(self, db, tenant):
            pass

        async def get_z_report(self, shift_id, requesting_user_id=None, requesting_user_role=None):
            observed.update(
                shift_id=shift_id,
                requesting_user_id=requesting_user_id,
                requesting_user_role=requesting_user_role,
            )
            return {}

    monkeypatch.setattr(pos_api, "POSService", StubPOSService)

    result = await pos_api.get_shift_z_report(
        shift_id="shift-1",
        db=object(),
        tenant=object(),
        current_user=SimpleNamespace(id="cashier-1", role=UserRole.CASHIER),
    )

    assert result == {}
    assert observed == {
        "shift_id": "shift-1",
        "requesting_user_id": "cashier-1",
        "requesting_user_role": UserRole.CASHIER,
    }
