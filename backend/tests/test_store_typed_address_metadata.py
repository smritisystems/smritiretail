from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.crm import StoreAddressUpdate
from app.services.crm import CrmService


class FakeSession:
    def __init__(self):
        self.commits = 0

    async def commit(self):
        self.commits += 1


def _service_with_location(location):
    service = object.__new__(CrmService)
    service.db = FakeSession()
    service.get_delivery_location = AsyncMock(return_value=location)
    service._record_audit_event = AsyncMock()
    return service


@pytest.mark.asyncio
async def test_update_store_address_persists_nested_metadata_changes():
    original_address = {
        "id": "addr-001",
        "address_type": "Delivery",
        "address_line1": "Main Road",
        "city": "Guwahati",
        "state": "Assam",
        "state_code": None,
        "pincode": "781007",
        "is_primary": True,
        "is_active": True,
    }
    location = SimpleNamespace(
        id="cdl-001",
        store_code="1969",
        metadata_json={"addresses": [original_address]},
        modified_at=None,
        address_line1="Main Road",
        address_line2=None,
        city="Guwahati",
        state="Assam",
        state_code="18",
        pincode="781007",
    )
    service = _service_with_location(location)

    updated = await CrmService.update_store_address(
        service,
        "cust-001",
        location.id,
        "addr-001",
        StoreAddressUpdate(state_code="18"),
    )

    assert updated.state_code == "18"
    assert location.metadata_json["addresses"][0]["state_code"] == "18"
    assert original_address["state_code"] is None
    assert service.db.commits == 1
    service._record_audit_event.assert_awaited_once()


@pytest.mark.asyncio
async def test_deactivate_store_address_persists_nested_metadata_changes():
    original_address = {
        "id": "addr-001",
        "address_type": "Delivery",
        "address_line1": "Main Road",
        "city": "Guwahati",
        "state": "Assam",
        "state_code": "18",
        "pincode": "781007",
        "is_primary": True,
        "is_active": True,
    }
    location = SimpleNamespace(
        id="cdl-001",
        store_code="1969",
        metadata_json={"addresses": [original_address]},
        modified_at=None,
    )
    service = _service_with_location(location)

    deactivated = await CrmService.deactivate_store_address(
        service,
        "cust-001",
        location.id,
        "addr-001",
    )

    assert deactivated.is_active is False
    assert deactivated.is_primary is False
    assert location.metadata_json["addresses"][0]["is_active"] is False
    assert original_address["is_active"] is True
    assert service.db.commits == 1
    service._record_audit_event.assert_awaited_once()
