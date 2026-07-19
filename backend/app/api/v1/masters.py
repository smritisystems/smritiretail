"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-12
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_current_user, get_db, require_permission
from ...models.auth import User
from ...models.inventory import Store, Warehouse
from ...models.tenant import Branch, Company
from ...schemas.masters_tier2 import (
    BranchCreate,
    BranchResponse,
    BranchUpdate,
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    StoreCreate,
    StoreResponse,
    StoreUpdate,
    WarehouseCreate,
    WarehouseResponse,
    WarehouseUpdate,
)

router = APIRouter()


def normalize_type(et: str) -> str:
    val = et.lower().strip()
    if val in ["companies", "company"]:
        return "company"
    if val in ["branches", "branch"]:
        return "branch"
    if val in ["stores", "store"]:
        return "store"
    if val in ["warehouses", "warehouse"]:
        return "warehouse"
    raise HTTPException(status_code=400, detail=f"Invalid organizational master entity type: '{et}'.")


@router.get(
    "/{entity_type}",
    dependencies=[Depends(require_permission("REPORT.VIEW"))]
)
async def list_masters(
    entity_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Any]:
    """
    List all master entities of a given type.
    """
    norm_type = normalize_type(entity_type)
    
    if norm_type == "company":
        q_company = select(Company).where(Company.is_deleted.is_(False)).order_by(Company.name.asc())
        res = await db.execute(q_company)
        return [CompanyResponse.from_orm_model(x) for x in res.scalars().all()]
        
    elif norm_type == "branch":
        q_branch = select(Branch).where(Branch.is_deleted.is_(False)).order_by(Branch.name.asc())
        res = await db.execute(q_branch)
        return [BranchResponse.from_orm_model(x) for x in res.scalars().all()]
        
    elif norm_type == "store":
        q_store = select(Store).where(Store.is_deleted.is_(False)).order_by(Store.name.asc())
        res = await db.execute(q_store)
        return [StoreResponse.from_orm_model(x) for x in res.scalars().all()]
        
    elif norm_type == "warehouse":
        q_warehouse = select(Warehouse).where(Warehouse.is_deleted.is_(False)).order_by(Warehouse.name.asc())
        res = await db.execute(q_warehouse)
        return [WarehouseResponse.from_orm_model(x) for x in res.scalars().all()]
        
    raise HTTPException(status_code=400, detail="Invalid entity type.")


