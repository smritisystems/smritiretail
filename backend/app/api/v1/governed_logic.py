"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.models.governed_logic import (
    FormulaDefinition,
    BusinessRuleDefinition,
    PolicyDefinition,
    WorkflowDefinition,
)
from app.services.governed_rules import GovernedRuleEngine
from app.services.tx_reproduce_svc import TransactionReproducibilityService

router = APIRouter()


class FormulaEvalRequest(BaseModel):
    ast: Dict[str, Any]
    params: Dict[str, Any] = Field(default_factory=dict)


class BusinessRuleEvalRequest(BaseModel):
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]]
    context: Dict[str, Any]


class GstTaxPolicyEvalRequest(BaseModel):
    line_items: List[Dict[str, Any]]
    supplier_state: str = "27"
    recipient_state: str = "27"
    parameters: Optional[Dict[str, Any]] = None


class WorkflowTransitionRequest(BaseModel):
    workflow_code: str
    current_state: str
    action: str
    user_roles: List[str]


class TransactionReplayRequest(BaseModel):
    snapshot: Dict[str, Any]
    transaction_payload: Dict[str, Any]
    historical_catalog: Dict[str, Any]


@router.post("/formulas/evaluate")
async def evaluate_formula(req: FormulaEvalRequest):
    """Safe, deterministic formula AST evaluator (no eval)."""
    try:
        res = GovernedRuleEngine.evaluate_formula_ast(req.ast, req.params)
        return {"result": float(res), "result_decimal": str(res)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rules/evaluate")
async def evaluate_rule(req: BusinessRuleEvalRequest):
    """Evaluates declarative business conditions and returns applied actions."""
    try:
        res = GovernedRuleEngine.evaluate_business_rule(req.conditions, req.actions, req.context)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/policies/gst/evaluate")
async def evaluate_gst_tax(req: GstTaxPolicyEvalRequest):
    """Calculates statutory GST intrastate vs interstate tax breakdown."""
    try:
        res = GovernedRuleEngine.evaluate_gst_tax_policy(
            line_items=req.line_items,
            supplier_state_code=req.supplier_state,
            recipient_state_code=req.recipient_state,
            policy_parameters=req.parameters
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/workflows/transition")
async def evaluate_workflow_transition(req: WorkflowTransitionRequest, db: AsyncSession = Depends(get_db)):
    """Validates state machine transitions against versioned workflow definitions."""
    stmt = select(WorkflowDefinition).where(
        WorkflowDefinition.code == req.workflow_code,
        WorkflowDefinition.is_active == True
    ).order_by(WorkflowDefinition.version.desc())
    wf = (await db.execute(stmt)).scalars().first()

    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{req.workflow_code}' not found")

    res = GovernedRuleEngine.evaluate_workflow_transition(
        workflow_def={"transitions": wf.transitions, "states": wf.states},
        current_state=req.current_state,
        action=req.action,
        user_roles=req.user_roles
    )
    return res


@router.post("/reproducibility/replay")
async def replay_transaction(req: TransactionReplayRequest):
    """Reproduces historical transaction calculation using rule snapshots."""
    try:
        res = TransactionReproducibilityService.replay_transaction_with_historical_rules(
            snapshot=req.snapshot,
            transaction_payload=req.transaction_payload,
            historical_rule_catalog=req.historical_catalog
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
