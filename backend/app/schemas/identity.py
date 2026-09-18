"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


class IdentityRegistryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entity_type: str
    entity_code: str
    identity_group: str
    group_code: str
    display_name: str
    description: Optional[str] = None
    system_id_strategy: str = "UUIDv7"
    identity_code_enabled: bool = True
    identity_code_prefix: str
    identity_code_format: str
    identity_code_scope: str
    business_code_field: Optional[str] = None
    database_table: str
    status: str
    registry_version: int


class NumberingRegistryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entity_type: str
    identity_group: str
    group_code: str
    prefix: str
    scope: str
    sequence_value: int
    padding: int
    reset_policy: str
    financial_year: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    status: str


class IdentityScopePayload(BaseModel):
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    financial_year: Optional[str] = None


class IdentityAllocateRequest(BaseModel):
    """Administrative / preview identity allocation request."""
    entity_type: str = Field(..., description="Entity type identifier, e.g. ITEM, CUSTOMER, SALES_INVOICE")
    group_code: Optional[str] = Field(None, description="Optional group code override, e.g. MST, SAL")
    scope: Optional[IdentityScopePayload] = Field(default_factory=IdentityScopePayload)
    purpose: str = Field("administrative", description="preview | administrative | entity_creation")
    correlation_id: Optional[str] = None


class IdentityAllocateResponse(BaseModel):
    technical_id: str = Field(..., description="Immutable canonical technical ID (UUIDv7)")
    identity_code: str = Field(..., description="Human-friendly identity code (GROUP-ENTITY-SEQUENCE)")
    entity_type: str
    group_code: str
    purpose: str


class IdentityResolveRequest(BaseModel):
    identifier: str = Field(..., description="Technical UUID, SMRITI Identity Code, Alias, or Business Code")
    entity_type_hint: Optional[str] = Field(None, description="Optional entity type hint to route lookups")
    company_id: Optional[str] = None
    branch_id: Optional[str] = None


class IdentityResolveResponse(BaseModel):
    found: bool
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    identity_code: Optional[str] = None
    database_table: Optional[str] = None
    resolution_tier: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IdentityValidateRequest(BaseModel):
    identity_code: str = Field(..., description="SMRITI identity code to validate")


class IdentityValidateResponse(BaseModel):
    is_valid: bool
    identity_group: Optional[str] = None
    entity_code: Optional[str] = None
    sequence_number: Optional[int] = None
    canonical_code: Optional[str] = None


class IdentityEnvelopeResponse(BaseModel):
    found: bool
    canonical_id: Optional[str] = None
    entity_type: Optional[str] = None
    identity_code: Optional[str] = None
    database_table: Optional[str] = None
    resolution_tier: Optional[str] = None
    aliases: List[Dict[str, Any]] = Field(default_factory=list)
    alias_count: int = 0
    deep_link: Optional[str] = None
    allocation_audit: Dict[str, Any] = Field(default_factory=dict)


class IdentityBatchResolveRequest(BaseModel):
    identifiers: List[str] = Field(..., max_length=100, description="List of identifiers to batch resolve")
    entity_type_hint: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    use_cache: bool = True


class IdentityBatchResolveResponse(BaseModel):
    results: Dict[str, IdentityResolveResponse]
    total_requested: int
    total_resolved: int


class IdentitySearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query string")
    entity_types: Optional[List[str]] = Field(None, description="Optional entity types filter, e.g. ['ITEM', 'PARTY']")
    company_id: Optional[str] = None
    limit: int = Field(20, ge=1, le=100)


class IdentitySearchItem(BaseModel):
    entity_type: str
    entity_id: str
    identity_code: Optional[str] = None
    match_type: str
    matched_value: str
    source_system: str
    deep_link: str


class IdentitySearchResponse(BaseModel):
    query: str
    total_matches: int
    matches: List[IdentitySearchItem]


class IdentityCacheStatsResponse(BaseModel):
    size: int
    max_size: int
    hits: int
    misses: int
    evictions: int
    hit_ratio_percent: float

