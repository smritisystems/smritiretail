"""
Project      : SMRITI Retail OS
Repository   : SMRITR Retail OS
Organization : AITDL NETWORKS
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.system import company_setup
from app.models.auth import UserRole


@pytest.mark.asyncio
async def test_company_setup_rejects_non_sysadmin_before_provisioning():
    user = SimpleNamespace(role=UserRole.MANAGER)

    with pytest.raises(HTTPException) as exc_info:
        await company_setup(payload=None, db=None, current_user=user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Only a SYSADMIN can run company setup."
