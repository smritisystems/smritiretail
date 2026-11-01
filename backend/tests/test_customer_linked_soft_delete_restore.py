import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.deps import TenantContext
from app.models.crm import Customer
from app.schemas.crm import CustomerLinkedRestoreRequest, CustomerLinkedRestoreResponse
from app.services.crm import CrmService


def _result(rows):
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    return result


def _customer(customer_id, code, *, deleted):
    return Customer(
        id=customer_id,
        code=code,
        name=f"Reliance {code}",
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
        is_deleted=deleted,
        deleted_at=None,
        deleted_by=None,
        is_active=True,
        status="Active",
        version=1,
    )


def _service(db):
    tenant = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, tenant)
    parent = _customer("parent-1", "RRL-001", deleted=False)
    service.customer_repo.get = AsyncMock(return_value=parent)
    return service


@pytest.mark.asyncio
async def test_linked_soft_deleted_restore_defaults_to_read_only_preview():
    child = _customer("child-1", "1888", deleted=True)
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=_result([child]))
    service = _service(db)

    with patch("app.services.crm.acquire_customer_hierarchy_lock", new_callable=AsyncMock):
        response = await service.restore_linked_soft_deleted_children(
            parent_customer_id="RRL-001",
            confirmed_customer_ids=[],
            expected_candidate_count=None,
            dry_run=True,
            current_user=SimpleNamespace(id="admin-1", username="admin"),
        )

    assert response["status"] == "preview"
    assert response["candidate_count"] == 1
    assert response["candidates"][0].id == "child-1"
    typed_response = CustomerLinkedRestoreResponse.model_validate(response)
    assert typed_response.parent_customer_code == "RRL-001"
    statement = db.execute.call_args.args[0]
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "customer_relationships" in compiled
    assert "FOR UPDATE OF customers" in compiled
    assert child.is_deleted is True
    db.commit.assert_not_awaited()
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_linked_soft_deleted_restore_requires_exact_confirmed_set():
    child = _customer("child-1", "1888", deleted=True)
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(side_effect=[_result([child]), _result([])])
    service = _service(db)

    with patch("app.services.crm.acquire_customer_hierarchy_lock", new_callable=AsyncMock):
        response = await service.restore_linked_soft_deleted_children(
            parent_customer_id="RRL-001",
            confirmed_customer_ids=["child-1"],
            expected_candidate_count=1,
            dry_run=False,
            current_user=SimpleNamespace(id="admin-1", username="admin"),
        )

    assert response["status"] == "restored"
    assert response["restored_count"] == 1
    assert child.is_deleted is False
    assert child.version == 2
    db.commit.assert_awaited_once()
    audit = db.add.call_args.args[0]
    assert audit.changed_record_id == "child-1"
    assert audit.change_type == "RESTORE_LINKED_CUSTOMER"
    assert audit.changed_by == "admin-1"
    assert audit.sha256_hash


@pytest.mark.asyncio
async def test_linked_soft_deleted_restore_rejects_stale_confirmation_without_writes():
    child = _customer("child-1", "1888", deleted=True)
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=_result([child]))
    service = _service(db)

    with patch("app.services.crm.acquire_customer_hierarchy_lock", new_callable=AsyncMock):
        with pytest.raises(HTTPException) as exc_info:
            await service.restore_linked_soft_deleted_children(
                parent_customer_id="RRL-001",
                confirmed_customer_ids=["different-id"],
                expected_candidate_count=1,
                dry_run=False,
                current_user=SimpleNamespace(id="admin-1", username="admin"),
            )

    assert exc_info.value.status_code == 409
    assert child.is_deleted is True
    db.commit.assert_not_awaited()
    db.add.assert_not_called()


def test_linked_soft_deleted_restore_requires_explicit_confirmation_for_writes():
    with pytest.raises(ValidationError):
        CustomerLinkedRestoreRequest(dry_run=False)

    with pytest.raises(ValidationError):
        CustomerLinkedRestoreRequest(
            dry_run=False,
            expected_candidate_count=1,
            confirmed_customer_ids=["child-1", "child-1"],
        )
