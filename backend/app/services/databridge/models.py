"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Foundation Service
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CORE_FOUNDATION", role="ADAPTER", canonicalOwner="backend/app/services/databridge/service.py")

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


class DataBridgeStatusResponse(BaseModel):
    """Authoritative status response for SMRITI DataBridge capability."""

    status: str = Field(default="ONLINE", description="Operational status: ONLINE | DEGRADED | MAINTENANCE")
    capability_code: str = Field(default="DATABRIDGE", description="System capability code")
    version: str = Field(default="1.0.0", description="DataBridge subsystem release version")
    exchange_standard: str = Field(default="SMRITI-X v1.0", description="Canonical exchange standard")
    supported_formats: List[str] = Field(
        default=["JSON", "CSV", "XLSX"],
        description="Supported data interchange formats"
    )
    tenant_id: str = Field(..., description="Tenant identity domain")
    company_id: str = Field(..., description="Active business company ID")
    branch_id: Optional[str] = Field(default=None, description="Active branch ID")
    resolved_database: str = Field(..., description="Bound PostgreSQL tenant database")
    entitlement_active: bool = Field(..., description="Whether capability subscription is active for this company")
    server_time: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Current server UTC timestamp"
    )

    model_config = {"frozen": True}


class DataBridgeContractPingRequest(BaseModel):
    """Foundation handshake and boundary verification request."""

    echo_token: str = Field(default="SMRITI-DATABRIDGE-PING", min_length=1, max_length=128)
    idempotency_key: Optional[str] = Field(default=None, max_length=150)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeContractPingResponse(BaseModel):
    """Foundation handshake verification response with cryptographic proof."""

    echo_token: str
    status: str = "SUCCESS"
    tenant_isolation_verified: bool = True
    resolved_database: str
    company_id: str
    actor_id: str
    compliance_sha256: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class DataBridgeSecurityContext(BaseModel):
    """Verified ingress execution context for DataBridge operations."""

    tenant_id: str
    company_id: str
    branch_id: str
    user_id: str
    user_role: str
    capability_code: str = "DATABRIDGE"
    is_entitled: bool = True
    authorized_permissions: List[str] = Field(default_factory=list)

    model_config = {"frozen": True}


class DataBridgeReconciliationSummary(BaseModel):
    """Standardized summary block for all DataBridge import/export operations."""

    total_rows: int = 0
    valid_rows: int = 0
    new_rows: int = 0
    existing_match_rows: int = 0
    existing_conflict_rows: int = 0
    invalid_rows: int = 0
    warning_rows: int = 0
    status: str = "IDLE"  # IDLE, READY_FOR_IMPORT, COMMITTED, REJECTED


# ==============================================================================
# PHASE 2 CATALOG DOMAIN ADAPTER CONTRACTS
# ==============================================================================

from enum import Enum


class DataBridgeClassification(str, Enum):
    """Authoritative classification taxonomy for DataBridge operations."""

    CREATE = "CREATE"
    UPDATE = "UPDATE"
    NO_CHANGE = "NO_CHANGE"
    EXISTING_CONFLICT = "EXISTING_CONFLICT"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    DEPENDENCY_ERROR = "DEPENDENCY_ERROR"


class DataBridgeEntityType(str, Enum):
    """Supported entity domains for DataBridge (Catalog, Party Masters, Transactions)."""

    ITEM = "ITEM"
    VARIANT = "VARIANT"
    BARCODE = "BARCODE"
    PRICEBOOK = "PRICEBOOK"
    CATALOG_DOCUMENT = "CATALOG_DOCUMENT"
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    GOODS_RECEIPT_NOTE = "GOODS_RECEIPT_NOTE"
    PURCHASE_INVOICE = "PURCHASE_INVOICE"
    PURCHASE_DEBIT_NOTE = "PURCHASE_DEBIT_NOTE"
    SALES_INVOICE = "SALES_INVOICE"
    SALES_RETURN = "SALES_RETURN"
    SALES_ORDER = "SALES_ORDER"
    STOCK_TRANSFER = "STOCK_TRANSFER"
    STOCK_AUDIT = "STOCK_AUDIT"


class DataBridgeDiffField(BaseModel):
    """Granular before/after comparison for a single attribute."""

    old_value: Any = None
    new_value: Any = None
    is_different: bool = True


class DataBridgeDiff(BaseModel):
    """In-memory comparison diff of entity attributes."""

    fields: Dict[str, DataBridgeDiffField] = Field(default_factory=dict)


