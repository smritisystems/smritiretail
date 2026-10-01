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

from .contracts import BaseDocumentLifecycleHandler
from .registry import LifecycleRegistry, register_lifecycle_handler
from .context import (
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleStateResponse,
)
from .exceptions import (
    LifecycleException,
    DocumentNotFoundException,
    TenantIsolationException,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    ApprovalRequiredException,
    HandlerValidationException,
)
from .engine import UniversalLifecycleEngine

# Import handlers to trigger dynamic registration in LifecycleRegistry
from . import handlers  # noqa: F401

__all__ = [
    "UniversalLifecycleEngine",
    "BaseDocumentLifecycleHandler",
    "LifecycleRegistry",
    "register_lifecycle_handler",
    "LifecycleTransitionContext",
    "LifecycleTransitionResult",
    "LifecycleStateResponse",
    "LifecycleException",
    "DocumentNotFoundException",
    "TenantIsolationException",
    "ConcurrencyConflictException",
    "InvalidTransitionException",
    "PermissionDeniedException",
    "ApprovalRequiredException",
    "HandlerValidationException",
]
