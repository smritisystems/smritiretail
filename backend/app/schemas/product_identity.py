"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


def _to_snake_case(name: str) -> str:
    return "".join("_" + c.lower() if c.isupper() else c for c in name).lstrip("_")


response_model_config = ConfigDict(
    from_attributes=True,
    populate_by_name=True,
    alias_generator=_to_snake_case,
)


class BarcodeProviderBase(BaseModel):
    name: str = Field(..., max_length=100)
    providerType: str = Field(..., max_length=50, serialization_alias="providerType")
    poolCode: Optional[str] = Field(None, max_length=100, serialization_alias="poolCode")
    priority: Optional[int] = 100
    config: Optional[Dict[str, Any]] = {}
    description: Optional[str] = None
    isActive: Optional[bool] = Field(True, serialization_alias="isActive")

    model_config = response_model_config


class BarcodeProviderCreate(BarcodeProviderBase):
    pass


class BarcodeProviderUpdate(BaseModel):
    name: Optional[str] = None
    providerType: Optional[str] = None
    poolCode: Optional[str] = None
    priority: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None


class BarcodeProviderResponse(BarcodeProviderBase):
    id: str = Field(..., alias="id", serialization_alias="id")
    uuid: str = Field(..., alias="uuid", serialization_alias="uuid")
    companyId: Optional[str] = Field(None, alias="company_id", serialization_alias="companyId")
    branchId: Optional[str] = Field(None, alias="branch_id", serialization_alias="branchId")
    createdAt: datetime = Field(..., alias="created_at", serialization_alias="createdAt")
    modifiedAt: datetime = Field(..., alias="modified_at", serialization_alias="modifiedAt")
    isActive: bool = Field(..., alias="is_active", serialization_alias="isActive")
    isDeleted: bool = Field(..., alias="is_deleted", serialization_alias="isDeleted")
    version: int = Field(..., alias="version", serialization_alias="version")

    model_config = response_model_config


class IdentityRuleBase(BaseModel):
    name: str = Field(..., max_length=150, serialization_alias="name")
    code: str = Field(..., max_length=100, serialization_alias="code")
    scope: Optional[Dict[str, Any]] = Field({}, serialization_alias="scope")
    expression: str = Field(..., serialization_alias="expression")
    priority: Optional[int] = Field(100, serialization_alias="priority")
    isActive: Optional[bool] = Field(True, serialization_alias="isActive")
    description: Optional[str] = Field(None, serialization_alias="description")

    model_config = response_model_config


class IdentityRuleCreate(IdentityRuleBase):
    pass


class IdentityRuleUpdate(BaseModel):
    name: Optional[str] = None
    scope: Optional[Dict[str, Any]] = None
    expression: Optional[str] = None
    priority: Optional[int] = None
    isActive: Optional[bool] = None
    description: Optional[str] = None


class IdentityRuleResponse(IdentityRuleBase):
    id: str = Field(..., alias="id", serialization_alias="id")
    uuid: str = Field(..., alias="uuid", serialization_alias="uuid")
    companyId: Optional[str] = Field(None, alias="company_id", serialization_alias="companyId")
    branchId: Optional[str] = Field(None, alias="branch_id", serialization_alias="branchId")
    createdAt: datetime = Field(..., alias="created_at", serialization_alias="createdAt")
    modifiedAt: datetime = Field(..., alias="modified_at", serialization_alias="modifiedAt")
    isActive: bool = Field(..., alias="is_active", serialization_alias="isActive")
    isDeleted: bool = Field(..., alias="is_deleted", serialization_alias="isDeleted")
    version: int = Field(..., alias="version", serialization_alias="version")

    model_config = response_model_config


class ProductIdentityBase(BaseModel):
    productId: str = Field(..., serialization_alias="productId")
    businessKey: str = Field(..., serialization_alias="businessKey")
    fingerprint: str = Field(..., serialization_alias="fingerprint")
    barcode: str = Field(..., serialization_alias="barcode")
    barcodeProviderId: Optional[str] = Field(None, serialization_alias="barcodeProviderId")
    state: Optional[str] = Field("Available", serialization_alias="state")
    identityMetadata: Optional[Dict[str, Any]] = Field({}, serialization_alias="identityMetadata")
    ruleId: Optional[str] = Field(None, serialization_alias="ruleId")

    model_config = response_model_config


class ProductIdentityCreate(ProductIdentityBase):
    pass


class ProductIdentityUpdate(BaseModel):
    barcode: Optional[str] = None
    barcodeProviderId: Optional[str] = None
    state: Optional[str] = None
    identityMetadata: Optional[Dict[str, Any]] = None
    ruleId: Optional[str] = None


class ProductIdentityResponse(ProductIdentityBase):
    id: str = Field(..., alias="id", serialization_alias="id")
    uuid: str = Field(..., alias="uuid", serialization_alias="uuid")
    companyId: Optional[str] = Field(None, alias="company_id", serialization_alias="companyId")
    branchId: Optional[str] = Field(None, alias="branch_id", serialization_alias="branchId")
    assignedAt: Optional[datetime] = Field(None, alias="assigned_at", serialization_alias="assignedAt")
    createdAt: datetime = Field(..., alias="created_at", serialization_alias="createdAt")
    modifiedAt: datetime = Field(..., alias="modified_at", serialization_alias="modifiedAt")
    isActive: bool = Field(..., alias="is_active", serialization_alias="isActive")
    isDeleted: bool = Field(..., alias="is_deleted", serialization_alias="isDeleted")
    version: int = Field(..., alias="version", serialization_alias="version")

    model_config = response_model_config


class ProductIdentitySearchResponse(BaseModel):
    items: List[ProductIdentityResponse]
    total: int
