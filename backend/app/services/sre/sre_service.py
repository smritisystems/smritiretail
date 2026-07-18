# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

import uuid
from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ...models.sre import (
    CorporateGstinRegistry, SreRuleEngine, SreStatutoryLedger, SreComplianceDecision
)
from ...api.deps import TenantContext


class SreService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def register_gstin(self, gstin: str, warehouse_name: str) -> CorporateGstinRegistry:
        """Register corporate GSTIN and extract state code."""
        if len(gstin) != 15:
            raise HTTPException(status_code=400, detail="GSTIN must be exactly 15 characters.")
        
        state_code = gstin[:2]
        
        # Check duplicate
        existing = await self.db.execute(
            select(CorporateGstinRegistry).filter(
                CorporateGstinRegistry.gstin == gstin,
                CorporateGstinRegistry.is_deleted == False
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="GSTIN already registered.")
            
        db_gstin = CorporateGstinRegistry(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            gstin=gstin,
            state_code=state_code,
            warehouse_name=warehouse_name
        )
        self.db.add(db_gstin)
        await self.db.commit()
        await self.db.refresh(db_gstin)
        return db_gstin

    async def get_gstin_registrations(self) -> List[CorporateGstinRegistry]:
        res = await self.db.execute(
            select(CorporateGstinRegistry).filter(
                CorporateGstinRegistry.is_deleted == False
            )
        )
        return list(res.scalars().all())

    async def create_compliance_rule(
        self, dispatch_type: str, tax_timing: str, max_deferral_days: int, required_doc: str
    ) -> SreRuleEngine:
        """Register a compliance tax rule config."""
        existing = await self.db.execute(
            select(SreRuleEngine).filter(
                SreRuleEngine.dispatch_type == dispatch_type,
                SreRuleEngine.is_deleted == False
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Compliance rule already exists for this dispatch type.")
            
        rule = SreRuleEngine(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_type=dispatch_type,
            tax_timing=tax_timing,
            max_deferral_days=max_deferral_days,
            required_document_type=required_doc
        )
        self.db.add(rule)
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def evaluate_dispatch_compliance(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingest a physical stock movement and route against compliance boundaries.
        Returns the action required and logs details in the ledger + decision trace.
        """
        dispatch_id = payload["dispatch_id"]
        origin_gstin_id = payload["origin_gstin_id"]
        destination_gstin = payload["destination_gstin"]
        dispatch_type = payload["dispatch_type"]
        sku = payload["sku"]
        batch_no = payload["batch_no"]
        qty = Decimal(str(payload["qty"]))
        unit_cost = Decimal(str(payload["unit_cost"]))
        gst_rate = Decimal(str(payload["gst_rate"]))
        dispatch_date_str = payload.get("dispatch_date", str(date.today()))
        dispatch_date = datetime.strptime(dispatch_date_str, "%Y-%m-%d").date()

        # 1. Resolve origin GSTIN
        gstin_res = await self.db.execute(
            select(CorporateGstinRegistry).filter(
                CorporateGstinRegistry.id == origin_gstin_id,
                CorporateGstinRegistry.is_deleted == False
            )
        )
        origin_reg = gstin_res.scalars().first()
        if not origin_reg:
            raise HTTPException(status_code=404, detail="Origin GSTIN registration not found.")

        origin_state = origin_reg.state_code
        dest_state = destination_gstin[:2]

        # 2. Query compliance rule
        rule_res = await self.db.execute(
            select(SreRuleEngine).filter(
                SreRuleEngine.dispatch_type == dispatch_type,
                SreRuleEngine.is_deleted == False
            )
        )
        rule = rule_res.scalars().first()
        if not rule:
            raise HTTPException(status_code=400, detail=f"No compliance rule found for dispatch type: {dispatch_type}")

        # 3. Apply Decision Boundary
        # Rule A: Interstate Distinct Person transfers always override deferrals (CGST Sec 25(4))
        if origin_state != dest_state:
            decision = "IMMEDIATE_TAXATION"
            reason = "Interstate stock transfer to a distinct person triggers immediate GST liability."
            tax_type = "IGST"
            statutory_state = "FULLY_TAXED"
            expiry_date = dispatch_date
            action = "GENERATE_TAX_INVOICE"
        
        # Rule B: Check if rule timing is immediate
        elif rule.tax_timing == "IMMEDIATE":
            decision = "IMMEDIATE_TAXATION"
            reason = f"Intrastate dispatch configured for immediate taxation under rule: {dispatch_type}."
            tax_type = "CGST_SGST"
            statutory_state = "FULLY_TAXED"
            expiry_date = dispatch_date
            action = "GENERATE_TAX_INVOICE"
            
        # Rule C: Deferred workflow (e.g. Sale on Approval)
        else:
            decision = "DEFERRED_TAXATION"
            reason = f"Intrastate dispatch eligible for tax deferral under rule: {dispatch_type}."
            tax_type = "DEFERRED"
            statutory_state = "TAX_DEFERRED"
            expiry_date = dispatch_date + timedelta(days=rule.max_deferral_days)
            action = f"GENERATE_{rule.required_document_type}"

        # 4. Log to Statutory Ledger
        ledger = SreStatutoryLedger(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            sku=sku,
            batch_no=batch_no,
            dispatch_id=dispatch_id,
            origin_gstin_id=origin_gstin_id,
            destination_gstin=destination_gstin,
            total_qty=qty,
            unit_cost=unit_cost,
            gst_rate=gst_rate,
            tax_type_applied=tax_type,
            statutory_state=statutory_state,
            dispatch_date=dispatch_date,
            expiry_date=expiry_date,
            is_asset_on_balance_sheet=(statutory_state == "TAX_DEFERRED")
        )
        self.db.add(ledger)

        # 5. Log to Compliance Decisions Table for CA auditing
        audit_log = SreComplianceDecision(
            id=str(uuid.uuid4())[:8],
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            dispatch_id=dispatch_id,
            evaluated_rule=dispatch_type,
            decision=decision,
            reason=f"{reason} (Action: {action})",
            engine_version="1.0.0"
        )
        self.db.add(audit_log)
        await self.db.commit()

        return {
            "ledger_id": ledger.id,
            "decision": decision,
            "action_required": action,
            "expiry_date": str(expiry_date),
            "reason": reason
        }

    async def get_compliance_explanation(self, dispatch_id: str) -> Dict[str, Any]:
        """Expose reasoning behind compliance engine choices (auditing)."""
        dec_res = await self.db.execute(
            select(SreComplianceDecision).filter(
                SreComplianceDecision.dispatch_id == dispatch_id,
                SreComplianceDecision.is_deleted == False
            ).order_by(SreComplianceDecision.evaluated_at.desc())
        )
        decision = dec_res.scalars().first()
        if not decision:
            raise HTTPException(status_code=404, detail="No compliance decisions logged for this dispatch ID.")
            
        ledger_res = await self.db.execute(
            select(SreStatutoryLedger).filter(
                SreStatutoryLedger.dispatch_id == dispatch_id,
                SreStatutoryLedger.is_deleted == False
            )
        )
        ledger = ledger_res.scalars().first()
        
        return {
            "dispatch_id": dispatch_id,
            "evaluated_rule": decision.evaluated_rule,
            "decision": decision.decision,
            "reason": decision.reason,
            "evaluated_at": str(decision.evaluated_at),
            "engine_version": decision.engine_version,
            "statutory_state": ledger.statutory_state if ledger else None,
            "expiry_date": str(ledger.expiry_date) if ledger else None
        }

    async def run_nightly_compliance_scan(self) -> List[Dict[str, Any]]:
        """
        Background Sweeper Job: Scans for deferred lots crossing statutory expiry limits.
        Updates status to DEEMED_SUPPLY_TRIGGERED.
        """
        res = await self.db.execute(
            select(SreStatutoryLedger).filter(
                SreStatutoryLedger.statutory_state == "TAX_DEFERRED",
                SreStatutoryLedger.expiry_date < date.today(),
                SreStatutoryLedger.is_deleted == False
            )
        )
        expired_lots = res.scalars().all()
        results = []
        
        for lot in expired_lots:
            pending_qty = lot.total_qty - lot.approved_qty - lot.returned_qty
            if pending_qty <= 0:
                lot.statutory_state = "RETURNED_CLOSED"
                continue

            lot.statutory_state = "DEEMED_SUPPLY_TRIGGERED"
            lot.is_asset_on_balance_sheet = False
            
            # Log transition audit trace
            audit_log = SreComplianceDecision(
                id=str(uuid.uuid4())[:8],
                tenant_id=lot.tenant_id,
                company_id=lot.company_id,
                branch_id=lot.branch_id,
                dispatch_id=lot.dispatch_id,
                evaluated_rule="180_DAY_TIMEOUT_SWEEPER",
                decision="DEEMED_SUPPLY_TRIGGERED",
                reason=f"Lot expired on {lot.expiry_date}. Forced GST liability triggered on remaining {pending_qty} items.",
                engine_version="1.0.0"
            )
            self.db.add(audit_log)
            results.append({
                "ledger_id": lot.id,
                "dispatch_id": lot.dispatch_id,
                "sku": lot.sku,
                "taxable_quantity": float(pending_qty)
            })

        if expired_lots:
            await self.db.commit()
        return results
