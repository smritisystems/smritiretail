"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.14.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import datetime
import hashlib

from pydantic import BaseModel


class SmritiErrorDetail(BaseModel):
    title: str
    explanation: str
    suggested_action: str
    reference_id: str
    error_code: str


class SmritiErrorResponse(BaseModel):
    detail: str
    error: SmritiErrorDetail


# Standard Error Dictionary
ERROR_DICTIONARY = {
    "SMRITI-VAL-001": {
        "title": "Validation Failed",
        "explanation": "One or more inputs did not meet the business requirements.",
        "suggested_action": "Please check the highlighted fields and correct the inputs.",
    },
    "SMRITI-AUTH-001": {
        "title": "Authentication Required",
        "explanation": "You must login first to access this resource.",
        "suggested_action": "Please verify your credentials or login session.",
    },
    "SMRITI-PERM-001": {
        "title": "Access Denied",
        "explanation": "Your user account does not have the required permissions to perform this operation.",
        "suggested_action": "Please contact your system administrator to request access.",
    },
    "SMRITI-DATA-001": {
        "title": "Data Conflict",
        "explanation": (
            "The operation could not be completed because it conflicts with "
            "existing business data or references a missing item."
        ),
        "suggested_action": "Please verify the information (e.g. code, barcode, or ID) is unique and correct.",
    },
    "SMRITI-CONN-001": {
        "title": "Connection Failed",
        "explanation": (
            "A connection error occurred while communicating with database "
            "or upstream integration services."
        ),
        "suggested_action": "Please check if system network and background services are active.",
    },
    "SMRITI-NET-001": {
        "title": "Service Unavailable",
        "explanation": "The server encountered a problem or is temporarily unable to process your request.",
        "suggested_action": "Please check your network connection or try again in a few minutes.",
    },
    "SMRITI-CFG-001": {
        "title": "Configuration Error",
        "explanation": "System configuration parameters are missing or incorrect.",
        "suggested_action": "Please contact system administrator to review the env settings.",
    },
    "SMRITI-SYS-001": {
        "title": "System Error",
        "explanation": "An unexpected error occurred in our system.",
        "suggested_action": "Please note the Reference ID and contact customer support.",
    },
    "SMRITI-INT-001": {
        "title": "Integration Fault",
        "explanation": "An integration with government, banking, or third-party service failed.",
        "suggested_action": "Please verify target gateway status and try again later.",
    },
}


def generate_reference_id(error_msg: str) -> str:
    """Generates a reference ID matching SMRITI-ERR-YYYYMMDD-XXXXXX format."""
    date_part = datetime.date.today().strftime("%Y%m%d")
    hash_part = hashlib.md5(error_msg.encode("utf-8")).hexdigest()[:6].upper()
    return f"SMRITI-ERR-{date_part}-{hash_part}"


def build_error_response(
    error_code: str,
    custom_explanation: str | None = None,
    custom_action: str | None = None,
    reference_msg: str = "",
    custom_title: str | None = None,
) -> SmritiErrorResponse:
    """Helper to build a standardized human-readable error response."""
    dict_entry = ERROR_DICTIONARY.get(error_code, ERROR_DICTIONARY["SMRITI-SYS-001"])
    ref_id = generate_reference_id(reference_msg or dict_entry["title"])
    
    explanation = custom_explanation or dict_entry["explanation"]
    # Avoid technical words in the explanation
    technical_words = ["SQL", "API", "repository", "exception", "traceback", "object", "attribute", "stack", "json"]
    for word in technical_words:
        if word in explanation.lower():
            # Replace technical phrasing with business-friendly ones
            explanation = explanation.replace(word, "system")
            explanation = explanation.replace(word.capitalize(), "System")
            explanation = explanation.replace(word.upper(), "SYSTEM")

    return SmritiErrorResponse(
        detail=explanation,
        error=SmritiErrorDetail(
            title=custom_title or dict_entry["title"],
            explanation=explanation,
            suggested_action=custom_action or dict_entry["suggested_action"],
            reference_id=ref_id,
            error_code=error_code,
        )
    )
