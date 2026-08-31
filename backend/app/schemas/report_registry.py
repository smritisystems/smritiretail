"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Report Registry & Execution Schemas (v1.0.0-GA).
Defines the Pydantic data contracts for the Central Report Registry, 
5-Vector Version Envelopes, and Decoupled Legacy Alias Resolution.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class StudioType(str, Enum):
    SALES_STUDIO = "sales_studio"
    MERCHANDISE_STUDIO = "merchandise_studio"
    INVENTORY_STUDIO = "inventory_studio"
    TAX_STUDIO = "tax_studio"
    MIS_STUDIO = "mis_studio"


class ReportContractStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DRAFT = "DRAFT"
    DEPRECATED = "DEPRECATED"


class ReportRegistryEntry(BaseModel):
    """Declarative Report Registry Contract."""
    report_id: str = Field(..., description="Unique immutable report code e.g. RPT-SAL-001")
    name: str = Field(..., description="Clean human-readable report title")
    studio: StudioType = Field(..., description="Navigation studio categorization")
    description: str = Field(..., description="Executive description of report purpose")
    dimensions: List[str] = Field(default_factory=list, description="Supported group-by/drill dimensions")
    measures: List[str] = Field(default_factory=list, description="Governed Metric Dictionary IDs included")
    allowed_roles: List[str] = Field(default_factory=list, description="Roles permitted to view report")
    drill_route: Optional[str] = Field(None, description="Drill-down target route or report ID")
    shoper_aliases: List[str] = Field(default_factory=list, description="Decoupled Shoper 9 menu/EXE codes for quick search")
    
    # 5-Vector Contract Versioning
    contract_version: str = Field("v1.0", description="API/Data shape version")
    metric_version: str = Field("v1.0", description="Governed Metric Dictionary version")
    schema_version: str = Field("v1.0", description="Underlying DB read-model version")
    security_policy_version: str = Field("v1.0", description="RBAC & data masking version")
    status: ReportContractStatus = Field(ReportContractStatus.ACTIVE, description="Lifecycle status")


class ExecutionEnvelope(BaseModel):
    """Forensic Execution Identity Envelope for every generated report."""
    execution_id: str = Field(..., description="Unique UUID for this execution instance")
    report_id: str
    report_name: str
    studio: StudioType
    
    # 5-Vector Governance Envelopes
    contract_version: str
    metric_version: str
    schema_version: str
    security_policy_version: str
    
    # As-Of State & Tenant Isolation
    data_as_of: datetime = Field(..., description="Snapshot / point-in-time reference")
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    executed_by_user: str
    executed_by_role: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    audit_trace_id: str
    filters_applied: Dict[str, Any] = Field(default_factory=dict)


class ReportCatalogResponse(BaseModel):
    """Catalog of all registered reports grouped by studio."""
    total_reports: int
    studios: List[StudioType]
    reports: List[ReportRegistryEntry]


class LegacyAliasResolutionResponse(BaseModel):
    """Result of Shoper 9 jump-code query resolution."""
    query_code: str
    matched_report_id: Optional[str] = None
    matched_report_name: Optional[str] = None
    studio: Optional[StudioType] = None
    is_matched: bool = False
