"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.services.sip.resolution_engine import SIPIdentityResolutionEngine
from app.services.sip.governance_fsm import SIPRuleGovernanceFSM
from app.services.sip.metrics_engine import SIPMetricsAndHealthEngine
from app.services.sip.ai_advisory import SIPAIAdvisoryService

router = APIRouter(prefix="/sip", tags=["SMRITI Identity Platform (SIP)"])


@router.post(
    "/register",
    summary="Register Universal Identity",
    description="Registers multi-domain identity (Product, Customer, Supplier, Warehouse, Asset, etc.) in Central Registry."
)
async def register_identity(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = payload.get("domain", "PRODUCT")
    entity_id = payload.get("entity_id")
    if not entity_id:
        raise HTTPException(status_code=400, detail="entity_id is required.")
    
    standard = payload.get("identifier_standard", "GS1")
    ext_id = payload.get("external_identity")
    src_sys = payload.get("source_system")
    attributes = payload.get("attributes", {})

    engine = SIPIdentityResolutionEngine()
    record = await engine.register_identity(
        db=db,
        domain=domain,
        entity_id=entity_id,
        payload=attributes,
        standard=standard,
        external_identity=ext_id,
        source_system=src_sys,
    )
    return {
        "success": True,
        "registry_id": record.id,
        "domain": record.domain,
        "entity_id": record.entity_id,
        "business_key": record.business_key,
        "barcode_value": record.barcode_value,
        "digital_link_uri": record.digital_link_uri,
        "sgtin96_hex": record.sgtin96_hex,
    }


@router.get(
    "/search",
    summary="Universal Identity Search",
    description="Searches central UniversalIdentityRegistry across business_key, barcode, hash, or entity_id."
)
async def search_identities(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engine = SIPIdentityResolutionEngine()
    results = await engine.search_registry(db=db, search_query=q)
    return {
        "query": q,
        "total_matches": len(results),
        "matches": [
            {
                "id": r.id,
                "domain": r.domain,
                "entity_id": r.entity_id,
                "business_key": r.business_key,
                "barcode": r.barcode_value,
                "status": r.status,
            }
            for r in results
        ]
    }


@router.post(
    "/rules/governance",
    summary="Identity Rule Lifecycle Governance Transition",
    description="Executes FSM transition (DRAFT -> REVIEW -> APPROVED -> SIMULATION -> PILOT -> PRODUCTION -> DEPRECATED -> ARCHIVED)."
)
async def transition_rule_lifecycle(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule_id = payload.get("rule_id")
    target_state = payload.get("target_state")
    summary = payload.get("change_summary", "FSM transition via API")

    if not rule_id or not target_state:
        raise HTTPException(status_code=400, detail="rule_id and target_state are required.")

    fsm = SIPRuleGovernanceFSM()
    try:
        updated_rule = await fsm.transition_rule_state(
            db=db,
            rule_id=rule_id,
            target_state=target_state,
            change_summary=summary,
        )
        return {
            "success": True,
            "rule_id": updated_rule.id,
            "rule_code": updated_rule.code,
            "lifecycle_state": updated_rule.lifecycle_state,
            "version": updated_rule.version,
        }
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post(
    "/simulate",
    summary="Identity Simulation & Collision Analysis",
    description="Simulates identity resolution across dataset to evaluate collision rate and migration impact."
)
async def simulate_identity_batch(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = payload.get("items", [])
    domain = payload.get("domain", "PRODUCT")
    metrics_svc = SIPMetricsAndHealthEngine()
    return await metrics_svc.run_simulation(items=items, domain=domain)


@router.post(
    "/ai/recommendations",
    summary="Non-blocking AI Identity Pattern Recommendation",
    description="Calculates Shannon entropy score and suggests collision-reducing pattern templates."
)
async def get_ai_recommendations(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    domain = payload.get("domain", "PRODUCT")
    attributes = payload.get("attributes", [])
    ai_svc = SIPAIAdvisoryService()
    return ai_svc.recommend_pattern_template(domain=domain, sample_attributes=attributes)


@router.get(
    "/health",
    summary="SIP Platform Operational Metrics & Health Dashboard",
    description="Returns platform-level metrics, registered domain breakdown, and active rule health."
)
async def get_sip_platform_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metrics_svc = SIPMetricsAndHealthEngine()
    return await metrics_svc.calculate_platform_metrics(db=db)
