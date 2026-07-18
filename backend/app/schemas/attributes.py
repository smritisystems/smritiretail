"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AttributeDefinitionCreate(BaseModel):
    name: str
    label: str
    dataType: str = Field(..., alias="dataType")
    isVariantDimension: bool | None = Field(False, alias="isVariantDimension")
    isMandatory: bool | None = Field(False, alias="isMandatory")
    validValues: list[str] | None = Field(None, alias="validValues")
    groupId: str | None = Field(None, alias="groupId")
    
    # Extended config fields
    isSearchable: bool | None = Field(True, alias="isSearchable")
    isFilterable: bool | None = Field(True, alias="isFilterable")
    isPrintable: bool | None = Field(True, alias="isPrintable")
    isBarcodeEnabled: bool | None = Field(True, alias="isBarcodeEnabled")
    displayOrder: int | None = Field(0, alias="displayOrder")
    defaultValue: str | None = Field(None, alias="defaultValue")
    tooltip: str | None = Field(None, alias="tooltip")
    validationRules: str | None = Field(None, alias="validationRules")
    isEnabled: bool | None = Field(True, alias="isEnabled")
    multiLangLabels: dict[str, str] | None = Field(None, alias="multiLangLabels")

    model_config = ConfigDict(populate_by_name=True)


class AttributeDefinitionUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    dataType: str | None = Field(None, alias="dataType")
    isVariantDimension: bool | None = Field(None, alias="isVariantDimension")
    isMandatory: bool | None = Field(None, alias="isMandatory")
    validValues: list[str] | None = Field(None, alias="validValues")
    groupId: str | None = Field(None, alias="groupId")
    
    # Extended config fields
    isSearchable: bool | None = Field(None, alias="isSearchable")
    isFilterable: bool | None = Field(None, alias="isFilterable")
    isPrintable: bool | None = Field(None, alias="isPrintable")
    isBarcodeEnabled: bool | None = Field(None, alias="isBarcodeEnabled")
    displayOrder: int | None = Field(None, alias="displayOrder")
    defaultValue: str | None = Field(None, alias="defaultValue")
    tooltip: str | None = Field(None, alias="tooltip")
    validationRules: str | None = Field(None, alias="validationRules")
    isEnabled: bool | None = Field(None, alias="isEnabled")
    multiLangLabels: dict[str, str] | None = Field(None, alias="multiLangLabels")

    model_config = ConfigDict(populate_by_name=True)


class AttributeDefinitionResponse(BaseModel):
    id: str
    name: str
    label: str
    dataType: str = Field(..., serialization_alias="dataType")
    isVariantDimension: bool = Field(..., serialization_alias="isVariantDimension")
    isMandatory: bool = Field(..., serialization_alias="isMandatory")
    validValues: list[str] = Field(..., serialization_alias="validValues")
    groupId: str | None = Field(None, serialization_alias="groupId")
    
    # Extended config fields
    isSearchable: bool = Field(..., serialization_alias="isSearchable")
    isFilterable: bool = Field(..., serialization_alias="isFilterable")
    isPrintable: bool = Field(..., serialization_alias="isPrintable")
    isBarcodeEnabled: bool = Field(..., serialization_alias="isBarcodeEnabled")
    displayOrder: int = Field(..., serialization_alias="displayOrder")
    defaultValue: str | None = Field(None, serialization_alias="defaultValue")
    tooltip: str | None = Field(None, serialization_alias="tooltip")
    validationRules: str | None = Field(None, serialization_alias="validationRules")
    isEnabled: bool = Field(..., serialization_alias="isEnabled")
    multiLangLabels: dict[str, str] = Field(..., serialization_alias="multiLangLabels")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }



class AttributeGroupCreate(BaseModel):
    name: str
    attributeIds: list[str] = Field(..., alias="attributeIds")
    gridColumnAttributeId: str | None = Field(None, alias="gridColumnAttributeId")
    gridRowAttributeId: str | None = Field(None, alias="gridRowAttributeId")

    model_config = ConfigDict(populate_by_name=True)


class AttributeGroupUpdate(BaseModel):
    name: str | None = None
    attributeIds: list[str] | None = Field(None, alias="attributeIds")
    gridColumnAttributeId: str | None = Field(None, alias="gridColumnAttributeId")
    gridRowAttributeId: str | None = Field(None, alias="gridRowAttributeId")

    model_config = ConfigDict(populate_by_name=True)


class AttributeGroupResponse(BaseModel):
    id: str
    name: str
    attributeIds: list[str] = Field(..., serialization_alias="attributeIds")
    gridColumnAttributeId: str | None = Field(None, serialization_alias="gridColumnAttributeId")
    gridRowAttributeId: str | None = Field(None, serialization_alias="gridRowAttributeId")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class VariantTemplateCreate(BaseModel):
    styleCode: str = Field(..., alias="styleCode")
    name: str
    brand: str | None = "SMRITI"
    category: str | None = "General"
    hsnCode: str | None = "61091000"
    basePrice: float | None = Field(0.0, alias="basePrice")
    baseMrp: float | None = Field(0.0, alias="baseMrp")
    gstPercentage: float | None = Field(18.0, alias="gstPercentage")
    attributeGroupId: str = Field(..., alias="attributeGroupId")
    pricingMode: str | None = Field("Fixed", alias="pricingMode")
    trackingMode: str | None = Field("Standard", alias="trackingMode")

    model_config = ConfigDict(populate_by_name=True)


class VariantTemplateUpdate(BaseModel):
    styleCode: str | None = Field(None, alias="styleCode")
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    hsnCode: str | None = None
    basePrice: float | None = Field(None, alias="basePrice")
    baseMrp: float | None = Field(None, alias="baseMrp")
    gstPercentage: float | None = Field(None, alias="gstPercentage")
    attributeGroupId: str | None = Field(None, alias="attributeGroupId")
    pricingMode: str | None = Field(None, alias="pricingMode")
    trackingMode: str | None = Field(None, alias="trackingMode")

    model_config = ConfigDict(populate_by_name=True)


class VariantTemplateResponse(BaseModel):
    id: str
    styleCode: str = Field(..., serialization_alias="styleCode")
    name: str
    brand: str
    category: str
    hsnCode: str = Field(..., serialization_alias="hsnCode")
    basePrice: float = Field(..., serialization_alias="basePrice")
    baseMrp: float = Field(..., serialization_alias="baseMrp")
    gstPercentage: float = Field(..., serialization_alias="gstPercentage")
    attributeGroupId: str = Field(..., serialization_alias="attributeGroupId")
    pricingMode: str = Field(..., serialization_alias="pricingMode")
    trackingMode: str = Field(..., serialization_alias="trackingMode")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class GenerateVariantsRequest(BaseModel):
    variants: list[dict[str, Any]]


class CategoryMappingCreate(BaseModel):
    category: str
    attributeGroupId: str = Field(..., alias="attributeGroupId")

    model_config = ConfigDict(populate_by_name=True)


class CategoryMappingResponse(BaseModel):
    category: str
    attributeGroupId: str = Field(..., serialization_alias="attributeGroupId")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class ImportValidateRequest(BaseModel):
    groupId: str = Field(..., alias="groupId")
    rows: list[dict[str, Any]]
