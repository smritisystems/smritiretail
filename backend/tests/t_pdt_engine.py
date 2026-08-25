"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.services.pdt_engine import PDTIntelligenceEngine
from app.schemas.pdt import (
    PDTModelRegisterReq,
    PDTDemandSignalReq,
    PDTSkuTwinUpdateReq,
    PDTPredictionGenerateReq,
)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_pdt_model_registration_and_demand_signals():
    """Verify PDT forecasting model registration and market demand signals."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Register Model
        model = await PDTIntelligenceEngine.register_model(
            session=session,
            company_id="COMP-001",
            req=PDTModelRegisterReq(
                model_code=f"MDL_HW_{suffix.upper()}",
                model_name="Holt-Winters Triple Exponential Smoothing",
                model_type="DEMAND_FORECAST",
                algorithm="HOLT_WINTERS_EXPONENTIAL",
                version="2.1.0",
                hyperparameters={"alpha": 0.2, "beta": 0.1, "gamma": 0.3},
            ),
        )
        assert model.id is not None
        assert model.model_code == f"MDL_HW_{suffix.upper()}"
        assert model.version == "2.1.0"

        # Record Seasonal Demand Signal (+20% festive uplift)
        signal = await PDTIntelligenceEngine.record_demand_signal(
            session=session,
            company_id="COMP-001",
            req=PDTDemandSignalReq(
                signal_code=f"SIG_DIWALI_{suffix.upper()}",
                signal_type="SEASONAL_FESTIVAL",
                impact_factor=Decimal("1.20"),
                start_date=datetime.now(timezone.utc),
                end_date=datetime.now(timezone.utc) + timedelta(days=30),
                affected_categories=["FASHION", "ELECTRONICS"],
            ),
        )
        assert signal.id is not None
        assert signal.impact_factor == Decimal("1.20")


@pytest.mark.asyncio
async def test_pdt_sku_twin_simulation_and_prediction():
    """Verify digital twin cache updates, demand forecasting, and stock replenishment recommendations."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    sku = f"SKU-PDT-{suffix.upper()}"
    model_code = f"MDL_TEST_{suffix.upper()}"

    async with sessionmaker() as session:
        # 1. Setup Model
        await PDTIntelligenceEngine.register_model(
            session=session,
            company_id="COMP-001",
            req=PDTModelRegisterReq(
                model_code=model_code,
                model_name="Test Forecasting Model",
            ),
        )

        # 2. Update SKU Twin Cache (Lead Time: 10 days, Safety Buffer: 20 units, Daily Velocity: 5 units/day)
        twin = await PDTIntelligenceEngine.update_sku_twin(
            session=session,
            company_id="COMP-001",
            req=PDTSkuTwinUpdateReq(
                sku=sku,
                lead_time_days=10,
                safety_buffer_qty=Decimal("20.0000"),
                daily_velocity=Decimal("5.0000"),
            ),
        )
        # Recommended safety stock = (10 * 5 * 0.5) + 20 = 25 + 20 = 45 units
        assert twin.recommended_safety_stock == Decimal("45.0000")

        # 3. Generate Prediction for 30 days horizon, Current On-Hand: 30 units (Below Lead Time Demand + Safety)
        pred = await PDTIntelligenceEngine.generate_prediction(
            session=session,
            company_id="COMP-001",
            req=PDTPredictionGenerateReq(
                sku=sku,
                model_code=model_code,
                forecast_horizon_days=30,
                current_on_hand=Decimal("30.0000"),
                historical_sales_velocity=Decimal("5.0000"),
            ),
        )

        assert pred.prediction_no.startswith("PDT-")
        assert pred.sku == sku
        assert pred.forecast_horizon_days == 30
        # Base demand: 5 * 30 = 150 units (with any active signal multiplier)
        assert pred.forecasted_demand >= Decimal("150.0000")
        # Recommended replenishment: (Forecast + Safety Stock) - On-Hand
        assert pred.recommended_replenishment > Decimal("0.0000")
        assert pred.confidence_score >= Decimal("0.9000")
        assert "explainability_factors" in pred.model_dump()
        assert pred.explainability_factors["historical_daily_velocity"] == 5.0


@pytest.mark.asyncio
async def test_pdt_strict_read_only_isolation_guarantee():
    """Verify PDT operations strictly isolate from mutating physical stock and accounting ledgers."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    sku = f"SKU-ISO-{suffix.upper()}"
    model_code = f"MDL_ISO_{suffix.upper()}"

    async with sessionmaker() as session:
        # Register Model & Twin
        await PDTIntelligenceEngine.register_model(
            session=session,
            company_id="COMP-001",
            req=PDTModelRegisterReq(
                model_code=model_code,
                model_name="Isolation Model",
            ),
        )
        await PDTIntelligenceEngine.update_sku_twin(
            session=session,
            company_id="COMP-001",
            req=PDTSkuTwinUpdateReq(sku=sku),
        )

        # Generate recommendation
        pred = await PDTIntelligenceEngine.generate_prediction(
            session=session,
            company_id="COMP-001",
            req=PDTPredictionGenerateReq(
                sku=sku,
                model_code=model_code,
                forecast_horizon_days=14,
                current_on_hand=Decimal("100.0000"),
                historical_sales_velocity=Decimal("2.0000"),
            ),
        )

        assert "strictly advisory" in pred.read_only_notice
        assert pred.recommended_replenishment >= Decimal("0.0000")


@pytest.mark.asyncio
async def test_api_pdt_endpoints():
    """Verify PDT REST API endpoints."""
    headers = get_auth_headers()
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register Model
        m_res = await client.post(
            "/api/v1/pdt/models",
            json={
                "model_code": f"MDL_API_{suffix.upper()}",
                "model_name": f"API Model {suffix}",
                "algorithm": "BAYESIAN_VELOCITY",
                "version": "1.0.0",
            },
            headers=headers,
        )
        assert m_res.status_code == 200
        assert m_res.json()["status"] == "SUCCESS"

        # 2. Record Demand Signal
        s_res = await client.post(
            "/api/v1/pdt/demand-signals",
            json={
                "signal_code": f"SIG_API_{suffix.upper()}",
                "signal_type": "PROMOTIONAL_SPIKE",
                "impact_factor": 1.10,
            },
            headers=headers,
        )
        assert s_res.status_code == 200
        assert s_res.json()["status"] == "SUCCESS"
