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
    legal_name: str | None = None
    short_name: str | None = None
    gstNumber: str | None = None  # noqa: N815
    company_type: str | None = None
    industry_type: str | None = None
    fiscal_year_start_month: int | None = None
    currency_code: str | None = None
    is_gst_registered: bool | None = None
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
    branch_type: str | None = "RETAIL"
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_user_id: str | None = None


class BranchUpdate(BaseModel):
    company: str | None = None
    name: str | None = None
    code: str | None = None
    branch_type: str | None = None
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_user_id: str | None = None


class BranchResponse(BaseModel):
    id: str
    name: str
    code: str
    company: str  # Maps to company_id
    branch_type: str | None = "RETAIL"
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_user_id: str | None = None

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            code=obj.code,
            company=obj.company_id,
            branch_type=getattr(obj, "branch_type", "RETAIL") or "RETAIL",
            gstin=getattr(obj, "gstin", None),
            phone=getattr(obj, "phone", None),
            email=getattr(obj, "email", None),
            manager_user_id=getattr(obj, "manager_user_id", None)
        )


class OrganizationCreate(BaseModel):
    name: str
    org_type: str | None = "STANDALONE"
    is_active: bool | None = True


class OrganizationUpdate(BaseModel):
    name: str | None = None
    org_type: str | None = None
    is_active: bool | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    org_type: str
    is_active: bool

    @classmethod
    def from_orm_model(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            org_type=getattr(obj, "org_type", "STANDALONE") or "STANDALONE",
            is_active=obj.is_active if obj.is_active is not None else True
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
