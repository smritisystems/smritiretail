from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.master_lookup import _assign_single_vendor_owner
from app.schemas.master_lookup import MasterValueResponse


def test_article_can_be_assigned_to_one_vendor_once():
    article = SimpleNamespace(vendor_code=None)

    _assign_single_vendor_owner(article, " v-001 ")
    _assign_single_vendor_owner(article, "V-001")

    assert article.vendor_code == "V-001"


def test_article_cannot_be_reassigned_to_another_vendor():
    article = SimpleNamespace(vendor_code="V-001")

    with pytest.raises(HTTPException) as error:
        _assign_single_vendor_owner(article, "V-002")

    assert error.value.status_code == 409
    assert "cannot be reassigned" in str(error.value.detail)


def test_article_response_exposes_camel_case_vendor_code():
    article = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000001",
        master_type_id="00000000-0000-0000-0000-000000000002",
        code="ART-001",
        name="Cotton Shirt",
        vendor_code="V-001",
        parent_value_id=None,
        data={},
        active=True,
        sort_order=0,
        updated_at="2026-09-12T00:00:00Z",
    )

    response = MasterValueResponse.model_validate(article)

    assert response.vendorCode == "V-001"