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

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="ADAPTER", canonicalOwner="backend/app/services/identity/engine.py")

from .uuid7 import uuid7, is_valid_uuidv7
from .code_generator import IdentityCodeGenerator
from .validator import IdentityValidator, SMRITI_APPROVED_GROUPS
from .resolver import IdentityResolver, IdentityResolutionResult
from .engine import IdentityEngine

__all__ = [
    "uuid7",
    "is_valid_uuidv7",
    "IdentityCodeGenerator",
    "IdentityValidator",
    "SMRITI_APPROVED_GROUPS",
    "IdentityResolver",
    "IdentityResolutionResult",
    "IdentityEngine",
]
