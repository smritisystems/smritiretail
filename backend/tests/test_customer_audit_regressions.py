import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock

from app.api.deps import TenantContext
from app.api.v1.crm_reports import customer_outstanding


@pytest.mark.asyncio
async def test_customer_outstanding_report_surfaces_database_failure():
    db = AsyncMock()
    db.execute.side_effect = RuntimeError("database unavailable")

    with pytest.raises(HTTPException) as exc_info:
        await customer_outstanding(
            customer_id=None,
            overdue_only=False,
            tenant=TenantContext(company_id="COMP-001", branch_id="BR-001"),
            db=db,
            current_user=None,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Unable to generate customer outstanding report."
