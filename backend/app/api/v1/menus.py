"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_company_db, get_current_user, get_tenant_context, require_role, TenantContext
from ...models.auth import User, UserRole
from ...models.menu import SmritiMenu
from ...schemas.menu import (
    SmritiMenuCreate,
    SmritiMenuUpdate,
    SmritiMenuResponse,
    MenuNode,
    ContextualActionResponse,
)

router = APIRouter()

# Restricted admin workspaces requiring elevated privileges
ADMIN_RESTRICTED_MODULES = {"system-config", "platform-studio", "dev-tracker", "audit", "audit-logs", "security"}

@router.get(
    "/contextual",
    response_model=List[ContextualActionResponse],
)
async def get_contextual_actions(
    doc_type: str = Query("SalesInvoice", description="Document domain e.g. SalesInvoice, PurchaseOrder"),
    doc_id: Optional[str] = Query(None, description="Document ID or transaction number"),
    state: str = Query("DRAFT", description="Current lifecycle state"),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates context-specific document actions for active transaction.
    Applies authoritative RBAC (evaluate_action_permission) and document lifecycle state transitions.
    Unauthorized actions are excluded (least privilege).
    Available actions indicate whether they are enabled or disabled by lifecycle rules.
    """
    from ...core.security_matrix import evaluate_action_permission

    normalized_type = doc_type.strip().lower()
    normalized_state = state.strip().upper()

    action_specs: List[Dict[str, Any]] = []

    if normalized_type in ("salesinvoice", "sales_invoice", "invoice", "pos", "billing"):
        action_specs = [
            {
                "id": "doc-overview",
                "title": "Document Overview",
                "icon": "visibility",
                "resource": "sales_billing",
                "action": "VIEW",
                "baseline_perm": "SALES.WORKSPACE.ACCESS",
                "is_next_best_action": True,
            },
            {
                "id": "doc-items",
                "title": "Items & Totals",
                "icon": "grid_on",
                "resource": "sales_billing",
                "action": "VIEW",
                "baseline_perm": "SALES.WORKSPACE.ACCESS",
            },
            {
                "id": "doc-stock",
                "title": "Stock & Ledger Impact",
                "icon": "warehouse",
                "resource": "stock_ledger",
                "action": "VIEW",
                "baseline_perm": "STOCK.WORKSPACE.ACCESS",
            },
            {
                "id": "doc-verify",
                "title": "Verification & Audit",
                "icon": "fact_check",
                "resource": "sales_billing",
                "action": "VERIFY",
                "baseline_perm": "SALES.VERIFY.EXECUTE",
                "disabled": normalized_state in ("POSTED", "FINALIZED", "CANCELLED"),
                "disabled_reason": (
                    "Transaction already posted to ledger."
                    if normalized_state in ("POSTED", "FINALIZED")
                    else "Transaction is cancelled."
                    if normalized_state == "CANCELLED"
                    else None
                ),
            },
            {
                "id": "doc-dispatch",
                "title": "Prepare Dispatch",
                "icon": "local_shipping",
                "resource": "b2b_dispatch",
                "action": "DISPATCH",
                "baseline_perm": "DISPATCH.EXECUTE",
                "disabled": normalized_state in ("DRAFT", "DISPATCHED", "CANCELLED"),
                "disabled_reason": (
                    "Dispatch unavailable. Missing verified invoice & E-Way Bill."
                    if normalized_state == "DRAFT"
                    else "Consignment already dispatched."
                    if normalized_state == "DISPATCHED"
                    else "Transaction is cancelled."
                    if normalized_state == "CANCELLED"
                    else None
                ),
            },
            {
                "id": "doc-print",
                "title": "Print / Export PDF",
                "icon": "print",
                "resource": "print_studio",
                "action": "PRINT",
                "baseline_perm": "PRINT.EXECUTE",
            },
            {
                "id": "doc-activity",
                "title": "Activity & Log",
                "icon": "history",
                "resource": "audit_logs",
                "action": "VIEW",
                "baseline_perm": "AUDIT.WORKSPACE.ACCESS",
            },
        ]
    elif normalized_type in ("purchaseorder", "purchase_order", "po", "purchase"):
        action_specs = [
            {
                "id": "doc-overview",
                "title": "PO Overview",
                "icon": "visibility",
                "resource": "purchase_studio",
                "action": "VIEW",
                "baseline_perm": "PURCHASE.WORKSPACE.ACCESS",
                "is_next_best_action": True,
            },
            {
                "id": "doc-items",
                "title": "PO Lines",
                "icon": "grid_on",
                "resource": "purchase_studio",
                "action": "VIEW",
                "baseline_perm": "PURCHASE.WORKSPACE.ACCESS",
            },
            {
                "id": "doc-grn",
                "title": "Inward GRN Match",
                "icon": "local_shipping",
                "resource": "purchase_studio",
                "action": "VIEW",
                "baseline_perm": "GRN.WORKSPACE.ACCESS",
                "disabled": normalized_state == "DRAFT",
                "disabled_reason": "GRN unavailable while PO is in DRAFT state." if normalized_state == "DRAFT" else None,
            },
            {
                "id": "doc-print",
                "title": "Print Purchase Order",
                "icon": "print",
                "resource": "print_studio",
                "action": "PRINT",
                "baseline_perm": "PRINT.EXECUTE",
            },
        ]

    results: List[ContextualActionResponse] = []
    for spec in action_specs:
        is_allowed = await evaluate_action_permission(
            db=db,
            current_user=current_user,
            tenant=tenant,
            resource=spec["resource"],
            action=spec["action"],
            baseline_perm_code=spec.get("baseline_perm"),
        )
        if is_allowed:
            results.append(
                ContextualActionResponse(
                    id=spec["id"],
                    title=spec["title"],
                    icon=spec["icon"],
                    resource=spec["resource"],
                    action=spec["action"],
                    is_allowed=True,
                    disabled=spec.get("disabled", False),
                    disabled_reason=spec.get("disabled_reason"),
                    is_next_best_action=spec.get("is_next_best_action", False),
                    badge_count=spec.get("badge_count"),
                )
            )

    return results

@router.get(
    "/resolved",
    response_model=List[SmritiMenuResponse],
)
async def get_resolved_menus(
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Centralized Menu Resolver.
    Evaluates User -> TenantContext -> Role -> smriti_permissions -> smriti_menus.
    Filters individual items by action='VIEW' and applies parent-child cascade pruning.
    Produces the authoritative navigation tree for the logged-in user.
    """
    from ...core.security_matrix import (
        CANONICAL_34_MENU_MATRIX,
        evaluate_action_permission,
        prune_menu_tree_cascade,
    )

    q = select(SmritiMenu).where(
        SmritiMenu.is_active == True,
        SmritiMenu.is_deleted == False,
    ).order_by(SmritiMenu.sequence.asc())

    res = await db.execute(q)
    all_menus = res.scalars().all()

    # Step 1: Filter menus matching company/branch tenant boundaries
    scoped_menus: List[SmritiMenu] = []
    for m in all_menus:
        if m.company_id and m.company_id != tenant.company_id and current_user.role != UserRole.SYSADMIN:
            continue
        if m.branch_id and m.branch_id != tenant.branch_id and current_user.role != UserRole.SYSADMIN:
            continue
        scoped_menus.append(m)

    # If SYSADMIN, bypass permission checks and return all scoped menus
    if current_user.role == UserRole.SYSADMIN:
        return [SmritiMenuResponse.model_validate(m) for m in scoped_menus]

    # Step 2: Determine raw visibility for each scoped menu
    raw_visible_ids = set()
    for m in scoped_menus:
        route_id = (m.route or "").lstrip("/")
        if route_id in ADMIN_RESTRICTED_MODULES:
            if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
                continue

        spec = CANONICAL_34_MENU_MATRIX.get(m.id)
        res_key = spec["resource"] if spec else m.id.replace("menu-", "").replace("-", "_")
        base_code = spec["view_perm"] if spec else m.permission

        is_allowed = await evaluate_action_permission(
            db=db,
            current_user=current_user,
            tenant=tenant,
            resource=res_key,
            action="VIEW",
            baseline_perm_code=base_code,
        )
        if is_allowed:
            raw_visible_ids.add(m.id)

    # Step 3: Apply two-pass cascade pruning (removes empty parents and orphaned children)
    pruned_menus = prune_menu_tree_cascade(scoped_menus, raw_visible_ids)

    return [SmritiMenuResponse.model_validate(m) for m in pruned_menus]


@router.get(
    "/",
    response_model=List[SmritiMenuResponse],
)
async def list_all_menus(
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all registered Control Plane menus for admin governance.
    """
    q = select(SmritiMenu).where(SmritiMenu.is_deleted == False).order_by(SmritiMenu.sequence.asc())
    res = await db.execute(q)
    return [SmritiMenuResponse.model_validate(m) for m in res.scalars().all()]


@router.put(
    "/{menu_id}",
    response_model=SmritiMenuResponse,
)
async def update_menu_item(
    menu_id: str,
    req: SmritiMenuUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Admin Menu Management.
    Enforces 'system.menu.manage' capability (guarded by SYSADMIN/MANAGER role dependency).
    Modifies menu label, icon, sequence, parent_id, or is_active state.
    Audits changes into smriti_audit_log.
    """
    q = select(SmritiMenu).where(SmritiMenu.id == menu_id, SmritiMenu.is_deleted == False)
    res = await db.execute(q)
    item = res.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail=f"Menu item '{menu_id}' not found")

    old_data = {
        "title": item.title,
        "icon": item.icon,
        "sequence": item.sequence,
        "is_active": item.is_active,
    }

    if req.title is not None:
        item.title = req.title
    if req.icon is not None:
        item.icon = req.icon
    if req.sequence is not None:
        item.sequence = req.sequence
    if req.parent_id is not None:
        item.parent_id = req.parent_id
    if req.is_active is not None:
        item.is_active = req.is_active
    if req.module is not None:
        item.module = req.module

    new_data = {
        "title": item.title,
        "icon": item.icon,
        "sequence": item.sequence,
        "is_active": item.is_active,
    }

    # Record audit log entry in smriti_audit_log via raw SQL to ensure exact table compliance
    from sqlalchemy import text
    import hashlib
    audit_id = f"aud-{uuid.uuid4().hex[:12]}"
    hash_val = hashlib.sha256(f"{audit_id}:{menu_id}:{new_data}".encode()).hexdigest()
    await db.execute(
        text("""
            INSERT INTO smriti_audit_log (
                id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                old_value, new_value, change_type, change_reason, change_source,
                changed_by, changed_by_name, changed_at, sha256_hash
            )
            VALUES (
                :id, :tenant_id, :entity_id, 'smriti_menus', :record_id, 'menu_config',
                :old_val, :new_val, 'UPDATE', 'Admin Menu Configuration Update', 'Admin Menu Studio',
                :changed_by, :changed_by_name, :changed_at, :sha256_hash
            )
        """),
        {
            "id": audit_id,
            "tenant_id": tenant.company_id,
            "entity_id": menu_id,
            "record_id": menu_id,
            "old_val": str(old_data),
            "new_val": str(new_data),
            "changed_by": current_user.id,
            "changed_by_name": current_user.full_name or current_user.username,
            "changed_at": datetime.now(timezone.utc),
            "sha256_hash": hash_val,
        }
    )

    await db.commit()
    await db.refresh(item)
    return SmritiMenuResponse.model_validate(item)


@router.get("/audit")
async def get_menu_audit_logs(
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Get audit history of menu administration changes from smriti_audit_log.
    """
    from sqlalchemy import text
    res = await db.execute(
        text("""
            SELECT id, entity_id, changed_record_id, old_value, new_value, change_type, changed_by, changed_by_name, changed_at
            FROM smriti_audit_log
            WHERE changed_table = 'smriti_menus'
            ORDER BY changed_at DESC
            LIMIT 50;
        """)
    )
    rows = res.fetchall()
    return [
        {
            "id": r[0],
            "entity_id": r[1],
            "changed_record_id": r[2],
            "old_value": r[3],
            "new_value": r[4],
            "change_type": r[5],
            "changed_by": r[6],
            "changed_by_name": r[7],
            "changed_at": r[8].isoformat() if r[8] else None,
        }
        for r in rows
    ]
