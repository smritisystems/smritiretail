"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.11.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any

SMRITI_ERROR_CATALOG: Dict[str, Dict[str, Any]] = {
    "VAL-001": {
        "code": "VAL-001",
        "category": "VALIDATION",
        "meaning": "Required request payload field missing or schema validation failed.",
        "http_status": 400,
        "is_retryable": False,
    },
    "AUTH-101": {
        "code": "AUTH-101",
        "category": "AUTHENTICATION",
        "meaning": "Invalid, expired, or malformed authentication credentials.",
        "http_status": 401,
        "is_retryable": False,
    },
    "AUTH-102": {
        "code": "AUTH-102",
        "category": "AUTHORIZATION",
        "meaning": "Insufficient permissions to access the requested resource.",
        "http_status": 403,
        "is_retryable": False,
    },
    "DB-205": {
        "code": "DB-205",
        "category": "DATABASE",
        "meaning": "Database transaction deadlock, query timeout, or lock conflict.",
        "http_status": 500,
        "is_retryable": True,
    },
    "NET-301": {
        "code": "NET-301",
        "category": "NETWORK",
        "meaning": "External dependency service host unreachable or HTTP timeout.",
        "http_status": 502,
        "is_retryable": True,
    },
    "BUS-501": {
        "code": "BUS-501",
        "category": "BUSINESS_RULE",
        "meaning": "Core business workflow or domain constraint violation.",
        "http_status": 422,
        "is_retryable": False,
    },
    "SYS-999": {
        "code": "SYS-999",
        "category": "SYSTEM",
        "meaning": "Unhandled application exception or server-side crash.",
        "http_status": 500,
        "is_retryable": True,
    },
}
