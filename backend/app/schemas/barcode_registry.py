from typing import List, Optional

from pydantic import BaseModel, Field


class BarcodeIntakeRequest(BaseModel):
    barcode: str = Field(min_length=1, max_length=100)
    barcode_type: str = "EAN13"
    barcode_purpose: str = "RETAIL"
    encoding_standard: str = "NONE"
    source: str = "GS1_IMPORT"
    source_reference: Optional[str] = None


class BarcodeAssignRequest(BaseModel):
    variant_sku: Optional[str] = None
    item_code: Optional[str] = None
    reason: Optional[str] = None


class BarcodeRegistryResponse(BaseModel):
    id: str
    barcode: str
    barcode_normalized: Optional[str] = None
    barcode_type: str
    barcode_purpose: str
    encoding_standard: str
    status: str
    source: str
    source_reference: Optional[str] = None
    item_id: Optional[str] = None
    item_code: Optional[str] = None
    variant_id: Optional[str] = None
    variant_sku: Optional[str] = None
    item_name: Optional[str] = None
    assigned_at: Optional[str] = None
    assigned_by: Optional[str] = None


class BarcodeBulkRow(BaseModel):
    barcode: str = Field(min_length=1, max_length=100)
    sku: Optional[str] = None
    barcode_type: str = "EAN13"
    barcode_purpose: str = "RETAIL"
    encoding_standard: str = "NONE"
    source: str = "GS1_IMPORT"


class BarcodeBulkPreviewRequest(BaseModel):
    rows: List[BarcodeBulkRow] = Field(min_length=1, max_length=5000)


class BarcodeBulkCommitRequest(BarcodeBulkPreviewRequest):
    approval_reason: str = Field(min_length=3, max_length=500)


class BarcodeBulkRowResult(BaseModel):
    row_number: int
    barcode: str
    sku: Optional[str] = None
    state: str
    message: str


class BarcodeBulkPreviewResponse(BaseModel):
    total: int
    ready: int
    duplicates: int
    invalid: int
    unknown_skus: int
    rows: List[BarcodeBulkRowResult]