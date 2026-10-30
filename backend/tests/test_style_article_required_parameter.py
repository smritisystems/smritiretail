from types import SimpleNamespace

import pytest

from app.services import catalog_validation


class _FakeControlSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


@pytest.mark.asyncio
async def test_style_article_requirement_defaults_to_required(monkeypatch):
    async def no_parameter(*args, **kwargs):
        return None

    monkeypatch.setattr(catalog_validation, "async_session", _FakeControlSession)
    monkeypatch.setattr(
        catalog_validation.SystemParameterService,
        "resolve_parameter",
        no_parameter,
    )

    flags = await catalog_validation.IM001ControlledFieldValidator._load_sysparam_enforcement_flags(
        company_id="COMP-001"
    )

    assert flags["field_enforcement"]["ARTICLE_STYLE_CODE"] is True


@pytest.mark.asyncio
async def test_style_article_requirement_uses_dedicated_parameter(monkeypatch):
    requested_codes = []

    async def resolve_parameter(db, param_code, **kwargs):
        requested_codes.append(param_code)
        if param_code == "SMRITI.CATALOG.ITEM.MANDATORY_STYLE_ARTICLE":
            return SimpleNamespace(effective_value=False)
        return None

    monkeypatch.setattr(catalog_validation, "async_session", _FakeControlSession)
    monkeypatch.setattr(
        catalog_validation.SystemParameterService,
        "resolve_parameter",
        resolve_parameter,
    )

    flags = await catalog_validation.IM001ControlledFieldValidator._load_sysparam_enforcement_flags(
        company_id="COMP-001"
    )

    assert flags["field_enforcement"]["ARTICLE_STYLE_CODE"] is False
    assert "SMRITI.CATALOG.ITEM.MANDATORY_STYLE_ARTICLE" in requested_codes
    assert "ItemSubClass1HasCat" not in requested_codes
