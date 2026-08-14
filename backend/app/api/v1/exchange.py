"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-12
Modified     : 2026-07-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.exchange import DataExchangeTask, DataExchangeFieldMapping
from ...models.inventory import Product
from ...schemas.exchange import (
    DataExchangeTaskCreate, DataExchangeTaskUpdate, DataExchangeTaskResponse,
    FieldMappingCreate, FieldMappingUpdate, FieldMappingResponse, ExecuteTaskRequest
)


class ExchangeValidateRequest(BaseModel):
    partnerId: str
    fileName: Optional[str] = None
    format: Optional[str] = None
    rows: List[Dict[str, Any]]
    checksum: Optional[str] = None


class ExchangeCommitRequest(ExchangeValidateRequest):
    pass

router = APIRouter()


# --- Mappings CRUD ---

@router.get(
    "/mappings",
    response_model=List[FieldMappingResponse],
)
async def list_mappings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all data exchange field mapping translations.
    """
    q = select(DataExchangeFieldMapping).where(DataExchangeFieldMapping.is_deleted == False)
    res = await db.execute(q)
    mappings = res.scalars().all()
    
    serialized = []
    for m in mappings:
        serialized.append(FieldMappingResponse(
            id=m.id,
            name=m.name,
            entityType=m.entity_type,
            mappingRules=json.loads(m.mapping_rules_json) if m.mapping_rules_json else {}
        ))
    return serialized


@router.post(
    "/mappings",
    response_model=FieldMappingResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_mapping(
    req: FieldMappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a new data exchange schema field mapping rules dictionary.
    """
    new_id = f"map-{int(datetime.now(timezone.utc).timestamp())}"
    mapping = DataExchangeFieldMapping(
        id=new_id,
        name=req.name,
        entity_type=req.entityType,
        mapping_rules_json=json.dumps(req.mappingRules),
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    
    return FieldMappingResponse(
        id=mapping.id,
        name=mapping.name,
        entityType=mapping.entity_type,
        mappingRules=req.mappingRules
    )


@router.put(
    "/mappings/{id}",
    response_model=FieldMappingResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_mapping(
    id: str,
    req: FieldMappingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update data exchange field conversion mapping definitions.
    """
    mapping = await db.get(DataExchangeFieldMapping, id)
    if not mapping or mapping.is_deleted:
        raise HTTPException(status_code=404, detail="Mapping definition not found.")

    if req.name is not None: mapping.name = req.name
    if req.entityType is not None: mapping.entity_type = req.entityType
    if req.mappingRules is not None: mapping.mapping_rules_json = json.dumps(req.mappingRules)
    mapping.updated_by = current_user.username
    mapping.modified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(mapping)

    return FieldMappingResponse(
        id=mapping.id,
        name=mapping.name,
        entityType=mapping.entity_type,
        mappingRules=json.loads(mapping.mapping_rules_json) if mapping.mapping_rules_json else {}
    )


@router.delete(
    "/mappings/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_mapping(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete data exchange field mapping rules.
    """
    mapping = await db.get(DataExchangeFieldMapping, id)
    if not mapping or mapping.is_deleted:
        raise HTTPException(status_code=404, detail="Mapping definition not found.")

    mapping.is_deleted = True
    mapping.is_active = False
    mapping.deleted_at = datetime.now(timezone.utc)
    mapping.deleted_by = current_user.username
    await db.commit()
    return {"success": True}


@router.get(
    "/partners",
)
async def list_partners(
    current_user: User = Depends(get_current_user),
):
    """
    Return a static stub list of exchange partners.
    """
    return [
        {
            "id": "PRT-01",
            "name": "Reliance Retail",
            "code": "RELIANCE",
            "type": "Mall",
            "communication": "CSV",
            "schedule": "Daily",
            "ipAllowlist": "*",
            "allowedBranches": ["MUM"],
            "allowedFields": ["sku", "barcode", "quantity", "mrp", "sellingPrice"],
            "expiryDate": "2027-12-31",
            "lastSync": "2026-07-15T08:00:00Z",
        }
    ]


@router.post(
    "/partners",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def save_partner(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """
    Save a partner profile and return the created partner stub.
    """
    return {"success": True, "partner": {**payload, "id": payload.get("id") or f"PRT-{int(datetime.now(timezone.utc).timestamp())}"}}


@router.put(
    "/partners/{partner_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_partner(
    partner_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing partner profile stub.
    """
    return {"success": True, "partner": {"id": partner_id, **payload}}


@router.get(
    "/logs",
)
async def list_exchange_logs(
    current_user: User = Depends(get_current_user),
):
    """
    Return a stub list of exchange logs for approval and history.
    """
    return [
        {
            "id": "EXLOG-001",
            "partnerId": "PRT-01",
            "partnerName": "Reliance Retail",
            "timestamp": "2026-07-15T10:30:00Z",
            "direction": "Inbound",
            "format": "CSV",
            "fileName": "Reliance_POS_Daily_Sales.csv",
            "rowCount": 4,
            "successCount": 3,
            "errorCount": 1,
            "status": "Pending Approval",
            "approvedBy": "-",
        }
    ]


@router.post(
    "/validate",
)
async def validate_exchange_payload(
    payload: ExchangeValidateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Validate exchange rows and return a mock validation report.
    """
    rows = payload.rows or []
    errors = []
    validated_rows = []
    for idx, row in enumerate(rows, start=1):
        row_errors = []
        if not row.get("sku") and not row.get("Item Code"):
            row_errors.append("SKU is required.")
        if row_errors:
            errors.append({"row": idx, "column": "sku", "message": row_errors.join(" ")})
            validated_rows.append({**row, "__error": row_errors.join(" ")})
        else:
            validated_rows.append({**row})

    return {
        "checksum": payload.checksum or f"sha256-sim-{int(datetime.now(timezone.utc).timestamp())}",
        "rowCount": len(rows),
        "successCount": len(rows) - len(errors),
        "errorCount": len(errors),
        "errors": errors,
        "rows": validated_rows,
    }


@router.post(
    "/commit",
)
async def commit_exchange_payload(
    payload: ExchangeCommitRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Commit validated exchange data and emit a mock import log.
    """
    return {
        "success": True,
        "status": "Success",
        "logId": "EXLOG-002",
        "message": "Exchange import committed successfully. Approval pending if required.",
    }


@router.post(
    "/approve-log/{log_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def approve_exchange_log(
    log_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Approve an exchange log entry.
    """
    return {
        "success": True,
        "logId": log_id,
        "status": "Success",
        "message": "Exchange log approved and processed successfully.",
    }


# --- Tasks CRUD ---

@router.get(
    "/tasks",
    response_model=List[DataExchangeTaskResponse],
)
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active data exchange tasks.
    """
    q = select(DataExchangeTask).where(DataExchangeTask.is_deleted == False)
    res = await db.execute(q)
    tasks = res.scalars().all()

    serialized = []
    for t in tasks:
        serialized.append(DataExchangeTaskResponse(
            id=t.id,
            name=t.name,
            direction=t.direction,
            entityType=t.entity_type,
            fileType=t.file_type or "CSV",
            mappingId=t.mapping_id,
            status=t.status or "Idle",
            lastRun=t.last_run.isoformat() if t.last_run else None,
            lastLog=t.last_log
        ))
    return serialized


@router.post(
    "/tasks",
    response_model=DataExchangeTaskResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_task(
    req: DataExchangeTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a new data exchange scheduled task.
    """
    new_id = f"task-{int(datetime.now(timezone.utc).timestamp())}"
    task = DataExchangeTask(
        id=new_id,
        name=req.name,
        direction=req.direction,
        entity_type=req.entityType,
        file_type=req.fileType or "CSV",
        mapping_id=req.mappingId,
        status="Idle",
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return DataExchangeTaskResponse(
        id=task.id,
        name=task.name,
        direction=task.direction,
        entityType=task.entity_type,
        fileType=task.file_type or "CSV",
        mappingId=task.mapping_id,
        status=task.status or "Idle",
        lastRun=None,
        lastLog=None
    )


@router.put(
    "/tasks/{id}",
    response_model=DataExchangeTaskResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_task(
    id: str,
    req: DataExchangeTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update data exchange task settings.
    """
    task = await db.get(DataExchangeTask, id)
    if not task or task.is_deleted:
        raise HTTPException(status_code=404, detail="Data exchange task not found.")

    if req.name is not None: task.name = req.name
    if req.direction is not None: task.direction = req.direction
    if req.entityType is not None: task.entity_type = req.entityType
    if req.fileType is not None: task.file_type = req.fileType
    if req.mappingId is not None: task.mapping_id = req.mappingId
    task.updated_by = current_user.username
    task.modified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task)

    return DataExchangeTaskResponse(
        id=task.id,
        name=task.name,
        direction=task.direction,
        entityType=task.entity_type,
        fileType=task.file_type or "CSV",
        mappingId=task.mapping_id,
        status=task.status or "Idle",
        lastRun=task.last_run.isoformat() if task.last_run else None,
        lastLog=task.last_log
    )


@router.delete(
    "/tasks/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_task(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete data exchange task settings.
    """
    task = await db.get(DataExchangeTask, id)
    if not task or task.is_deleted:
        raise HTTPException(status_code=404, detail="Data exchange task not found.")

    task.is_deleted = True
    task.is_active = False
    task.deleted_at = datetime.now(timezone.utc)
    task.deleted_by = current_user.username
    await db.commit()
    return {"success": True}


# --- Execution Engine ---

@router.post(
    "/tasks/{id}/execute",
)
async def execute_task(
    id: str,
    req: ExecuteTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run data exchange migration parsing/export job flow dynamically.
    """
    task = await db.get(DataExchangeTask, id)
    if not task or task.is_deleted:
        raise HTTPException(status_code=404, detail="Data exchange task not found.")

    task.status   = "Running"
    task.last_run = datetime.now(timezone.utc).replace(tzinfo=None)   # tz-naive: column is TIMESTAMP WITHOUT TZ
    await db.commit()

    # Process payload if Import, otherwise export mock data
    log_messages = []
    success_count = 0
    failure_count = 0

    mapping = None
    if task.mapping_id:
        mapping = await db.get(DataExchangeFieldMapping, task.mapping_id)

    rules = {}
    if mapping and mapping.mapping_rules_json:
        rules = json.loads(mapping.mapping_rules_json)

    if task.direction == "Import":
        rows = req.payload or []
        log_messages.append(f"Received import payload containing {len(rows)} records.")
        
        # Mock parsing mapped attributes insertion / translation
        for index, r in enumerate(rows):
            translated = {}
            for ext_key, int_key in rules.items():
                if ext_key in r:
                    translated[int_key] = r[ext_key]

            # Standard values validation
            if len(translated) > 0 or len(rules) == 0:
                success_count += 1
            else:
                failure_count += 1
                log_messages.append(f"Row {index} mapping resolution failed: Rules constraint violation.")

        log_messages.append(f"Import process finalized. Successfully processed: {success_count}. Failed: {failure_count}.")
        task.status = "Success" if failure_count == 0 else "Failed"
    else:
        # Export task
        log_messages.append("Executing export sequence data compilation query.")
        
        # Build mock export dataset
        export_data = []
        if task.entity_type == "Products":
            # Select actual products from Postgres
            q = select(Product).where(Product.is_deleted == False).limit(10)
            res = (await db.execute(q)).scalars().all()
            for p in res:
                row = {"id": p.id, "code": p.code, "name": p.name, "price": float(p.price), "stock": p.stock}
                # Apply rules mapping back if present
                mapped_row = {}
                if rules:
                    for ext_key, int_key in rules.items():
                        mapped_row[ext_key] = row.get(int_key, "")
                else:
                    mapped_row = row
                export_data.append(mapped_row)
        else:
            export_data = [
                {"ExternalID": "CUST-001", "ClientName": "Jawahar Mallah", "PhoneNo": "9999999999"},
                {"ExternalID": "CUST-002", "ClientName": "Standard Cash Customer", "PhoneNo": "8888888888"}
            ]

        success_count = len(export_data)
        log_messages.append(f"Export dataset ready. Compiled {success_count} records successfully.")
        task.status = "Success"

    task.last_log = "\n".join(log_messages)
    await db.commit()

    return {
        "success": task.status == "Success",
        "status": task.status,
        "processedCount": success_count,
        "failedCount": failure_count,
        "logs": task.last_log,
        "exportedData": export_data if task.direction == "Export" else None
    }