@router.post(
    "/{entity_type}",
    status_code=201,
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
)
async def create_master(
    entity_type: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create a new organizational master entity record.
    """
    norm_type = normalize_type(entity_type)
    timestamp_ms = int(datetime.now(UTC).timestamp() * 1000)

    if norm_type == "company":
        req_company = CompanyCreate(**payload)
        new_id = f"comp-{timestamp_ms}"
        item_company = Company()
        item_company.id = new_id
        item_company.name = req_company.name
        item_company.gst_number = req_company.gstNumber
        item_company.is_active = req_company.status == "Active" if req_company.status else True
        item_company.is_deleted = False
        db.add(item_company)
        await db.commit()
        await db.refresh(item_company)
        return CompanyResponse.from_orm_model(item_company)

    elif norm_type == "branch":
        req_branch = BranchCreate(**payload)
        # Referential integrity check
        company_exists = await db.get(Company, req_branch.company)
        if not company_exists or company_exists.is_deleted:
            raise HTTPException(
                status_code=400,
                detail=f"Referential Integrity Error: Company ID '{req_branch.company}' does not exist."
            )

        new_id = f"br-{timestamp_ms}"
        item_branch = Branch()
        item_branch.id = new_id
        item_branch.company_id = req_branch.company
        item_branch.name = req_branch.name
        item_branch.code = req_branch.code
        item_branch.is_active = True
        item_branch.is_deleted = False
        db.add(item_branch)
        await db.commit()
        await db.refresh(item_branch)
        return BranchResponse.from_orm_model(item_branch)

    elif norm_type == "store":
        req_store = StoreCreate(**payload)
        # Referential integrity check
        branch_exists = await db.get(Branch, req_store.branch)
        if not branch_exists or branch_exists.is_deleted:
            raise HTTPException(
                status_code=400,
                detail=f"Referential Integrity Error: Branch ID '{req_store.branch}' does not exist."
            )

        new_id = f"store-{timestamp_ms}"
        item_store = Store()
        item_store.id = new_id
        item_store.code = req_store.code
        item_store.name = req_store.name
        item_store.branch_id = req_store.branch
        item_store.store_type = req_store.store_type
        item_store.address = req_store.address
        item_store.is_active = req_store.status == "Active" if req_store.status else True
        item_store.is_deleted = False
        item_store.created_by = current_user.username
        item_store.updated_by = current_user.username
        db.add(item_store)
        await db.commit()
        await db.refresh(item_store)
        return StoreResponse.from_orm_model(item_store)

    elif norm_type == "warehouse":
        req_warehouse = WarehouseCreate(**payload)
        # Referential integrity check
        if req_warehouse.branch:
            branch_exists = await db.get(Branch, req_warehouse.branch)
            if not branch_exists or branch_exists.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail=f"Referential Integrity Error: Branch ID '{req_warehouse.branch}' does not exist."
                )

        new_id = f"wh-{timestamp_ms}"
        item_warehouse = Warehouse()
        item_warehouse.id = new_id
        item_warehouse.code = req_warehouse.code
        item_warehouse.name = req_warehouse.name
        item_warehouse.branch_id = req_warehouse.branch
        item_warehouse.is_transit = req_warehouse.is_transit or False
        item_warehouse.address = req_warehouse.address
        item_warehouse.is_active = req_warehouse.status == "Active" if req_warehouse.status else True
        item_warehouse.is_deleted = False
        item_warehouse.created_by = current_user.username
        item_warehouse.updated_by = current_user.username
        db.add(item_warehouse)
        await db.commit()
        await db.refresh(item_warehouse)
        return WarehouseResponse.from_orm_model(item_warehouse)

    raise HTTPException(status_code=400, detail="Invalid entity type.")


@router.put(
    "/{entity_type}/{id}",
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
)
async def update_master(
    entity_type: str,
    id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update organizational master entity record details.
    """
    norm_type = normalize_type(entity_type)

    if norm_type == "company":
        req_company = CompanyUpdate(**payload)
        item_company = await db.get(Company, id)
        if not item_company or item_company.is_deleted:
            raise HTTPException(status_code=404, detail="Company not found.")
        
        if req_company.name is not None:
            item_company.name = req_company.name
        if req_company.gstNumber is not None:
            item_company.gst_number = req_company.gstNumber
        if req_company.status is not None:
            item_company.is_active = req_company.status == "Active"
        
        await db.commit()
        await db.refresh(item_company)
        return CompanyResponse.from_orm_model(item_company)

    elif norm_type == "branch":
        req_branch = BranchUpdate(**payload)
        item_branch = await db.get(Branch, id)
        if not item_branch or item_branch.is_deleted:
            raise HTTPException(status_code=404, detail="Branch not found.")
        
        if req_branch.company:
            company_exists = await db.get(Company, req_branch.company)
            if not company_exists or company_exists.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail=f"Referential Integrity Error: Company ID '{req_branch.company}' does not exist."
                )
            item_branch.company_id = req_branch.company
        
        if req_branch.name is not None:
            item_branch.name = req_branch.name
        if req_branch.code is not None:
            item_branch.code = req_branch.code
            
        await db.commit()
        await db.refresh(item_branch)
        return BranchResponse.from_orm_model(item_branch)

    elif norm_type == "store":
        req_store = StoreUpdate(**payload)
        item_store = await db.get(Store, id)
        if not item_store or item_store.is_deleted:
            raise HTTPException(status_code=404, detail="Store not found.")
        
        if req_store.branch:
            branch_exists = await db.get(Branch, req_store.branch)
            if not branch_exists or branch_exists.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail=f"Referential Integrity Error: Branch ID '{req_store.branch}' does not exist."
                )
            item_store.branch_id = req_store.branch

        if req_store.name is not None:
            item_store.name = req_store.name
        if req_store.code is not None:
            item_store.code = req_store.code
        if req_store.store_type is not None:
            item_store.store_type = req_store.store_type
        if req_store.address is not None:
            item_store.address = req_store.address
        if req_store.status is not None:
            item_store.is_active = req_store.status == "Active"
            
        item_store.updated_by = current_user.username
        item_store.modified_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(item_store)
        return StoreResponse.from_orm_model(item_store)

    elif norm_type == "warehouse":
        req_warehouse = WarehouseUpdate(**payload)
        item_warehouse = await db.get(Warehouse, id)
        if not item_warehouse or item_warehouse.is_deleted:
            raise HTTPException(status_code=404, detail="Warehouse not found.")
        
        if req_warehouse.branch:
            branch_exists = await db.get(Branch, req_warehouse.branch)
            if not branch_exists or branch_exists.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail=f"Referential Integrity Error: Branch ID '{req_warehouse.branch}' does not exist."
                )
            item_warehouse.branch_id = req_warehouse.branch

        if req_warehouse.name is not None:
            item_warehouse.name = req_warehouse.name
        if req_warehouse.code is not None:
            item_warehouse.code = req_warehouse.code
        if req_warehouse.is_transit is not None:
            item_warehouse.is_transit = req_warehouse.is_transit
        if req_warehouse.address is not None:
            item_warehouse.address = req_warehouse.address
        if req_warehouse.status is not None:
            item_warehouse.is_active = req_warehouse.status == "Active"
            
        item_warehouse.updated_by = current_user.username
        item_warehouse.modified_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(item_warehouse)
        return WarehouseResponse.from_orm_model(item_warehouse)

    raise HTTPException(status_code=400, detail="Invalid entity type.")


