"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.8
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.item_taxonomy import (
    resolve_product_attribute_lookup_values,
    resolve_product_taxonomy_value,
)


class _Result:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values


class _Session:
    def __init__(self, *results):
        self._results = iter(results)

    async def execute(self, _statement):
        return next(self._results)


@pytest.mark.asyncio
async def test_resolves_product_taxonomy_to_active_lookup_label():
    session = _Session(
        _Result(value="category-type-id"),
        _Result(values=[SimpleNamespace(code="FOOTWEAR", name="Footwear")]),
    )

    result = await resolve_product_taxonomy_value(session, "category", " footwear ")

    assert result == "Footwear"


@pytest.mark.asyncio
async def test_exact_lookup_label_disambiguates_brand_casing_variants():
    session = _Session(
        _Result(value="brand-type-id"),
        _Result(values=[
            SimpleNamespace(code="TATTLY-THREADS-MIXED", name="Tattly Threads"),
            SimpleNamespace(code="TATTLY-THREADS", name="TATTLY THREADS"),
        ]),
    )

    result = await resolve_product_taxonomy_value(session, "brand", "Tattly Threads")

    assert result == "Tattly Threads"


@pytest.mark.asyncio
async def test_unmatched_value_recommends_master_registry_before_item_master():
    session = _Session(_Result(value="gender-type-id"), _Result())

    with pytest.raises(HTTPException) as exc_info:
        await resolve_product_taxonomy_value(session, "gender", "UNKNOWN")

    assert exc_info.value.status_code == 422
    assert "Add and approve it under lookup type 'gender' in Master Registry first" in exc_info.value.detail


@pytest.mark.asyncio
async def test_resolves_controlled_item_attributes_and_preserves_other_attributes():
    session = _Session(
        _Result(value="gender-type-id"),
        _Result(values=[SimpleNamespace(code="LADIES", name="Ladies")]),
        _Result(value="outsole-type-id"),
        _Result(values=[SimpleNamespace(code="TPR", name="TPR")]),
    )

    result = await resolve_product_attribute_lookup_values(
        session,
        {"gender": "LADIES", "outsole_material": "TPR", "custom_note": "keep"},
    )

    assert result == {
        "gender": "Ladies",
        "outsole_material": "TPR",
        "custom_note": "keep",
    }


@pytest.mark.asyncio
async def test_missing_lookup_type_is_reported_as_configuration_error():
    session = _Session(_Result())

    with pytest.raises(HTTPException) as exc_info:
        await resolve_product_taxonomy_value(session, "product_type", "SHOE")

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_unmatched_lookup_value_is_rejected():
    session = _Session(_Result(value="product-type-id"), _Result())

    with pytest.raises(HTTPException) as exc_info:
        await resolve_product_taxonomy_value(session, "product_type", "UNKNOWN")

    assert exc_info.value.status_code == 422
