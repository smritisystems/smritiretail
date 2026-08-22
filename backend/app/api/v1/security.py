"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import uuid
import json
import hashlib
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from ...api.deps import get_db, get_current_user, get_tenant_context, require_role, TenantContext
from ...models.auth import User, UserRole
from ...models.security import SmritiPermission, SmritiAuditLog
from ...models.system import SystemConfig
from ...schemas.security import (
    MenuPermissionAction,
    SubjectMenuAccessRequest,
    SubjectMenuAccessResponse,
    PasswordConfigSchema,
    HousekeepingConfigSchema,
    SecurityConfigResponse,
)

router = APIRouter()

CONFIG_KEY_PASS = "sec_password_config"
CONFIG_KEY_HK = "sec_housekeeping_config"

@router.get("/menu-access", response_model=SubjectMenuAccessResponse)
async def get_subject_menu_access(
    subject_type: str = Query(..., description="'User' | 'Group' | 'Node'"),
    subject_id: str = Query(..., description="Target entity ID"),
    company_code: Optional[str] = Query("All", description="Company scope"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch granular action-level menu access permissions for a User, Group, or Node from smriti_permissions.
    """
    target_scope = f"{subject_type}:{subject_id}"
    q = select(SmritiPermission).where(
        SmritiPermission.scope == target_scope,
        SmritiPermission.is_deleted == False,
    )
    if company_code and company_code != "All":
        q = q.where(
            (SmritiPermission.company_id == company_code) | (SmritiPermission.company_id.is_(None))
        )
    
    res = await db.execute(q)
    rows = res.scalars().all()
    
    actions = [
        MenuPermissionAction(
            resource=r.resource,
            action=r.action,
            allowed=r.is_active,
        )
        for r in rows
    ]

    return SubjectMenuAccessResponse(
        subject_type=subject_type,
        subject_id=subject_id,
        company_code=company_code,
        permissions=actions,
    )


@router.put("/menu-access", response_model=SubjectMenuAccessResponse)
async def save_subject_menu_access(
    req: SubjectMenuAccessRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Save granular action-level menu access restrictions to smriti_permissions.
    Audits changes into smriti_audit_log with SHA-256 signature.
    """
    target_scope = f"{req.subject_type}:{req.subject_id}"

    # Query existing rows for this subject scope
    existing_q = select(SmritiPermission).where(
        SmritiPermission.scope == target_scope,
        SmritiPermission.is_deleted == False,
    )
    res = await db.execute(existing_q)
    existing_items = {f"{r.resource}:{r.action}": r for r in res.scalars().all()}

    updated_count = 0
    created_count = 0

    for perm in req.permissions:
        key = f"{perm.resource}:{perm.action}"
        if key in existing_items:
            item = existing_items[key]
            item.is_active = perm.allowed
            item.modified_at = datetime.now(timezone.utc)
            item.updated_by = current_user.id
            updated_count += 1
        else:
            new_id = f"perm-{uuid.uuid4().hex[:12]}"
            new_perm = SmritiPermission(
                id=new_id,
                uuid=str(uuid.uuid4()),
                code=f"{req.subject_type}:{req.subject_id}:{perm.resource}:{perm.action}",
                resource=perm.resource,
                action=perm.action,
                scope=target_scope,
                module="core",
                company_id=req.company_code if req.company_code != "All" else None,
                tenant_id=tenant.company_id,
                is_active=perm.allowed,
                is_deleted=False,
                created_by=current_user.id,
            )
            db.add(new_perm)
            created_count += 1

    # Record tamper-evident audit journal entry in smriti_audit_log
    audit_id = f"aud-{uuid.uuid4().hex[:12]}"
    audit_payload = {
        "subject_type": req.subject_type,
        "subject_id": req.subject_id,
        "company_code": req.company_code,
        "created_count": created_count,
        "updated_count": updated_count,
    }
    sha_hash = hashlib.sha256(f"{audit_id}:{target_scope}:{audit_payload}".encode()).hexdigest()

    await db.execute(
        text("""
            INSERT INTO smriti_audit_log (
                id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                old_value, new_value, change_type, change_reason, change_source,
                changed_by, changed_by_name, changed_at, sha256_hash
            )
            VALUES (
                :id, :tenant_id, :entity_id, 'smriti_permissions', :record_id, 'menu_access_matrix',
                :old_val, :new_val, 'UPDATE', 'Security Menu Access Control Policy Update', 'SecurityStudio',
                :changed_by, :changed_by_name, :changed_at, :sha256_hash
            )
        """),
        {
            "id": audit_id,
            "tenant_id": tenant.company_id,
            "entity_id": target_scope,
            "record_id": target_scope,
            "old_val": "ACTIVE_POLICY",
            "new_val": json.dumps(audit_payload),
            "changed_by": current_user.id,
            "changed_by_name": current_user.full_name or current_user.username,
            "changed_at": datetime.now(timezone.utc),
            "sha256_hash": sha_hash,
        }
    )

    await db.commit()

    return SubjectMenuAccessResponse(
        subject_type=req.subject_type,
        subject_id=req.subject_id,
        company_code=req.company_code,
        permissions=req.permissions,
    )


@router.get("/config", response_model=SecurityConfigResponse)
async def get_security_configuration(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get Password & Housekeeping security policies from system_configs table.
    """
    q = select(SystemConfig).where(
        SystemConfig.key.in_([CONFIG_KEY_PASS, CONFIG_KEY_HK]),
        SystemConfig.is_deleted == False,
    )
    res = await db.execute(q)
    configs = {c.key: c.value for c in res.scalars().all()}

    pass_dict = json.loads(configs.get(CONFIG_KEY_PASS, "{}")) if CONFIG_KEY_PASS in configs else {}
    hk_dict = json.loads(configs.get(CONFIG_KEY_HK, "{}")) if CONFIG_KEY_HK in configs else {}

    return SecurityConfigResponse(
        password_config=PasswordConfigSchema(**pass_dict),
        housekeeping_config=HousekeepingConfigSchema(**hk_dict),
    )


@router.put("/config", response_model=SecurityConfigResponse)
async def update_security_configuration(
    req: SecurityConfigResponse,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Save Password & Housekeeping security policies to system_configs table.
    Audited into smriti_audit_log.
    """
    # 1. Update Password Config
    q_pass = select(SystemConfig).where(SystemConfig.key == CONFIG_KEY_PASS, SystemConfig.is_deleted == False)
    res_pass = await db.execute(q_pass)
    pass_cfg = res_pass.scalars().first()
    pass_json = req.password_config.model_dump_json()

    if pass_cfg:
        pass_cfg.value = pass_json
        pass_cfg.modified_at = datetime.now(timezone.utc)
        pass_cfg.updated_by = current_user.id
    else:
        pass_cfg = SystemConfig(
            id=f"cfg-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            key=CONFIG_KEY_PASS,
            value=pass_json,
            category="Security",
            created_by=current_user.id,
        )
        db.add(pass_cfg)

    # 2. Update Housekeeping Config
    q_hk = select(SystemConfig).where(SystemConfig.key == CONFIG_KEY_HK, SystemConfig.is_deleted == False)
    res_hk = await db.execute(q_hk)
    hk_cfg = res_hk.scalars().first()
    hk_json = req.housekeeping_config.model_dump_json()

    if hk_cfg:
        hk_cfg.value = hk_json
        hk_cfg.modified_at = datetime.now(timezone.utc)
        hk_cfg.updated_by = current_user.id
    else:
        hk_cfg = SystemConfig(
            id=f"cfg-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            key=CONFIG_KEY_HK,
            value=hk_json,
            category="Security",
            created_by=current_user.id,
        )
        db.add(hk_cfg)

    # 3. Record Audit Log
    audit_id = f"aud-{uuid.uuid4().hex[:12]}"
    sha_hash = hashlib.sha256(f"{audit_id}:SECURITY_CONFIG:{pass_json}:{hk_json}".encode()).hexdigest()
    await db.execute(
        text("""
            INSERT INTO smriti_audit_log (
                id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                old_value, new_value, change_type, change_reason, change_source,
                changed_by, changed_by_name, changed_at, sha256_hash
            )
            VALUES (
                :id, :tenant_id, 'SYSTEM_SECURITY_POLICY', 'system_configs', 'sec_config', 'security_policies',
                'CONFIG_V1', :new_val, 'UPDATE', 'Security Configuration & Housekeeping Update', 'SecurityStudio',
                :changed_by, :changed_by_name, :changed_at, :sha256_hash
            )
        """),
        {
            "id": audit_id,
            "tenant_id": tenant.company_id,
            "new_val": json.dumps({"password": req.password_config.model_dump(), "housekeeping": req.housekeeping_config.model_dump()}),
            "changed_by": current_user.id,
            "changed_by_name": current_user.full_name or current_user.username,
            "changed_at": datetime.now(timezone.utc),
            "sha256_hash": sha_hash,
        }
    )

    await db.commit()

    return req
