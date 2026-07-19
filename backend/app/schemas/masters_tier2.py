"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""


from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    gstNumber: str | None = None  # noqa: N815
    status: str | None = "Active"


class CompanyUpdate(BaseModel):
    name: str | None = None
    gstNumber: str | None = None  # noqa: N815
    status: str | None = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    gstNumber: str | None = None  # noqa: N815
    status: str

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            gstNumber=obj.gst_number,
            status="Active" if obj.is_active else "Inactive"
        )


class BranchCreate(BaseModel):
    company: str  # Maps to company_id
    name: str
    code: str


class BranchUpdate(BaseModel):
    company: str | None = None
    name: str | None = None
    code: str | None = None


class BranchResponse(BaseModel):
    id: str
    name: str
    code: str
    company: str  # Maps to company_id

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            code=obj.code,
            company=obj.company_id
        )


class StoreCreate(BaseModel):
    branch: str  # Maps to branch_id
    code: str
    name: str
    store_type: str | None = None
    address: str | None = None
    status: str | None = "Active"


class StoreUpdate(BaseModel):
    branch: str | None = None
    code: str | None = None
    name: str | None = None
    store_type: str | None = None
    address: str | None = None
    status: str | None = None


class StoreResponse(BaseModel):
    id: str
    code: str
    name: str
    branch: str  # Maps to branch_id
    store_type: str | None = None
    address: str | None = None
    status: str

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            code=obj.code,
            name=obj.name,
            branch=obj.branch_id,
            store_type=obj.store_type,
            address=obj.address,
            status="Active" if obj.is_active else "Inactive"
        )


class WarehouseCreate(BaseModel):
    branch: str | None = None  # Maps to branch_id
    code: str
    name: str
    is_transit: bool | None = False
    address: str | None = None
    status: str | None = "Active"


class WarehouseUpdate(BaseModel):
    branch: str | None = None
    code: str | None = None
    name: str | None = None
    is_transit: bool | None = None
    address: str | None = None
    status: str | None = None


class WarehouseResponse(BaseModel):
    id: str
    code: str
    name: str
    branch: str | None = None  # Maps to branch_id
    is_transit: bool
    address: str | None = None
    status: str

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            code=obj.code,
            name=obj.name,
            branch=obj.branch_id,
            is_transit=obj.is_transit or False,
            address=obj.address,
            status="Active" if obj.is_active else "Inactive"
        )
