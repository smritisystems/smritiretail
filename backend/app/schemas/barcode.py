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


class BarcodeLayoutCreate(BaseModel):
    name: str
    widthMm: float = Field(50.00, alias="widthMm")
    heightMm: float = Field(25.00, alias="heightMm")
    columns: int | None = 1
    isDefault: bool | None = Field(False, alias="isDefault")
    elements: list[dict[str, Any]]
    prnTemplate: str | None = Field(None, alias="prnTemplate")

    model_config = ConfigDict(populate_by_name=True)


class BarcodeLayoutUpdate(BaseModel):
    name: str | None = None
    widthMm: float | None = Field(None, alias="widthMm")
    heightMm: float | None = Field(None, alias="heightMm")
    columns: int | None = None
    isDefault: bool | None = Field(None, alias="isDefault")
    elements: list[dict[str, Any]] | None = None
    prnTemplate: str | None = Field(None, alias="prnTemplate")

    model_config = ConfigDict(populate_by_name=True)


class BarcodeLayoutResponse(BaseModel):
    id: str
    name: str
    widthMm: float = Field(..., serialization_alias="widthMm")
    heightMm: float = Field(..., serialization_alias="heightMm")
    columns: int
    isDefault: bool = Field(..., serialization_alias="isDefault")
    elements: list[dict[str, Any]]
    prnTemplate: str | None = Field(None, serialization_alias="prnTemplate")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class PrintRequest(BaseModel):
    layoutId: str = Field(..., alias="layoutId")
    items: list[dict[str, Any]]
    saveAsPrn: bool | None = Field(False, alias="saveAsPrn")


from datetime import datetime


class PrintHistoryResponse(BaseModel):
    id: str
    user: str
    itemCode: str = Field(..., serialization_alias="itemCode")
    itemName: str = Field(..., serialization_alias="itemName")
    barcode: str
    quantity: int
    status: str
    errorMessage: str | None = Field(None, serialization_alias="errorMessage")
    createdAt: datetime = Field(..., serialization_alias="createdAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class PrinterSettingsRequest(BaseModel):
    connection_type: str | None = Field("TCP", alias="connection_type")
    ip: str | None = None
    port: int | None = None
    usb_target: str | None = Field(None, alias="usb_target")

