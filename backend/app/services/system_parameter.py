"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.19.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from fastapi import HTTPException

from ..models.system_parameter import SystemParameter
from ..schemas.system_parameter import (
    SystemParameterBatchSaveItem,
    SystemParameterResponse,
)


class SystemParameterService:
    """
    SMRITI System Parameters Governance Service.
    
    Provides profile seeding (RETAIL vs DISTRIBUTOR), 4-tier hierarchical resolution
    (Terminal > Branch > Company > Global), and 5-tier mutability governance
    (Fixed, Installation, One Time, Variable, Hidden).
    """

    @staticmethod
    def _get_blueprint_path() -> Path:
        base_dir = Path(__file__).resolve().parents[3]
        blueprint = base_dir / "docs" / "legacy_blueprints" / "shoper9" / "parameters.json"
        if not blueprint.exists():
            # Fallback for relative executions
            alt_path = Path("docs/legacy_blueprints/shoper9/parameters.json")
            if alt_path.exists():
                return alt_path
        return blueprint

    @classmethod
    async def seed_default_parameters(
        cls,
        db: AsyncSession,
        profile: str = "RETAIL",
        company_id: Optional[str] = None,
        overwrite_existing: bool = False,
    ) -> int:
        """
        Seeds parameters from parameters.json for a company or GLOBAL template.
        Respects profile variances (Retail vs Distributor).
        """
        blueprint_file = cls._get_blueprint_path()
        if not blueprint_file.exists():
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "SMRITI-FILE-001",
                    "title": "Blueprint Missing",
                    "explanation": f"System parameters blueprint not found at {blueprint_file}",
                    "suggested_action": "Verify repository docs/legacy_blueprints directory.",
                },
            )

        with open(blueprint_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        profile_normalized = (profile or "RETAIL").upper()
        variances = {v["paramCode"]: v for v in data.get("profileVariances", [])}
        params_data = data.get("parameters", [])

        # Fetch existing parameters for this company / scope
        query = select(SystemParameter).where(
            SystemParameter.company_id == company_id,
            SystemParameter.terminal_id == "COMMON",
        )
        res = await db.execute(query)
        existing_params = {p.param_code: p for p in res.scalars().all()}

        count = 0
        for p in params_data:
            p_code = p["paramCode"]
            category = p.get("category", "01. General")
            category_name = p.get("categoryDescription", category)
            descr = p.get("description", p_code)
            raw_type = p.get("type", "T")

            # Determine profile variance defaults
            has_variance = p_code in variances
            if profile_normalized == "DISTRIBUTOR":
                defs = p.get("distributorDefaults", {}) or p.get("retailDefaults", {})
                profile_type = "DISTRIBUTOR" if has_variance else "COMMON"
            else:
                defs = p.get("retailDefaults", {}) or p.get("distributorDefaults", {})
                profile_type = "RETAIL" if has_variance else "COMMON"

            mutability = defs.get("Fixed", "Variable")
            if mutability not in ("Fixed", "Installation", "One Time", "Variable", "Hidden"):
                mutability = "Variable"

            # Parse type & value
            if raw_type == "B":
                data_type = "Boolean"
                raw_val = defs.get("Boolean") == "1"
            elif raw_type == "I":
                data_type = "Integer"
                try:
                    raw_val = int(defs.get("Intg") or 0)
                except (ValueError, TypeError):
                    raw_val = 0
            elif raw_type in ("S", "C"):
                data_type = "Decimal"
                curr = defs.get("Cur") if defs.get("Cur") not in (None, "") else defs.get("Sng")
                cleaned = str(curr or "").replace("$", "").replace("₹", "").strip()
                try:
                    raw_val = float(cleaned) if cleaned else 0.0
                except (ValueError, TypeError):
                    raw_val = 0.0
            elif raw_type == "D":
                data_type = "Date"
                raw_val = defs.get("Dt") or None
            else:
                data_type = "Text"
                raw_val = defs.get("Txt") or ""

            if p_code in existing_params:
                existing = existing_params[p_code]
                if overwrite_existing and not existing.is_locked and existing.mutability != "Fixed":
                    existing.data_type = data_type
                    existing.mutability = mutability
                    existing.category = category
                    existing.category_name = category_name
                    existing.description = descr
                    existing.profile_type = profile_type
                    existing.set_value(raw_val)
                    count += 1
            else:
                comp_tag = company_id or "GLOBAL"
                rec_id = f"SP-{comp_tag}-{p_code}"[:50]
                new_param = SystemParameter(
                    id=rec_id,
                    company_id=company_id,
                    branch_id=None,
                    param_code=p_code,
                    category=category,
                    category_name=category_name,
                    description=descr,
                    data_type=data_type,
                    mutability=mutability,
                    profile_type=profile_type,
                    scope_level="COMPANY" if company_id else "GLOBAL",
                    terminal_id="COMMON",
                    is_locked=False,
                )
                new_param.set_value(raw_val)
                db.add(new_param)
                count += 1

        await db.commit()
        return count

    @classmethod
    async def get_parameters(
        cls,
        db: AsyncSession,
        company_id: Optional[str] = None,
        category: Optional[str] = None,
        profile_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[SystemParameter]:
        """
        Fetches parameters matching scope, category, or search filters.
        """
        query = select(SystemParameter).where(
            or_(
                SystemParameter.company_id == company_id,
                SystemParameter.company_id.is_(None),
            )
        )
        if category:
            query = query.where(SystemParameter.category == category)
        if profile_type:
            query = query.where(
                or_(
                    SystemParameter.profile_type == profile_type,
                    SystemParameter.profile_type == "COMMON",
                )
            )
        if search:
            s = f"%{search.strip()}%"
            query = query.where(
                or_(
                    SystemParameter.param_code.ilike(s),
                    SystemParameter.description.ilike(s),
                )
            )

        query = query.order_by(SystemParameter.category, SystemParameter.param_code)
        res = await db.execute(query)
        return res.scalars().all()

    @classmethod
    async def resolve_parameter(
        cls,
        db: AsyncSession,
        param_code: str,
        company_id: Optional[str] = None,
        terminal_id: str = "COMMON",
        branch_id: Optional[str] = None,
    ) -> Optional[SystemParameter]:
        """
        Resolves a parameter using 4-tier hierarchy:
        1. Terminal-specific (company_id + terminal_id)
        2. Branch-specific (company_id + branch_id + COMMON terminal)
        3. Company-specific (company_id + COMMON terminal)
        4. Global template (company_id IS NULL + COMMON terminal)
        """
        # Tier 1: Terminal specific
        if terminal_id and terminal_id != "COMMON" and company_id:
            res = await db.execute(
                select(SystemParameter).where(
                    SystemParameter.company_id == company_id,
                    SystemParameter.terminal_id == terminal_id,
                    SystemParameter.param_code == param_code,
                )
            )
            p = res.scalar_one_or_none()
            if p:
                return p

        # Tier 2: Branch specific
        if branch_id and company_id:
            res = await db.execute(
                select(SystemParameter).where(
                    SystemParameter.company_id == company_id,
                    SystemParameter.branch_id == branch_id,
                    SystemParameter.terminal_id == "COMMON",
                    SystemParameter.param_code == param_code,
                )
            )
            p = res.scalar_one_or_none()
            if p:
                return p

        # Tier 3: Company specific
        if company_id:
            res = await db.execute(
                select(SystemParameter).where(
                    SystemParameter.company_id == company_id,
                    SystemParameter.terminal_id == "COMMON",
                    SystemParameter.param_code == param_code,
                )
            )
            p = res.scalar_one_or_none()
            if p:
                return p

        # Tier 4: Global
        res = await db.execute(
            select(SystemParameter).where(
                SystemParameter.company_id.is_(None),
                SystemParameter.terminal_id == "COMMON",
                SystemParameter.param_code == param_code,
            )
        )
        return res.scalar_one_or_none()

    @classmethod
    async def resolve_parameters_map(
        cls,
        db: AsyncSession,
        company_id: Optional[str] = None,
        terminal_id: str = "COMMON",
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Returns a resolved dictionary map of parameter code to effective value
        plus metadata definitions, respecting hierarchical precedence.
        """
        # Load all parameters relevant to this scope
        conditions = [SystemParameter.company_id.is_(None)]
        if company_id:
            conditions.append(SystemParameter.company_id == company_id)

        query = select(SystemParameter).where(or_(*conditions))
        res = await db.execute(query)
        all_params = res.scalars().all()

        # Group by scope precedence
        global_map: Dict[str, SystemParameter] = {}
        company_map: Dict[str, SystemParameter] = {}
        branch_map: Dict[str, SystemParameter] = {}
        terminal_map: Dict[str, SystemParameter] = {}

        for p in all_params:
            code = p.param_code
            if p.company_id is None:
                global_map[code] = p
            elif p.terminal_id == terminal_id and terminal_id != "COMMON":
                terminal_map[code] = p
            elif p.branch_id == branch_id and branch_id is not None and p.terminal_id == "COMMON":
                branch_map[code] = p
            elif p.terminal_id == "COMMON":
                company_map[code] = p

        # Merge with precedence: Global -> Company -> Branch -> Terminal
        resolved: Dict[str, SystemParameter] = {}
        resolved.update(global_map)
        resolved.update(company_map)
        resolved.update(branch_map)
        resolved.update(terminal_map)

        values_map = {code: p.effective_value for code, p in resolved.items()}
        defs_map = {
            code: {
                "id": p.id,
                "param_code": p.param_code,
                "category": p.category,
                "category_name": p.category_name,
                "description": p.description,
                "data_type": p.data_type,
                "mutability": p.mutability,
                "profile_type": p.profile_type,
                "effective_value": p.effective_value,
                "scope_level": p.scope_level,
                "terminal_id": p.terminal_id,
                "is_locked": p.is_locked,
            }
            for code, p in resolved.items()
        }

        return {
            "values": values_map,
            "definitions": defs_map,
            "count": len(values_map),
        }

    @classmethod
    async def update_parameter(
        cls,
        db: AsyncSession,
        param_code: str,
        value: Any,
        company_id: Optional[str] = None,
        terminal_id: str = "COMMON",
        branch_id: Optional[str] = None,
        scope_level: str = "COMPANY",
        updated_by: Optional[str] = None,
    ) -> SystemParameter:
        """
        Updates a system parameter enforcing 5-tier mutability rules.
        """
        # Find exact scoped parameter record or resolve
        query = select(SystemParameter).where(
            SystemParameter.company_id == company_id,
            SystemParameter.param_code == param_code,
            SystemParameter.terminal_id == terminal_id,
        )
        if branch_id:
            query = query.where(SystemParameter.branch_id == branch_id)
        res = await db.execute(query)
        param = res.scalar_one_or_none()

        if not param:
            # Fallback to resolved record to copy metadata
            resolved = await cls.resolve_parameter(
                db, param_code, company_id=company_id, terminal_id="COMMON"
            )
            if not resolved:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "code": "SMRITI-PARAM-404",
                        "title": "Parameter Not Found",
                        "explanation": f"System parameter '{param_code}' does not exist.",
                        "suggested_action": "Verify parameter code and seed defaults if necessary.",
                    },
                )

            comp_tag = company_id or "GLOBAL"
            rec_id = f"SP-{comp_tag}-{param_code}-{terminal_id}"[:50]
            param = SystemParameter(
                id=rec_id,
                company_id=company_id,
                branch_id=branch_id,
                param_code=param_code,
                category=resolved.category,
                category_name=resolved.category_name,
                description=resolved.description,
                data_type=resolved.data_type,
                mutability=resolved.mutability,
                profile_type=resolved.profile_type,
                scope_level=scope_level,
                terminal_id=terminal_id,
                is_locked=resolved.is_locked,
            )
            db.add(param)

        # Mutability Enforcement
        mutability = param.mutability
        if mutability == "Fixed":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "SMRITI-PARAM-001",
                    "title": "Immutable Fixed Parameter",
                    "explanation": f"Parameter '{param_code}' has Fixed mutability and cannot be modified.",
                    "suggested_action": "Fixed parameters represent permanent system constraints.",
                },
            )
        elif mutability == "Hidden":
            # Allowed only if called by admin/internal with updated_by
            if not updated_by or updated_by.lower() in ("guest", "anonymous"):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "SMRITI-PARAM-004",
                        "title": "Access Restricted",
                        "explanation": f"Parameter '{param_code}' is Hidden and cannot be modified by standard users.",
                        "suggested_action": "Administrative privileges required.",
                    },
                )
        elif mutability == "Installation":
            if param.is_locked:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "SMRITI-PARAM-002",
                        "title": "Installation Parameter Locked",
                        "explanation": f"Parameter '{param_code}' was already configured during installation.",
                        "suggested_action": "Installation parameters are locked once configured.",
                    },
                )
        elif mutability == "One Time":
            if param.is_locked:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "SMRITI-PARAM-003",
                        "title": "One-Time Parameter Locked",
                        "explanation": f"Parameter '{param_code}' has already been set and cannot be changed again.",
                        "suggested_action": "One-time parameters can only be updated once.",
                    },
                )

        # Apply value
        param.set_value(value)
        param.updated_by = updated_by or "system"
        param.modified_at = datetime.now(timezone.utc)
        param.version = (param.version or 1) + 1

        # If mutability is Installation or One Time, lock on update
        if mutability in ("Installation", "One Time"):
            param.is_locked = True

        await db.commit()
        await db.refresh(param)
        return param

    @classmethod
    async def save_batch(
        cls,
        db: AsyncSession,
        items: List[SystemParameterBatchSaveItem],
        company_id: Optional[str] = None,
        updated_by: Optional[str] = None,
    ) -> int:
        """
        Saves a batch of parameters in a single transaction.
        """
        count = 0
        for item in items:
            await cls.update_parameter(
                db=db,
                param_code=item.param_code,
                value=item.value,
                company_id=company_id,
                terminal_id=item.terminal_id or "COMMON",
                branch_id=item.branch_id,
                scope_level=item.scope_level or "COMPANY",
                updated_by=updated_by,
            )
            count += 1
        return count
