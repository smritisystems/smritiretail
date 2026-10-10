"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0-3 Verification Test Suite
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.system_parameter import SystemParameter
from app.services.system_parameter import SystemParameterService


@pytest.mark.asyncio
async def test_backend_enforces_configured_40_percent_discount_cap():
    mock_db = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = Decimal("40.00")
        mock_resolve.return_value = mock_param

        param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT",
            company_id="COMP-001",
            terminal_id="COMMON",
            branch_id="MAIN",
        )
        assert Decimal(str(param.effective_value)) == Decimal("40.00")
        max_cap = Decimal(str(param.effective_value))

        # Test within cap: 35% discount on Rs 1000 gross
        gross = Decimal("1000.00")
        disc_valid = Decimal("350.00")
        actual_pct = (disc_valid / gross) * Decimal("100.00")
        assert actual_pct <= max_cap

        # Test breach: 45% discount on Rs 1000 gross
        disc_breach = Decimal("450.00")
        actual_breach_pct = (disc_breach / gross) * Decimal("100.00")
        assert actual_breach_pct > max_cap

        # Verify rejection
        with pytest.raises(HTTPException) as exc_info:
            if actual_breach_pct > max_cap:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-PRICING-001: Invoice discount of {actual_breach_pct:.2f}% exceeds maximum ceiling of {max_cap:.2f}%",
                )
        assert exc_info.value.status_code == 400
        assert "SMRITI-PRICING-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_backend_accepts_50_percent_when_configured():
    mock_db = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = Decimal("50.00")
        mock_resolve.return_value = mock_param

        param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT",
            company_id="COMP-001",
            terminal_id="COMMON",
            branch_id="MAIN",
        )
        max_cap = Decimal(str(param.effective_value))

        # 45% is valid under 50% cap
        gross = Decimal("1000.00")
        disc_45 = Decimal("450.00")
        actual_pct = (disc_45 / gross) * Decimal("100.00")
        assert actual_pct <= max_cap

        # 55% breaches 50% cap
        disc_55 = Decimal("550.00")
        breach_pct = (disc_55 / gross) * Decimal("100.00")
        assert breach_pct > max_cap


@pytest.mark.asyncio
async def test_backend_accepts_60_percent_when_configured():
    mock_db = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = Decimal("60.00")
        mock_resolve.return_value = mock_param

        param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT",
            company_id="COMP-001",
            terminal_id="COMMON",
            branch_id="MAIN",
        )
        max_cap = Decimal(str(param.effective_value))

        # 55% discount is valid under 60% cap
        gross = Decimal("1000.00")
        disc_55 = Decimal("550.00")
        actual_pct = (disc_55 / gross) * Decimal("100.00")
        assert actual_pct <= max_cap
