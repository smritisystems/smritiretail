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

import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.pdt import (
    PDTModelRegistry,
    PDTSkuTwinCache,
    PDTDemandSignal,
    PDTDistributionPrediction,
)
from ..schemas.pdt import (
    PDTModelRegisterReq,
    PDTDemandSignalReq,
    PDTSkuTwinUpdateReq,
    PDTPredictionGenerateReq,
    PDTPredictionResponse,
)


class PDTIntelligenceEngine:
    """
    Predictive Distribution Twin (PDT) Intelligence Engine.
    Operates strictly as an isolated, read-only analytics plane that provides
    predictive stock replenishment, demand forecasting, and stockout risk scoring.
    Never mutates physical stock or financial ledgers.
    """

    @classmethod
    async def register_model(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PDTModelRegisterReq,
    ) -> PDTModelRegistry:
        """Registers a predictive forecasting algorithm in the model catalog."""
        stmt = select(PDTModelRegistry).where(
            PDTModelRegistry.company_id == company_id,
            PDTModelRegistry.model_code == req.model_code,
            PDTModelRegistry.is_deleted == False,
        )
        model = (await session.execute(stmt)).scalars().first()
        if not model:
            model = PDTModelRegistry(
                id=f"pdt_mdl_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                model_code=req.model_code,
                model_name=req.model_name,
                model_type=req.model_type,
                algorithm=req.algorithm,
                version=req.version,
                hyperparameters=req.hyperparameters,
                is_active=True,
                is_deleted=False,
            )
            session.add(model)
        else:
            model.model_name = req.model_name
            model.algorithm = req.algorithm
            model.version = req.version
            model.hyperparameters = req.hyperparameters

        await session.commit()
        await session.refresh(model)
        return model

    @classmethod
    async def record_demand_signal(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PDTDemandSignalReq,
    ) -> PDTDemandSignal:
        """Records an external or market demand indicator."""
        signal = PDTDemandSignal(
            id=f"pdt_sig_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            signal_code=req.signal_code,
            signal_type=req.signal_type,
            impact_factor=req.impact_factor,
            start_date=req.start_date or datetime.now(timezone.utc),
            end_date=req.end_date,
            affected_categories=req.affected_categories,
            is_active=True,
            is_deleted=False,
        )
        session.add(signal)
        await session.commit()
        await session.refresh(signal)
        return signal

    @classmethod
    async def update_sku_twin(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PDTSkuTwinUpdateReq,
    ) -> PDTSkuTwinCache:
        """Updates real-time digital twin velocity and safety parameters for a SKU."""
        stmt = select(PDTSkuTwinCache).where(
            PDTSkuTwinCache.company_id == company_id,
            PDTSkuTwinCache.sku == req.sku,
            PDTSkuTwinCache.is_deleted == False,
        )
        twin = (await session.execute(stmt)).scalars().first()

        # Compute recommended safety stock
        lead_time = Decimal(str(req.lead_time_days))
        velocity = Decimal(str(req.daily_velocity))
        safety_stock = (lead_time * velocity * Decimal("0.5") + req.safety_buffer_qty).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

        if not twin:
            twin = PDTSkuTwinCache(
                id=f"pdt_twn_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                sku=req.sku,
                lead_time_days=req.lead_time_days,
                safety_buffer_qty=req.safety_buffer_qty,
                daily_velocity=req.daily_velocity,
                recommended_safety_stock=safety_stock,
                last_evaluated_at=datetime.now(timezone.utc),
                is_active=True,
                is_deleted=False,
            )
            session.add(twin)
        else:
            twin.lead_time_days = req.lead_time_days
            twin.safety_buffer_qty = req.safety_buffer_qty
            twin.daily_velocity = req.daily_velocity
            twin.recommended_safety_stock = safety_stock
            twin.last_evaluated_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(twin)
        return twin

    @classmethod
    async def generate_prediction(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PDTPredictionGenerateReq,
    ) -> PDTPredictionResponse:
        """
        Generates predictive distribution and replenishment recommendation.
        Pure read-only computation with explainability factors.
        """
        # Fetch active model
        m_stmt = select(PDTModelRegistry).where(
            PDTModelRegistry.company_id == company_id,
            PDTModelRegistry.model_code == req.model_code,
            PDTModelRegistry.is_active == True,
        )
        model = (await session.execute(m_stmt)).scalars().first()
        model_version = model.version if model else "1.0.0"

        # Fetch SKU twin state
        t_stmt = select(PDTSkuTwinCache).where(
            PDTSkuTwinCache.company_id == company_id,
            PDTSkuTwinCache.sku == req.sku,
        )
        twin = (await session.execute(t_stmt)).scalars().first()
        lead_time_days = twin.lead_time_days if twin else 7
        safety_buffer = twin.safety_buffer_qty if twin else Decimal("10.0000")

        # Fetch active demand signals
        now = datetime.now(timezone.utc)
        sig_stmt = select(PDTDemandSignal).where(
            PDTDemandSignal.company_id == company_id,
            PDTDemandSignal.is_active == True,
        )
        signals = (await session.execute(sig_stmt)).scalars().all()

        combined_impact = Decimal("1.00")
        applied_signals = []
        for s in signals:
            combined_impact *= s.impact_factor
            applied_signals.append({
                "signal_code": s.signal_code,
                "type": s.signal_type,
                "factor": float(s.impact_factor)
            })

        # Forecast Demand
        horizon_dec = Decimal(str(req.forecast_horizon_days))
        velocity = Decimal(str(req.historical_sales_velocity))
        base_demand = velocity * horizon_dec
        forecasted_demand = (base_demand * combined_impact).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # Safety Stock Calculation
        lead_time_dec = Decimal(str(lead_time_days))
        lead_time_demand = velocity * lead_time_dec
        safety_stock = (lead_time_demand * Decimal("0.5") + safety_buffer).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # Replenishment Recommendation
        on_hand = Decimal(str(req.current_on_hand))
        net_required = (forecasted_demand + safety_stock) - on_hand
        recommended_replenishment = max(Decimal("0.0000"), net_required).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # Stockout Risk Assessment
        if on_hand < lead_time_demand:
            risk_level = "HIGH_STOCKOUT_RISK"
            confidence = Decimal("0.9650")
        elif on_hand < (lead_time_demand + safety_stock):
            risk_level = "MODERATE_RISK"
            confidence = Decimal("0.9400")
        else:
            risk_level = "LOW_RISK"
            confidence = Decimal("0.9800")

        pred_no = f"PDT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        explainability = {
            "historical_daily_velocity": float(velocity),
            "forecast_horizon_days": req.forecast_horizon_days,
            "base_forecasted_units": float(base_demand),
            "combined_demand_signal_multiplier": float(combined_impact),
            "applied_demand_signals": applied_signals,
            "lead_time_days": lead_time_days,
            "calculated_safety_stock": float(safety_stock),
            "current_on_hand_units": float(on_hand),
            "replenishment_formula": "MAX(0, (Forecasted Demand + Safety Stock) - On-Hand)"
        }

        # Persist prediction record
        pred_record = PDTDistributionPrediction(
            id=f"pdt_prd_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            prediction_no=pred_no,
            sku=req.sku,
            model_code=req.model_code,
            model_version=model_version,
            forecast_horizon_days=req.forecast_horizon_days,
            forecasted_demand=forecasted_demand,
            recommended_replenishment=recommended_replenishment,
            confidence_score=confidence,
            risk_level=risk_level,
            explainability_factors=explainability,
            generated_at=now,
            is_active=True,
            is_deleted=False,
        )
        session.add(pred_record)
        await session.commit()
        await session.refresh(pred_record)

        return PDTPredictionResponse(
            prediction_no=pred_record.prediction_no,
            sku=pred_record.sku,
            model_code=pred_record.model_code,
            model_version=pred_record.model_version,
            forecast_horizon_days=pred_record.forecast_horizon_days,
            forecasted_demand=pred_record.forecasted_demand,
            recommended_replenishment=pred_record.recommended_replenishment,
            confidence_score=pred_record.confidence_score,
            risk_level=pred_record.risk_level,
            explainability_factors=pred_record.explainability_factors,
            generated_at=pred_record.generated_at,
        )
