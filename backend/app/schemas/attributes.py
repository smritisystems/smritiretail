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

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AttributeDefinitionCreate(BaseModel):
    name: str
    label: str
    dataType: str = Field(..., alias="dataType")
    isVariantDimension: Optional[bool] = Field(False, alias="isVariantDimension")
    isMandatory: Optional[bool] = Field(False, alias="isMandatory")
    validValues: Optional[List[str]] = Field(None, alias="validValues")
    groupId: Optional[str] = Field(None, alias="groupId")
    
    # Extended config fields
    isSearchable: Optional[bool] = Field(True, alias="isSearchable")
    isFilterable: Optional[bool] = Field(True, alias="isFilterable")
    isPrintable: Optional[bool] = Field(True, alias="isPrintable")
    isBarcodeEnabled: Optional[bool] = Field(True, alias="isBarcodeEnabled")
    displayOrder: Optional[int] = Field(0, alias="displayOrder")
    defaultValue: Optional[str] = Field(None, alias="defaultValue")
    tooltip: Optional[str] = Field(None, alias="tooltip")
    validationRules: Optional[str] = Field(None, alias="validationRules")
    isEnabled: Optional[bool] = Field(True, alias="isEnabled")
    multiLangLabels: Optional[Dict[str, str]] = Field(None, alias="multiLangLabels")

    model_config = ConfigDict(populate_by_name=True)


class AttributeDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    dataType: Optional[str] = Field(None, alias="dataType")
    isVariantDimension: Optional[bool] = Field(None, alias="isVariantDimension")
    isMandatory: Optional[bool] = Field(None, alias="isMandatory")
    validValues: Optional[List[str]] = Field(None, alias="validValues")
    groupId: Optional[str] = Field(None, alias="groupId")
    
    # Extended config fields
    isSearchable: Optional[bool] = Field(None, alias="isSearchable")
    isFilterable: Optional[bool] = Field(None, alias="isFilterable")
    isPrintable: Optional[bool] = Field(None, alias="isPrintable")
    isBarcodeEnabled: Optional[bool] = Field(None, alias="isBarcodeEnabled")
    displayOrder: Optional[int] = Field(None, alias="displayOrder")
    defaultValue: Optional[str] = Field(None, alias="defaultValue")
    tooltip: Optional[str] = Field(None, alias="tooltip")
    validationRules: Optional[str] = Field(None, alias="validationRules")
    isEnabled: Optional[bool] = Field(None, alias="isEnabled")
    multiLangLabels: Optional[Dict[str, str]] = Field(None, alias="multiLangLabels")

    model_config = ConfigDict(populate_by_name=True)


class AttributeDefinitionResponse(BaseModel):
    id: str
    name: str
    label: str
    dataType: str = Field(..., serialization_alias="dataType")
    isVariantDimension: bool = Field(..., serialization_alias="isVariantDimension")
    isMandatory: bool = Field(..., serialization_alias="isMandatory")
    validValues: List[str] = Field(..., serialization_alias="validValues")
    groupId: Optional[str] = Field(None, serialization_alias="groupId")
    
    # Extended config fields
    isSearchable: bool = Field(..., serialization_alias="isSearchable")
    isFilterable: bool = Field(..., serialization_alias="isFilterable")
    isPrintable: bool = Field(..., serialization_alias="isPrintable")
    isBarcodeEnabled: bool = Field(..., serialization_alias="isBarcodeEnabled")
    displayOrder: int = Field(..., serialization_alias="displayOrder")
    defaultValue: Optional[str] = Field(None, serialization_alias="defaultValue")
    tooltip: Optional[str] = Field(None, serialization_alias="tooltip")
    validationRules: Optional[str] = Field(None, serialization_alias="validationRules")
    isEnabled: bool = Field(..., serialization_alias="isEnabled")
    multiLangLabels: Dict[str, str] = Field(..., serialization_alias="multiLangLabels")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }



class AttributeGroupCreate(BaseModel):
    name: str
    attributeIds: List[str] = Field(..., alias="attributeIds")
    gridColumnAttributeId: Optional[str] = Field(None, alias="gridColumnAttributeId")
    gridRowAttributeId: Optional[str] = Field(None, alias="gridRowAttributeId")

    model_config = ConfigDict(populate_by_name=True)


class AttributeGroupUpdate(BaseModel):
    name: Optional[str] = None
    attributeIds: Optional[List[str]] = Field(None, alias="attributeIds")
    gridColumnAttributeId: Optional[str] = Field(None, alias="gridColumnAttributeId")
    gridRowAttributeId: Optional[str] = Field(None, alias="gridRowAttributeId")

    model_config = ConfigDict(populate_by_name=True)


class AttributeGroupResponse(BaseModel):
    id: str
    name: str
    attributeIds: List[str] = Field(..., serialization_alias="attributeIds")
    gridColumnAttributeId: Optional[str] = Field(None, serialization_alias="gridColumnAttributeId")
    gridRowAttributeId: Optional[str] = Field(None, serialization_alias="gridRowAttributeId")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class VariantTemplateCreate(BaseModel):
    styleCode: str = Field(..., alias="styleCode")
    name: str
    brand: Optional[str] = "SMRITI"
    category: Optional[str] = "General"
    hsnCode: Optional[str] = "61091000"
    basePrice: Optional[float] = Field(0.0, alias="basePrice")
    baseMrp: Optional[float] = Field(0.0, alias="baseMrp")
    gstPercentage: Optional[float] = Field(18.0, alias="gstPercentage")
    attributeGroupId: str = Field(..., alias="attributeGroupId")
    pricingMode: Optional[str] = Field("Fixed", alias="pricingMode")
    trackingMode: Optional[str] = Field("Standard", alias="trackingMode")

    model_config = ConfigDict(populate_by_name=True)


class VariantTemplateUpdate(BaseModel):
    styleCode: Optional[str] = Field(None, alias="styleCode")
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    hsnCode: Optional[str] = None
    basePrice: Optional[float] = Field(None, alias="basePrice")
    baseMrp: Optional[float] = Field(None, alias="baseMrp")
    gstPercentage: Optional[float] = Field(None, alias="gstPercentage")
    attributeGroupId: Optional[str] = Field(None, alias="attributeGroupId")
    pricingMode: Optional[str] = Field(None, alias="pricingMode")
    trackingMode: Optional[str] = Field(None, alias="trackingMode")

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
    variants: List[Dict[str, Any]]


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
    rows: List[Dict[str, Any]]
