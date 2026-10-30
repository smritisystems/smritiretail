"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Framework
"""

from typing import Callable, Any, Optional, Dict
from functools import wraps

REGISTERED_CAPABILITIES: Dict[str, Dict[str, Any]] = {}


def smriti_capability(
    entity: str,
    capability: str,
    role: str = "CANONICAL",
    description: str = "",
    canonical_owner: Optional[str] = None,
    decision_id: Optional[str] = None,
) -> Callable:
    """
    Decorator for FastAPI routers, backend services, or domain models
    declaring architectural responsibility for AST and reflection scanners.
    """
    def decorator(target: Any) -> Any:
        meta = {
            "entity": entity,
            "capability": capability,
            "role": role,
            "description": description,
            "canonical_owner": canonical_owner,
            "decision_id": decision_id,
            "target_name": getattr(target, "__name__", str(target)),
            "target_module": getattr(target, "__module__", ""),
        }
        setattr(target, "__smriti_capability__", meta)
        key = f"{entity}:{capability}:{role}"
        REGISTERED_CAPABILITIES[key] = meta
        return target

    return decorator