class DataBridgeConflict(BaseModel):
    """Structured representation of a blocking business rule conflict."""

    conflict_code: str
    message: str
    conflicting_entity: Optional[str] = None
    conflicting_id: Optional[str] = None
    severity: str = "BLOCK"


class DataBridgeRow(BaseModel):
    """Raw input row wrapped with extraction metadata."""

    row_index: int
    raw_data: Dict[str, Any]
    normalized_data: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeCandidate(BaseModel):
    """Database resolution match candidate."""

    row_index: int
    entity_type: str
    matched: bool
    matched_id: Optional[str] = None
    matched_identifier: Optional[str] = None
    existing_record: Optional[Dict[str, Any]] = None


class DataBridgeResultItem(BaseModel):
    """Per-row preview and commit outcome object."""

    row_index: int
    record_id: Optional[str] = None
    entity_type: str
    classification: DataBridgeClassification
    target_identifier: str
    diff: Optional[DataBridgeDiff] = None
    conflicts: List[DataBridgeConflict] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    normalized_data: Optional[Dict[str, Any]] = None


class DataBridgeSummary(BaseModel):
    """Aggregated counters for preview and commit evaluations."""

    total_rows: int = 0
    create_count: int = 0
    update_count: int = 0
    no_change_count: int = 0
    conflict_count: int = 0
    validation_error_count: int = 0
    dependency_error_count: int = 0


class DataBridgePreviewRequest(BaseModel):
    """Unified catalog preview analysis request."""

    entity_type: DataBridgeEntityType = DataBridgeEntityType.CATALOG_DOCUMENT
    rows: List[Dict[str, Any]] = Field(default_factory=list, description="Heterogeneous row objects")
    file_format: str = Field(default="JSON", description="JSON | CSV | XLSX | SMRITI-X")
    idempotency_key: Optional[str] = Field(default=None, max_length=150)
    dry_run: bool = True


class DataBridgePreviewResponse(BaseModel):
    """Full preview inspection report with diffs and conflicts."""

    summary: DataBridgeSummary
    can_commit: bool
    blocking_reasons: List[str] = Field(default_factory=list)
    items: List[DataBridgeResultItem] = Field(default_factory=list)
    preview_token: str
    expires_at: str
    payload_sha256: str


class DataBridgeCommitRequest(BaseModel):
    """Atomic commit execution request requiring explicit user confirmation."""

    entity_type: DataBridgeEntityType = DataBridgeEntityType.CATALOG_DOCUMENT
    preview_token: str = Field(..., description="Cryptographically signed preview verification token")
    confirmed: bool = Field(..., description="Explicit user confirmation flag (must be True)")
    rows: List[Dict[str, Any]] = Field(default_factory=list, description="Exact payload matching preview token")
    file_format: str = Field(default="JSON", description="JSON | CSV | XLSX | SMRITI-X")
    idempotency_key: Optional[str] = Field(default=None, max_length=150)


class DataBridgeCommitResponse(BaseModel):
    """Authoritative outcome of an atomic commit transaction."""

    status: str = "COMMITTED"
    summary: DataBridgeSummary
    committed_count: int = 0
    execution_time_ms: float = 0.0
    compliance_sha256: str
    items: List[DataBridgeResultItem] = Field(default_factory=list)
    idempotent_replay: bool = False


class DataBridgeResult(BaseModel):
    """Internal adapter batch processing result."""

    status: str
    items: List[DataBridgeResultItem]
    summary: DataBridgeSummary


# ==============================================================================
# PHASE 4 ASYNCHRONOUS IMPORT ENGINE & CHUNKED QUEUE CONTRACTS
# ==============================================================================

class DataBridgeAsyncJobStatus(str, Enum):
    """Execution status for high-volume asynchronous DataBridge outbox jobs."""

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class DataBridgeAsyncSubmitRequest(BaseModel):
    """Submission payload for asynchronous chunked DataBridge ingestion (>5,000 rows)."""

    entity_type: DataBridgeEntityType = DataBridgeEntityType.CATALOG_DOCUMENT
    rows: List[Dict[str, Any]] = Field(default_factory=list, description="Raw rows payload")
    chunk_size: int = Field(default=500, ge=1, le=5000, description="Processing chunk size")
    file_format: str = Field(default="JSON", description="JSON | CSV | XLSX | SMRITI-X")
    filename: Optional[str] = Field(default=None, description="Original uploaded filename")
    idempotency_key: Optional[str] = Field(default=None, max_length=150)
    preview_only: bool = Field(default=False, description="Whether to execute dry-run preview or atomic commit")


