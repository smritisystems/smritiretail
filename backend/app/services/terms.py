"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import json
import re
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.terms import TermsClause, TermsDefault, TermsSnapshot, ApprovalWorkflowLog


def resolve_terms_text(content: str, variables: dict) -> str:
    if not content:
        return ""
    text = content
    defaults = {
        "InvoiceNo": "INV-TEMP-999",
        "CustomerName": "Walk-In Customer",
        "SupplierName": "Standard Supplier",
        "DueDate": "Immediate",
        "Amount": "0.00",
        "Date": datetime.now().strftime("%d/%m/%Y"),
        "Store": "HQ Store",
        "Branch": "HQ",
        "Year": str(datetime.now().year)
    }
    defaults.update(variables)

    for key, val in defaults.items():
        regex = re.compile(re.escape(f"{{{key}}}"), re.IGNORECASE)
        text = regex.sub(val, text)
    return text


class TermsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_clauses(self) -> list[TermsClause]:
        q = select(TermsClause).where(TermsClause.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def create_clause(self, data, creator: str) -> TermsClause:
        cat_prefix = data.category[:3].upper() if data.category else "GEN"
        new_id = f"CL-{cat_prefix}-{uuid.uuid4().hex[:4].upper()}"
        code = data.code or f"CODE-{uuid.uuid4().hex[:6].upper()}"

        clause = TermsClause(
            id=new_id,
            code=code,
            title=data.title,
            category=data.category,
            content=data.content,
            status=data.status or "Approved",
            language=data.language or "English",
            created_by=creator,
            updated_by=creator
        )
        self.db.add(clause)

        if clause.status == "Pending Approval":
            log = ApprovalWorkflowLog(
                id=f"AP-{uuid.uuid4().hex[:8]}",
                clause_id=clause.id,
                title=clause.title,
                submitted_by=creator,
                submitted_at=datetime.now(timezone.utc),
                status="Pending",
                comments="Submitted clause draft into security validation matrix."
            )
            self.db.add(log)

        await self.db.commit()
        await self.db.refresh(clause)
        return clause

    async def update_clause(self, clause_id: str, data, updater: str) -> dict:
        clause = await self.db.get(TermsClause, clause_id)
        if not clause or clause.is_deleted:
            raise HTTPException(status_code=404, detail="Clause not found")

        updated_version = (clause.version or 1) + 1

        if data.submitForApproval:
            prop_changes = {}
            if data.title is not None: prop_changes["title"] = data.title
            if data.content is not None: prop_changes["content"] = data.content
            if data.category is not None: prop_changes["category"] = data.category

            log = ApprovalWorkflowLog(
                id=f"AP-{uuid.uuid4().hex[:8]}",
                clause_id=clause_id,
                title=data.title or clause.title,
                submitted_by=updater,
                submitted_at=datetime.now(timezone.utc),
                status="Pending",
                proposed_changes=json.dumps(prop_changes),
                comments=data.comments or "Revision request for compliance standard verification."
            )
            self.db.add(log)
            clause.status = "Pending Approval"
            await self.db.commit()
            return {"success": True, "message": "Revision submitted to approval pipeline", "logId": log.id}

        if data.title is not None: clause.title = data.title
        if data.content is not None: clause.content = data.content
        if data.category is not None: clause.category = data.category
        if data.isActive is not None: clause.is_active = data.isActive
        if data.language is not None: clause.language = data.language
        clause.status = "Approved"
        clause.version = updated_version
        clause.updated_by = updater
        clause.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(clause)
        return {"success": True, "clause": clause}

    async def approve_clause(self, clause_id: str, comments: str, approver: str) -> TermsClause:
        clause = await self.db.get(TermsClause, clause_id)
        if not clause or clause.is_deleted:
            raise HTTPException(status_code=404, detail="Clause not found")

        # Find pending log
        q = select(ApprovalWorkflowLog).where(
            ApprovalWorkflowLog.clause_id == clause_id,
            ApprovalWorkflowLog.status == "Pending"
        )
        res = await self.db.execute(q)
        log = res.scalars().first()

        if log:
            log.status = "Approved"
            log.approved_by = approver
            log.approved_at = datetime.now(timezone.utc)
            log.comments = comments or "Corporate audit validation verified."

            if log.proposed_changes:
                try:
                    changes = json.loads(log.proposed_changes)
                    if "title" in changes: clause.title = changes["title"]
                    if "content" in changes: clause.content = changes["content"]
                    if "category" in changes: clause.category = changes["category"]
                except Exception:
                    pass

        clause.status = "Approved"
        clause.approved_by = approver
        clause.approved_at = datetime.now(timezone.utc)
        clause.version = (clause.version or 1) + 1
        clause.updated_by = approver
        clause.modified_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(clause)
        return clause

    async def reject_clause(self, clause_id: str, comments: str, rejector: str) -> TermsClause:
        clause = await self.db.get(TermsClause, clause_id)
        if not clause or clause.is_deleted:
            raise HTTPException(status_code=404, detail="Clause not found")

        q = select(ApprovalWorkflowLog).where(
            ApprovalWorkflowLog.clause_id == clause_id,
            ApprovalWorkflowLog.status == "Pending"
        )
        res = await self.db.execute(q)
        log = res.scalars().first()

        if log:
            log.status = "Rejected"
            log.approved_by = rejector
            log.approved_at = datetime.now(timezone.utc)
            log.comments = comments or "Rejected. Content breaches standard legal terminology requirements."

        clause.status = "Draft"
        await self.db.commit()
        await self.db.refresh(clause)
        return clause

    async def delete_clause(self, clause_id: str, operator: str) -> None:
        clause = await self.db.get(TermsClause, clause_id)
        if not clause or clause.is_deleted:
            raise HTTPException(status_code=404, detail="Clause not found")
        clause.is_deleted = True
        clause.is_active = False
        clause.deleted_at = datetime.now(timezone.utc)
        clause.deleted_by = operator
        await self.db.commit()

    async def list_defaults(self) -> list[TermsDefault]:
        q = select(TermsDefault).where(TermsDefault.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def save_default(self, data, creator: str) -> TermsDefault:
        q = select(TermsDefault).where(
            TermsDefault.level == data.level,
            TermsDefault.ref_id == data.refId,
            TermsDefault.is_deleted == False
        )
        res = await self.db.execute(q)
        existing = res.scalars().first()

        cids_str = json.dumps(data.clauseIds)

        if existing:
            existing.clause_ids = cids_str
            existing.is_active = data.isActive if data.isActive is not None else True
            existing.updated_by = creator
            existing.modified_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        new_id = f"DF-{uuid.uuid4().hex[:8]}"
        default = TermsDefault(
            id=new_id,
            level=data.level,
            ref_id=data.refId,
            clause_ids=cids_str,
            is_active=True,
            created_by=creator,
            updated_by=creator
        )
        self.db.add(default)
        await self.db.commit()
        await self.db.refresh(default)
        return default

    async def list_logs(self) -> list[ApprovalWorkflowLog]:
        q = select(ApprovalWorkflowLog).order_by(ApprovalWorkflowLog.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def list_snapshots(self) -> list[TermsSnapshot]:
        q = select(TermsSnapshot)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def get_snapshot(self, doc_type: str, doc_no: str) -> TermsSnapshot:
        q = select(TermsSnapshot).where(
            TermsSnapshot.document_type == doc_type,
            TermsSnapshot.document_no == doc_no
        )
        res = await self.db.execute(q)
        snap = res.scalars().first()
        if not snap:
            raise HTTPException(status_code=404, detail="Terms snapshot not found for this document")
        return snap

    async def save_snapshot(self, doc_type: str, doc_no: str, clauses: list) -> TermsSnapshot:
        q = select(TermsSnapshot).where(
            TermsSnapshot.document_type == doc_type,
            TermsSnapshot.document_no == doc_no
        )
        res = await self.db.execute(q)
        existing = res.scalars().first()

        clauses_str = json.dumps(clauses)

        if existing:
            existing.clauses_snapshot = clauses_str
            existing.snapshot_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        new_id = f"SNAP-{uuid.uuid4().hex[:8]}"
        snap = TermsSnapshot(
            id=new_id,
            document_type=doc_type,
            document_no=doc_no,
            snapshot_at=datetime.now(timezone.utc),
            clauses_snapshot=clauses_str
        )
        self.db.add(snap)
        await self.db.commit()
        await self.db.refresh(snap)
        return snap

    async def resolve_terms(self, req) -> dict:
        company_code = req.companyCode or "SMRITI_IND"
        branch_code = req.branchCode
        doc_type = req.documentType
        party_id = req.partyId
        variables = req.variables or {}

        # Fetch defaults for all levels
        company_map = await self._get_default("Company", company_code)
        branch_map = await self._get_default("Branch", branch_code) if branch_code else None
        doc_map = await self._get_default("Document", doc_type) if doc_type else None
        
        party_level = "Supplier" if party_id and party_id.startswith("SUP") else "Customer"
        party_map = await self._get_default(party_level, party_id) if party_id else None

        resolved_clauses_map = {}

        async def apply_defaults(mapping):
            if not mapping or not mapping.clause_ids:
                return
            try:
                cids = json.loads(mapping.clause_ids)
                for cid in cids:
                    # Get clause
                    q = select(TermsClause).where(
                        TermsClause.id == cid,
                        TermsClause.is_active == True,
                        TermsClause.status == "Approved"
                    )
                    res = await self.db.execute(q)
                    clause = res.scalars().first()
                    if clause:
                        resolved_clauses_map[clause.category] = clause
            except Exception:
                pass

        await apply_defaults(company_map)
        await apply_defaults(branch_map)
        await apply_defaults(doc_map)
        await apply_defaults(party_map)

        resolved_list = []
        idx = 1
        for category, clause in resolved_clauses_map.items():
            raw_content = clause.content
            resolved_content = resolve_terms_text(raw_content, variables)
            resolved_list.append({
                "id": clause.id,
                "title": clause.title,
                "category": clause.category,
                "rawContent": raw_content,
                "resolvedContent": resolved_content,
                "order": idx,
                "isActive": clause.is_active,
                "version": clause.version or 1,
                "status": clause.status
            })
            idx += 1

        company_count = len(json.loads(company_map.clause_ids)) if company_map else 0
        branch_count = len(json.loads(branch_map.clause_ids)) if branch_map else 0
        doc_count = len(json.loads(doc_map.clause_ids)) if doc_map else 0
        party_count = len(json.loads(party_map.clause_ids)) if party_map else 0

        trace = {
            "companyApplied": bool(company_map),
            "branchApplied": bool(branch_map),
            "documentApplied": bool(doc_map),
            "partyApplied": bool(party_map),
            "levels": [
                {"level": "Company", "refId": company_code, "active": bool(company_map), "count": company_count},
                {"level": "Branch", "refId": branch_code, "active": bool(branch_map), "count": branch_count},
                {"level": "Document", "refId": doc_type, "active": bool(doc_map), "count": doc_count},
                {"level": "Party", "refId": party_id, "active": bool(party_map), "count": party_count}
            ]
        }

        return {
            "inheritanceTrace": trace,
            "resolvedList": resolved_list
        }

    async def _get_default(self, level: str, ref_id: str) -> TermsDefault | None:
        q = select(TermsDefault).where(
            TermsDefault.level == level,
            TermsDefault.ref_id == ref_id,
            TermsDefault.is_active == True,
            TermsDefault.is_deleted == False
        )
        res = await self.db.execute(q)
        return res.scalars().first()
