"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.schemas.gov_logic import (
    FormulaDefinitionResponse,
    FormulaEvalRequest,
    FormulaEvalResponse,
    BusinessRuleResponse,
    BusinessRuleEvalRequest,
    BusinessRuleEvalResponse,
    PolicyDefinitionResponse,
    GstTaxPolicyEvalRequest,
    WorkflowDefinitionResponse,
    WorkflowTransitionRequest,
    WorkflowTransitionResponse,
    DefinitionValidationRequest,
    DefinitionValidationResponse,
)
from app.schemas.tx_reproduce import (
    GovernanceSnapshot,
    SnapshotCreateRequest,
    TransactionReplayRequest,
    TransactionReplayResponse,
)
from app.services.governed_rules import GovernedRuleEngine
from app.services.tx_reproduce_svc import TransactionReproducibilityService

router = APIRouter()


# ---------------------------------------------------------------------------
# Formulas
# ---------------------------------------------------------------------------

@router.get("/formulas", response_model=List[FormulaDefinitionResponse])
async def list_formula_definitions(
    category: Optional[str] = Query(None, description="Optional formula category filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active formula definitions registered in smritisys."""
    stmt = select(FormulaDefinition).where(
        FormulaDefinition.is_active == True,
        FormulaDefinition.is_deleted == False,
    )
    if category:
        stmt = stmt.where(FormulaDefinition.category == category.upper())
    stmt = stmt.order_by(FormulaDefinition.code)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/formulas/evaluate", response_model=FormulaEvalResponse)
async def evaluate_formula(
    req: FormulaEvalRequest,
    current_user: User = Depends(get_current_user),
):
    """Safe, deterministic formula AST evaluator (no eval)."""
    try:
        res = GovernedRuleEngine.evaluate_formula_ast(req.ast, req.params)
        return FormulaEvalResponse(result=float(res), result_decimal=str(res))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Business Rules
# ---------------------------------------------------------------------------

@router.get("/rules", response_model=List[BusinessRuleResponse])
async def list_business_rules(
    rule_type: Optional[str] = Query(None, description="Optional rule type filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active declarative business rules in smritisys."""
    stmt = select(BusinessRuleDefinition).where(
        BusinessRuleDefinition.is_active == True,
        BusinessRuleDefinition.is_deleted == False,
    )
    if rule_type:
        stmt = stmt.where(BusinessRuleDefinition.rule_type == rule_type.upper())
    stmt = stmt.order_by(BusinessRuleDefinition.priority.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/rules/evaluate")
async def evaluate_rule(
    req: BusinessRuleEvalRequest,
    current_user: User = Depends(get_current_user),
):
    """Evaluates declarative business conditions and returns applied actions."""
    try:
        res = GovernedRuleEngine.evaluate_business_rule(req.conditions, req.actions, req.context)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Policies
# ---------------------------------------------------------------------------

@router.get("/policies", response_model=List[PolicyDefinitionResponse])
async def list_policy_definitions(
    policy_type: Optional[str] = Query(None, description="Optional policy type filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active statutory and compliance policies in smritisys."""
    stmt = select(PolicyDefinition).where(
        PolicyDefinition.is_active == True,
        PolicyDefinition.is_deleted == False,
    )
    if policy_type:
        stmt = stmt.where(PolicyDefinition.policy_type == policy_type.upper())
    stmt = stmt.order_by(PolicyDefinition.code)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/policies/gst/evaluate")
async def evaluate_gst_tax(
    req: GstTaxPolicyEvalRequest,
    current_user: User = Depends(get_current_user),
):
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


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

@router.get("/workflows", response_model=List[WorkflowDefinitionResponse])
async def list_workflow_definitions(
    doc_type: Optional[str] = Query(None, description="Optional document type filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List versioned document and entity workflows."""
    stmt = select(WorkflowDefinition).where(
        WorkflowDefinition.is_active == True,
        WorkflowDefinition.is_deleted == False,
    )
    if doc_type:
        stmt = stmt.where(WorkflowDefinition.doc_type == doc_type)
    stmt = stmt.order_by(WorkflowDefinition.code)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/workflows/transition", response_model=WorkflowTransitionResponse)
async def evaluate_workflow_transition(
    req: WorkflowTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    return WorkflowTransitionResponse(
        allowed=res["allowed"],
        new_state=res.get("next_state"),
        action=req.action,
        reason=res.get("error")
    )


# ---------------------------------------------------------------------------
# Unified Definition Validator
# ---------------------------------------------------------------------------

@router.post("/validate", response_model=DefinitionValidationResponse)
async def validate_definition(
    req: DefinitionValidationRequest,
    current_user: User = Depends(get_current_user),
):
    """Validates formula AST, rule structure, or workflow state graph before saving."""
    dtype = req.definition_type.upper()
    defn = req.definition
    errors = []

    if dtype == "FORMULA":
        ast = defn.get("expression_ast", defn)
        errors = GovernedRuleEngine.validate_formula_ast_syntax(ast)
    elif dtype == "WORKFLOW":
        states = defn.get("states", [])
        transitions = defn.get("transitions", [])
        errors = GovernedRuleEngine.validate_workflow_syntax(states, transitions)
    elif dtype == "RULE":
        if "conditions" not in defn or "actions" not in defn:
            errors.append("Rule requires 'conditions' and 'actions'")
    elif dtype == "POLICY":
        if "policy_type" not in defn or "parameters" not in defn:
            errors.append("Policy requires 'policy_type' and 'parameters'")
    else:
        errors.append(f"Unknown definition type: '{dtype}'")

    return DefinitionValidationResponse(valid=len(errors) == 0, errors=errors)


# ---------------------------------------------------------------------------
# Transaction Reproducibility & Historical Replay (P1.5)
# ---------------------------------------------------------------------------

@router.post("/snapshot/create", response_model=GovernanceSnapshot)
async def create_transaction_governance_snapshot(
    req: SnapshotCreateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Creates an immutable snapshot of all 6 version categories for an invoice/transaction.
    """
    snap = TransactionReproducibilityService.create_governance_snapshot(
        formula_versions=req.formula_versions,
        rule_versions=req.rule_versions,
        policy_versions=req.policy_versions,
        workflow_versions=req.workflow_versions,
        pricing_version=req.pricing_version,
        accounting_rule_version=req.accounting_rule_version,
        doc_template_version=req.doc_template_version,
        extra_metadata=req.extra_metadata,
    )
    return snap


@router.post("/replay", response_model=TransactionReplayResponse)
async def replay_transaction_calculation(
    req: TransactionReplayRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Historical Replay Engine:
    Recalculates a historical transaction using the exact rule definitions bound to its snapshot.
    Proves zero mathematical drift against the original invoice.
    """
    try:
        res = TransactionReproducibilityService.replay_transaction_with_historical_rules(
            snapshot=req.snapshot,
            transaction_payload=req.transaction_payload,
            historical_rule_catalog=req.historical_catalog,
            expected_totals=req.expected_totals,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