class DataBridgeAsyncJobResponse(BaseModel):
    """Immediate HTTP 202 Accepted response upon successfully staging an async job."""

    job_id: str
    status: str = "PENDING"
    total_rows: int
    chunk_size: int
    entity_type: str
    created_at: str
    message: str = "DataBridge async import job submitted successfully."


class DataBridgeJobStatusResponse(BaseModel):
    """Progress, row metrics, and completion state for a background DataBridge job."""

    job_id: str
    status: str
    entity_type: str
    total_rows: int
    processed_rows: int
    committed_count: int
    error_count: int
    progress_percent: float
    current_chunk: int
    total_chunks: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    compliance_sha256: Optional[str] = None
    error_message: Optional[str] = None
    summary: Optional[DataBridgeSummary] = None
    items_sample: List[DataBridgeResultItem] = Field(default_factory=list)


# ==============================================================================
# PHASE 5 MULTI-FORMAT STREAMING EXPORT CONTRACTS
# ==============================================================================

class DataBridgeExportFormat(str, Enum):
    """Supported output formats for DataBridge streaming exports."""

    CSV = "CSV"
    JSON = "JSON"
    SMRITI_X = "SMRITI_X"
    XLSX = "XLSX"


class DataBridgeExportRequest(BaseModel):
    """Configuration payload for initiating a streaming data export."""

    entity_type: DataBridgeEntityType
    file_format: DataBridgeExportFormat = DataBridgeExportFormat.CSV
    filters: Optional[Dict[str, Any]] = None
    limit: Optional[int] = Field(default=50000, ge=1, le=100000)
    include_audit_signature: bool = True


class DataBridgeExportResponse(BaseModel):
    """Summary metadata descriptor for an export operation."""

    export_id: str
    entity_type: str
    file_format: str
    total_exported_rows: int
    file_size_bytes: int
    compliance_sha256: str
    download_filename: str
    generated_at: str


# ==============================================================================
# PHASE 6 MIGRATION TOOLKIT & ROLLBACK CONTRACTS
# ==============================================================================

class DataBridgeRollbackRequest(BaseModel):
    """Execution payload for rolling back a bulk import batch or job."""

    job_or_batch_id: str = Field(..., description="Job ID, batch ID, or filename of the operation to rollback")
    entity_type: DataBridgeEntityType = Field(..., description="Target business entity to rollback")
    reason: str = Field(..., min_length=5, description="Audited business justification for rollback")
    dry_run: bool = Field(default=False, description="Simulate rollback without mutating database")
    max_records: int = Field(default=50000, ge=1, le=100000)


class DataBridgeRollbackResponse(BaseModel):
    """Result report of a rollback operation."""

    rollback_id: str
    job_or_batch_id: str
    entity_type: str
    reverted_creates: int
    reverted_updates: int
    skipped_records: int
    dry_run: bool
    status: str  # "SIMULATED" or "COMPLETED"
    affected_ids: List[str] = Field(default_factory=list)
    compliance_sha256: str
    executed_at: str


class DataBridgeTenantTransferRequest(BaseModel):
    """Payload for replicating data between tenant company databases."""

    source_company_id: str = Field(..., description="Source company ID to export from")
    target_company_id: str = Field(..., description="Target company ID to import into")
    entity_types: List[DataBridgeEntityType] = Field(..., min_length=1)
    transfer_mode: str = Field(default="PREVIEW_ONLY", description="PREVIEW_ONLY | COMMIT")
    limit_per_entity: int = Field(default=5000, ge=1, le=50000)


class DataBridgeTenantTransferResponse(BaseModel):
    """Execution report for cross-tenant replication."""

    transfer_id: str
    source_company_id: str
    target_company_id: str
    transfer_mode: str
    status: str  # "PREVIEWED" | "COMMITTED" | "FAILED"
    entity_summaries: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    compliance_sha256: str
    executed_at: str


# ==============================================================================
# PHASE 7 SCHEMA MAPPING INTELLIGENCE CONTRACTS
# ==============================================================================

class DataBridgeCandidateMatch(BaseModel):
    """Candidate field match with confidence score."""
    field_key: str
    field_label: str
    score: float
    reason: str


