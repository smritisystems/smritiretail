"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DatabaseSummary(BaseModel):
    name: str
    size_bytes: int
    size_pretty: str
    table_count: int
    is_active: bool = False
    is_control_plane: bool = False
    is_tenant: bool = False

    model_config = ConfigDict(populate_by_name=True)


class TableSummary(BaseModel):
    name: str
    row_count: int
    size_bytes: int
    size_pretty: str
    column_count: int
    category: str = "General"

    model_config = ConfigDict(populate_by_name=True)


class ColumnSchema(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    default_value: Optional[str] = None
    max_length: Optional[int] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_table: Optional[str] = None
    foreign_column: Optional[str] = None
    delete_rule: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class TableSchemaResponse(BaseModel):
    table_name: str
    database: str
    columns: List[ColumnSchema]
    primary_keys: List[str]
    foreign_keys: List[Dict[str, Any]]
    indexes: List[Dict[str, Any]]

    model_config = ConfigDict(populate_by_name=True)


class TableDataResponse(BaseModel):
    table_name: str
    database: str
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    page: int
    limit: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)


class MigrationInfo(BaseModel):
    current_revision: Optional[str]
    head_revision: Optional[str] = None
    is_up_to_date: bool = True
    database: str

    model_config = ConfigDict(populate_by_name=True)


class SqlQueryRequest(BaseModel):
    query: str
    database: Optional[str] = None
    max_rows: Optional[int] = Field(50, ge=1, le=200)

    model_config = ConfigDict(populate_by_name=True)


class SqlQueryResponse(BaseModel):
    success: bool
    database: str
    query: str
    columns: List[str] = []
    rows: List[Dict[str, Any]] = []
    row_count: int = 0
    execution_time_ms: float = 0.0
    error: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