@router.delete(
    "/{entity_type}/{id}",
    dependencies=[Depends(require_permission("SYSTEM.CONFIG"))],
)
async def delete_master(
    entity_type: str,
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Soft delete / Retire organizational master entity record.
    """
    norm_type = normalize_type(entity_type)

    if norm_type == "company":
        item_company = await db.get(Company, id)
        if not item_company or item_company.is_deleted:
            raise HTTPException(status_code=404, detail="Company not found.")
        item_company.is_deleted = True
        item_company.modified_at = datetime.now(UTC)
        await db.commit()
        return {"success": True, "deletedId": id}

    elif norm_type == "branch":
        item_branch = await db.get(Branch, id)
        if not item_branch or item_branch.is_deleted:
            raise HTTPException(status_code=404, detail="Branch not found.")
        item_branch.is_deleted = True
        item_branch.modified_at = datetime.now(UTC)
        await db.commit()
        return {"success": True, "deletedId": id}

    elif norm_type == "store":
        item_store = await db.get(Store, id)
        if not item_store or item_store.is_deleted:
            raise HTTPException(status_code=404, detail="Store not found.")
        item_store.is_deleted = True
        item_store.deleted_at = datetime.now(UTC)
        item_store.deleted_by = current_user.username
        await db.commit()
        return {"success": True, "deletedId": id}

    elif norm_type == "warehouse":
        item_warehouse = await db.get(Warehouse, id)
        if not item_warehouse or item_warehouse.is_deleted:
            raise HTTPException(status_code=404, detail="Warehouse not found.")
        item_warehouse.is_deleted = True
        item_warehouse.deleted_at = datetime.now(UTC)
        item_warehouse.deleted_by = current_user.username
        await db.commit()
        return {"success": True, "deletedId": id}

    raise HTTPException(status_code=400, detail="Invalid entity type.")