class DataBridgeColumnMapping(BaseModel):
    """Mapping recommendation for a single input spreadsheet column."""
    source_header: str
    source_index: int
    mapped_field_key: Optional[str] = None
    mapped_field_label: Optional[str] = None
    confidence: str  # "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS" | "UNMAPPED"
    confidence_score: float  # 0.0 to 1.0
    is_required: bool = False
    is_statutory: bool = False
    is_ambiguous: bool = False
    match_reason: str
    candidates: List[DataBridgeCandidateMatch] = Field(default_factory=list)


class DataBridgeSchemaDetectRequest(BaseModel):
    """Payload to request automated schema mapping detection."""
    entity_type: DataBridgeEntityType
    headers: List[str] = Field(..., min_length=1, description="List of raw column headers from file")
    sample_rows: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional 1-10 sample data rows for content-aware profiling")


class DataBridgeMissingField(BaseModel):
    """Details of a missing required or statutory field."""
    field_key: str
    field_label: str
    is_statutory: bool = False
    reason: str


class DataBridgeSchemaDetectResponse(BaseModel):
    """Report containing detected column mappings and missing field validation."""
    entity_type: str
    columns: List[DataBridgeColumnMapping] = Field(default_factory=list)
    exact_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    ambiguous_count: int = 0
    unmapped_count: int = 0
    missing_required_fields: List[DataBridgeMissingField] = Field(default_factory=list)
    is_valid_for_import: bool = False
    analyzed_at: str


# ==============================================================================
# PHASE 8 THIRD-PARTY CONNECTOR FRAMEWORK CONTRACTS
# ==============================================================================

class DataBridgeConnectorType(str, Enum):
    """Supported third-party connector types."""
    TALLY_PRIME_XML = "TALLY_PRIME_XML"
    SHOPIFY_REST = "SHOPIFY_REST"
    SAP_B1_DIAPI = "SAP_B1_DIAPI"
    UNICOMMERCE_API = "UNICOMMERCE_API"
    CUSTOM_WEBHOOK = "CUSTOM_WEBHOOK"


class DataBridgeConnectorConfig(BaseModel):
    """Authentication and connection parameters for external connector."""
    connector_type: DataBridgeConnectorType
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    company_code: Optional[str] = None
    headers: Dict[str, str] = Field(default_factory=dict)
    extra_params: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeConnectorDescriptor(BaseModel):
    """Metadata describing a registered external connector."""
    connector_type: DataBridgeConnectorType
    name: str
    version: str
    description: str
    supported_entities: List[str]
    supports_pull: bool = True
    supports_push: bool = True
    config_schema: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeConnectorTestRequest(BaseModel):
    """Request to test connector credentials/reachability."""
    connector_type: DataBridgeConnectorType
    config: DataBridgeConnectorConfig


class DataBridgeConnectorTestResponse(BaseModel):
    """Result of connector test execution."""
    connector_type: str
    is_successful: bool
    status_message: str
    latency_ms: float
    tested_at: str
    details: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeConnectorPullRequest(BaseModel):
    """Request to pull and transform external records into canonical DataBridge rows."""
    connector_type: DataBridgeConnectorType
    entity_type: DataBridgeEntityType
    config: DataBridgeConnectorConfig
    params: Dict[str, Any] = Field(default_factory=dict)
    raw_payload: Optional[Union[str, Dict[str, Any], List[Dict[str, Any]]]] = Field(
        default=None, 
        description="Optional pre-fetched raw payload (e.g. XML text or JSON) to parse without network call"
    )


class DataBridgeConnectorPullResponse(BaseModel):
    """Result of connector pull and transformation."""
    connector_type: str
    entity_type: str
    total_records_pulled: int
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    pulled_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeConnectorPushRequest(BaseModel):
    """Request to format and push canonical records to external format/system."""
    connector_type: DataBridgeConnectorType
    entity_type: DataBridgeEntityType
    config: DataBridgeConnectorConfig
    records: List[Dict[str, Any]] = Field(..., min_length=1)
    params: Dict[str, Any] = Field(default_factory=dict)


class DataBridgeConnectorPushResponse(BaseModel):
    """Result of connector push / export transformation."""
    connector_type: str
    entity_type: str
    total_records_pushed: int
    payload_format: str  # "XML" | "JSON" | "HTTP_RESULT"
    result_payload: Optional[str] = None
    is_successful: bool = True
    pushed_at: str
    details: Dict[str, Any] = Field(default_factory=dict)
