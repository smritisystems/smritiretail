"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, Dict, Any


class LifecycleException(Exception):
    """Base exception for all document lifecycle errors."""
    def __init__(self, message: str, status_code: int = 400, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class DocumentNotFoundException(LifecycleException):
    """Raised when the target document does not exist or is inaccessible."""
    def __init__(self, doc_type: str, doc_id: str):
        super().__init__(
            message=f"{doc_type} with ID '{doc_id}' not found.",
            status_code=404,
            details={"doc_type": doc_type, "doc_id": doc_id},
        )


class TenantIsolationException(LifecycleException):
    """Raised when cross-tenant access is attempted."""
    def __init__(
        self,
        message: str = "Access denied: Document belongs to a different tenant or organization.",
        doc_type: Optional[str] = None,
        doc_id: Optional[str] = None,
    ):
        details = {}
        if doc_type:
            details["doc_type"] = doc_type
        if doc_id:
            details["doc_id"] = doc_id
        super().__init__(message=message, status_code=404, details=details)


class ConcurrencyConflictException(LifecycleException):
    """Raised when expected_version does not match the active entity version (HTTP 409)."""
    def __init__(self, current_version: int, expected_version: int):
        super().__init__(
            message=(
                f"Document has been modified by another user (expected version {expected_version}, "
                f"current version {current_version}). Please refresh the page."
            ),
            status_code=409,
            details={"current_version": current_version, "expected_version": expected_version},
        )


class InvalidTransitionException(LifecycleException):
    """Raised when state machine transition is forbidden from the current state."""
    def __init__(self, current_state: str, action: str, allowed_actions: Optional[list] = None):
        allowed_str = f" Allowed actions: {', '.join(allowed_actions)}." if allowed_actions else ""
        super().__init__(
            message=f"Action '{action}' is not valid for current state '{current_state}'.{allowed_str}",
            status_code=400,
            details={"current_state": current_state, "action": action, "allowed_actions": allowed_actions or []},
        )


class PermissionDeniedException(LifecycleException):
    """Raised when the user lacks RBAC permissions for the transition action."""
    def __init__(self, action: str, doc_type: str, required: Optional[str] = None):
        req_msg = f" Requires: {required}." if required else ""
        super().__init__(
            message=f"Permission denied: User does not have authorization to perform '{action}' on '{doc_type}'.{req_msg}",
            status_code=403,
            details={"action": action, "doc_type": doc_type, "required": required},
        )


class ApprovalRequiredException(LifecycleException):
    """Raised when a financial transaction exceeds approval threshold requiring managerial authorization."""
    def __init__(self, policy_code: str, required_role: str, reason: str):
        super().__init__(
            message=f"Approval required: {reason}",
            status_code=403,
            details={"policy_code": policy_code, "required_role": required_role, "reason": reason},
        )


class HandlerValidationException(LifecycleException):
    """Raised when domain-specific pre-conditions in the handler fail."""
    def __init__(self, message: str, code_or_details: Optional[Any] = None):
        if isinstance(code_or_details, str):
            self.code = code_or_details
            details = {"code": code_or_details}
        elif isinstance(code_or_details, dict):
            self.code = code_or_details.get("code")
            details = code_or_details
        else:
            self.code = None
            details = {}
        super().__init__(message=message, status_code=400, details=details)
