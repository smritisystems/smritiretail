from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.api.v1 import universal_master
from app.api.deps import TenantContext
from app.schemas.item_master import ItemTaxonomyUpdateRequest
from app.services.catalog_validation import CatalogDimensionValidator
from app.services.compliance_audit import ComplianceAuditService


class _Scalars:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class _Result:
    def __init__(self, value):
        self.value = value

    def scalars(self):
        return _Scalars(self.value)


class _Session:
    def __init__(self, item):
        self.item = item
        self.commit = AsyncMock()

    async def execute(self, _statement):
        return _Result(self.item)


def test_item_taxonomy_update_requires_nonempty_supported_fields():
    with pytest.raises(ValidationError):
        ItemTaxonomyUpdateRequest()

    with pytest.raises(ValidationError):
        ItemTaxonomyUpdateRequest(category="   ")

    with pytest.raises(ValidationError):
        ItemTaxonomyUpdateRequest(category="FOOTWEAR", brand="SMRITI")

    request = ItemTaxonomyUpdateRequest(category="  FOOTWEAR  ")
    assert request.category == "FOOTWEAR"


@pytest.mark.asyncio
async def test_item_taxonomy_update_preserves_other_fields_and_audits_changes(monkeypatch):
    item = SimpleNamespace(
        id="item-001",
        item_code="STYLE-001",
        company_id="COMP-001",
        is_deleted=False,
        category="OTHERS",
        product_type="OTHERS",
        brand="TATTLY THREADS",
    )
    db = _Session(item)
    audit = AsyncMock()

    async def normalize(cls, dimension_field, value, strict=True, control_db=None):
        assert strict is True
        assert control_db is db
        return value.upper()

    monkeypatch.setattr(
        CatalogDimensionValidator,
        "validate_and_normalize_dimension",
        classmethod(normalize),
    )
    monkeypatch.setattr(ComplianceAuditService, "record_audit_event", audit)

    result = await universal_master.update_item_taxonomy(
        "item-001",
        ItemTaxonomyUpdateRequest(category="footwear", product_type="chappal"),
        db=db,
        tenant_ctx=TenantContext(company_id="COMP-001", branch_id="BR-001"),
        current_user=SimpleNamespace(id="user-001", role="MANAGER"),
    )

    assert result is item
    assert item.category == "FOOTWEAR"
    assert item.product_type == "CHAPPAL"
    assert item.brand == "TATTLY THREADS"
    db.commit.assert_awaited_once()
    audit.assert_awaited_once()
    audit_kwargs = audit.await_args.kwargs
    assert audit_kwargs["before_state"] == {
        "category": "OTHERS",
        "product_type": "OTHERS",
    }
    assert audit_kwargs["after_state"] == {
        "category": "FOOTWEAR",
        "product_type": "CHAPPAL",
    }
