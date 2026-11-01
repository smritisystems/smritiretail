from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.localization_svc import GlobalReferenceService


class FakePostalResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakePostalClient:
    def __init__(self, response, **_kwargs):
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, _url):
        return self.response


@pytest.mark.asyncio
async def test_external_postal_lookup_resolves_city_and_state(monkeypatch):
    payload = [{
        "Status": "Success",
        "PostOffice": [
            {"Pincode": "781007", "State": "Assam", "Region": "Guwahati HQ", "Division": "Guwahati"},
            {"Pincode": "781007", "State": "Assam", "Region": "Guwahati HQ", "Division": "Guwahati"},
        ],
    }]
    monkeypatch.setattr(
        "app.services.localization_svc.httpx.AsyncClient",
        lambda **kwargs: FakePostalClient(FakePostalResponse(payload), **kwargs),
    )
    state_ref = SimpleNamespace(state_code="AS", name="Assam", gst_state_code="18")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[
            SimpleNamespace(first=lambda: None),
            SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: state_ref)),
        ])
    )

    postal = await GlobalReferenceService(db).get_postal_code("781007")

    assert postal is not None
    assert postal.city == "Guwahati"
    assert postal.state_name == "Assam"
    assert postal.state_code == "AS"
    assert postal.gst_state_code == "18"


@pytest.mark.asyncio
async def test_external_postal_lookup_ignores_invalid_pins_without_network(monkeypatch):
    def unexpected_client(**_kwargs):
        raise AssertionError("Invalid PINs must not call the external provider.")

    monkeypatch.setattr("app.services.localization_svc.httpx.AsyncClient", unexpected_client)
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(first=lambda: None)))

    postal = await GlobalReferenceService(db).get_postal_code("1234")

    assert postal is None
    db.execute.assert_awaited_once()
