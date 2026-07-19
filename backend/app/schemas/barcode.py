"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class BarcodeLayoutCreate(BaseModel):
    name: str
    widthMm: float = Field(50.00, alias="widthMm")
    heightMm: float = Field(25.00, alias="heightMm")
    columns: Optional[int] = 1
    isDefault: Optional[bool] = Field(False, alias="isDefault")
    elements: List[Dict[str, Any]]
    prnTemplate: Optional[str] = Field(None, alias="prnTemplate")

    model_config = ConfigDict(populate_by_name=True)


class BarcodeLayoutUpdate(BaseModel):
    name: Optional[str] = None
    widthMm: Optional[float] = Field(None, alias="widthMm")
    heightMm: Optional[float] = Field(None, alias="heightMm")
    columns: Optional[int] = None
    isDefault: Optional[bool] = Field(None, alias="isDefault")
    elements: Optional[List[Dict[str, Any]]] = None
    prnTemplate: Optional[str] = Field(None, alias="prnTemplate")

    model_config = ConfigDict(populate_by_name=True)


class BarcodeLayoutResponse(BaseModel):
    id: str
    name: str
    widthMm: float = Field(..., serialization_alias="widthMm")
    heightMm: float = Field(..., serialization_alias="heightMm")
    columns: int
    isDefault: bool = Field(..., serialization_alias="isDefault")
    elements: List[Dict[str, Any]]
    prnTemplate: Optional[str] = Field(None, serialization_alias="prnTemplate")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class PrintRequest(BaseModel):
    layoutId: str = Field(..., alias="layoutId")
    items: List[Dict[str, Any]]
    saveAsPrn: Optional[bool] = Field(False, alias="saveAsPrn")


from datetime import datetime

class PrintHistoryResponse(BaseModel):
    id: str
    user: str
    itemCode: str = Field(..., serialization_alias="itemCode")
    itemName: str = Field(..., serialization_alias="itemName")
    barcode: str
    quantity: int
    status: str
    errorMessage: Optional[str] = Field(None, serialization_alias="errorMessage")
    createdAt: datetime = Field(..., serialization_alias="createdAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class PrinterSettingsRequest(BaseModel):
    connection_type: Optional[str] = Field("TCP", alias="connection_type")
    ip: Optional[str] = None
    port: Optional[int] = None
    usb_target: Optional[str] = Field(None, alias="usb_target")

