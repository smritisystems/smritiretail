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

from typing import Optional, Dict, Any


class DataBridgeError(Exception):
    """Base exception for all SMRITI DataBridge operations."""

    def __init__(self, message: str, code: str = "SMRITI-DBRIDGE-001", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class DataBridgeEntitlementError(DataBridgeError):
    """Raised when tenant capability is disabled or unactivated."""

    def __init__(self, capability_code: str = "DATABRIDGE", message: Optional[str] = None):
        msg = message or f"SMRITI-CAP-001: The SMRITI DataBridge capability '{capability_code}' is not activated for this company."
        super().__init__(msg, code="SMRITI-CAP-001", details={"capability_code": capability_code})


class DataBridgeTenantIsolationError(DataBridgeError):
    """Raised when an operation attempts cross-tenant boundary breach or business write to smritisys."""

    def __init__(self, message: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        msg = message or "SMRITI-TENANT-001: Routing invariant violated: business data operations cannot execute against control-plane database."
        super().__init__(msg, code="SMRITI-TENANT-001", details=details)


class DataBridgePermissionError(DataBridgeError):
    """Raised when user lacks required granular privilege for DataBridge operation."""

    def __init__(self, action: str, resource: str = "databridge"):
        msg = f"SMRITI-AUTH-001: Permission denied for operation '{action}' on resource '{resource}'."
        super().__init__(msg, code="SMRITI-AUTH-001", details={"action": action, "resource": resource})


class DataBridgeValidationError(DataBridgeError):
    """Raised when payload or record structure fails deterministic schema validation."""

    def __init__(self, message: str, row_index: Optional[int] = None, field: Optional[str] = None):
        super().__init__(message, code="SMRITI-VAL-001", details={"row_index": row_index, "field": field})


class DataBridgePayloadTooLargeError(DataBridgeError):
    """Raised when a synchronous payload exceeds maximum row or byte thresholds."""

    def __init__(self, current_size: int, max_size: int):
        msg = f"SMRITI-LIMIT-001: Payload size ({current_size}) exceeds synchronous execution limit ({max_size}). Must use asynchronous outbox submission."
        super().__init__(msg, code="SMRITI-LIMIT-001", details={"current_size": current_size, "max_size": max_size})


class DataBridgeBarcodeConflictError(DataBridgeError):
    """Raised when an import attempts to overwrite an immutable barcode with a mismatched SKU."""

    def __init__(self, barcode: str, existing_sku: str, incoming_sku: str):
        msg = f"SMRITI-BARCODE-001: EXISTING_CONFLICT — Barcode '{barcode}' is already bound to SKU '{existing_sku}'. Cannot reassign to '{incoming_sku}'."
        super().__init__(msg, code="SMRITI-BARCODE-001", details={"barcode": barcode, "existing_sku": existing_sku, "incoming_sku": incoming_sku})


class DataBridgeIdempotencyError(DataBridgeError):
    """Raised when idempotency key conflict occurs."""

    def __init__(self, idempotency_key: str, existing_hash: str):
        msg = f"SMRITI-IDEMP-001: Idempotency conflict for key '{idempotency_key}'."
        super().__init__(msg, code="SMRITI-IDEMP-001", details={"idempotency_key": idempotency_key, "existing_hash": existing_hash})


class DataBridgeCommitConfirmationError(DataBridgeError):
    """Raised when a commit request is submitted without explicit user confirmation."""

    def __init__(self, message: Optional[str] = None):
        msg = message or "SMRITI-CONFIRM-001: DataBridge commit rejected: explicit user confirmation ('confirmed': true) is mandatory."
        super().__init__(msg, code="SMRITI-CONFIRM-001")


class DataBridgeStalePreviewError(DataBridgeError):
    """Raised when commit token is expired, tampered, or state drifted after preview."""

    def __init__(self, message: Optional[str] = None):
        msg = message or "SMRITI-STALE-001: DataBridge commit rejected: preview token is invalid, expired, or underlying database state has changed."
        super().__init__(msg, code="SMRITI-STALE-001")


class DataBridgeDependencyError(DataBridgeError):
    """Raised when a child entity lacks a valid parent or dependent entity."""

    def __init__(self, message: str, parent_identifier: Optional[str] = None):
        msg = f"SMRITI-DEP-001: DEPENDENCY_ERROR — {message}"
        super().__init__(msg, code="SMRITI-DEP-001", details={"parent_identifier": parent_identifier})


class DataBridgeAtomicRollbackError(DataBridgeError):
    """Raised when an atomic batch is rolled back due to one or more blocking conflicts."""

    def __init__(self, blocking_reasons: list):
        msg = f"SMRITI-ATOMIC-001: Transaction aborted: {len(blocking_reasons)} blocking conflict(s) detected. All operations rolled back."
        super().__init__(msg, code="SMRITI-ATOMIC-001", details={"blocking_reasons": blocking_reasons})

