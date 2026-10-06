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

from .service import DataBridgeService
from .exceptions import (
    DataBridgeError,
    DataBridgeEntitlementError,
    DataBridgeTenantIsolationError,
    DataBridgePermissionError,
    DataBridgeValidationError,
    DataBridgePayloadTooLargeError,
    DataBridgeBarcodeConflictError,
    DataBridgeIdempotencyError,
    DataBridgeCommitConfirmationError,
    DataBridgeStalePreviewError,
    DataBridgeDependencyError,
    DataBridgeAtomicRollbackError,
)
from .models import (
    DataBridgeStatusResponse,
    DataBridgeContractPingRequest,
    DataBridgeContractPingResponse,
    DataBridgeSecurityContext,
    DataBridgeReconciliationSummary,
    DataBridgeClassification,
    DataBridgeEntityType,
    DataBridgeDiff,
    DataBridgeDiffField,
    DataBridgeConflict,
    DataBridgeRow,
    DataBridgeResultItem,
    DataBridgeSummary,
    DataBridgePreviewRequest,
    DataBridgePreviewResponse,
    DataBridgeCommitRequest,
    DataBridgeCommitResponse,
    DataBridgeResult,
    DataBridgeAsyncJobStatus,
    DataBridgeAsyncSubmitRequest,
    DataBridgeAsyncJobResponse,
    DataBridgeJobStatusResponse,
    DataBridgeExportFormat,
    DataBridgeExportRequest,
    DataBridgeExportResponse,
    DataBridgeRollbackRequest,
    DataBridgeRollbackResponse,
    DataBridgeTenantTransferRequest,
    DataBridgeTenantTransferResponse,
    DataBridgeCandidateMatch,
    DataBridgeColumnMapping,
    DataBridgeSchemaDetectRequest,
    DataBridgeMissingField,
    DataBridgeSchemaDetectResponse,
)
from .async_engine import DataBridgeAsyncEngine
from .export_engine import DataBridgeExportEngine
from .migration_engine import DataBridgeMigrationToolkit
from .schema_mapping_engine import DataBridgeSchemaMapper
from .adapters import (
    BaseDataBridgeAdapter,
    DataBridgeItemAdapter,
    DataBridgeVariantAdapter,
    DataBridgeBarcodeAdapter,
    DataBridgePriceBookAdapter,
)

__all__ = [
    "DataBridgeService",
    "DataBridgeAsyncEngine",
    "DataBridgeExportEngine",
    "DataBridgeMigrationToolkit",
    "DataBridgeSchemaMapper",
    "DataBridgeExportFormat",
    "DataBridgeExportRequest",
    "DataBridgeExportResponse",
    "DataBridgeRollbackRequest",
    "DataBridgeRollbackResponse",
    "DataBridgeTenantTransferRequest",
    "DataBridgeTenantTransferResponse",
    "DataBridgeCandidateMatch",
    "DataBridgeColumnMapping",
    "DataBridgeSchemaDetectRequest",
    "DataBridgeMissingField",
    "DataBridgeSchemaDetectResponse",
    "DataBridgeError",
    "DataBridgeEntitlementError",
    "DataBridgeTenantIsolationError",
    "DataBridgePermissionError",
    "DataBridgeValidationError",
    "DataBridgePayloadTooLargeError",
    "DataBridgeBarcodeConflictError",
    "DataBridgeIdempotencyError",
    "DataBridgeCommitConfirmationError",
    "DataBridgeStalePreviewError",
    "DataBridgeDependencyError",
    "DataBridgeAtomicRollbackError",
    "DataBridgeStatusResponse",
    "DataBridgeContractPingRequest",
    "DataBridgeContractPingResponse",
    "DataBridgeSecurityContext",
    "DataBridgeReconciliationSummary",
    "DataBridgeClassification",
    "DataBridgeEntityType",
    "DataBridgeDiff",
    "DataBridgeDiffField",
    "DataBridgeConflict",
    "DataBridgeRow",
    "DataBridgeResultItem",
    "DataBridgeSummary",
    "DataBridgePreviewRequest",
    "DataBridgePreviewResponse",
    "DataBridgeCommitRequest",
    "DataBridgeCommitResponse",
    "DataBridgeResult",
    "BaseDataBridgeAdapter",
    "DataBridgeItemAdapter",
    "DataBridgeVariantAdapter",
    "DataBridgeBarcodeAdapter",
    "DataBridgePriceBookAdapter",
]

