"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Architecture Contract

SMRITI Migration Target Contract (TDB-v2.0)
══════════════════════════════════════════
Alembic migrations must declare their target database scope:
    - "control" : Migration applies ONLY to smritisys (Control Plane)
    - "tenant"  : Migration applies ONLY to tenant databases (smriti001, etc.)
    - "both"    : Migration applies to ALL databases (shared reference / common schema)

This decorator attaches metadata to migration functions (upgrade/downgrade)
and provides runtime assertion helpers to prevent executing migrations against
the wrong database target.
"""

import functools
import logging
from typing import Literal, Callable, TypeVar, Any

logger = logging.getLogger("smriti.migration_contract")

MIGRATION_TARGET = Literal["control", "tenant", "both"]


class MigrationBoundaryViolation(RuntimeError):
    """Raised when an Alembic migration is executed against an unauthorized database."""
    def __init__(self, target: str, actual_db: str, reason: str):
        self.target = target
        self.actual_db = actual_db
        self.reason = reason
        super().__init__(
            f"MIGRATION BOUNDARY VIOLATION\n"
            f"  Declared Target : {target}\n"
            f"  Actual Database : {actual_db}\n"
            f"  Reason          : {reason}\n"
            f"  TDB-v2.0 Policy : smritisys = Control Plane ONLY. "
            f"Tenant operational migrations MUST NOT run on smritisys."
        )


F = TypeVar("F", bound=Callable[..., Any])


def migration_target(target: MIGRATION_TARGET) -> Callable[[F], F]:
    """
    Decorator for Alembic migration upgrade/downgrade functions.
    Declares the intended database target and tags the function for static CI inspection.

    Args:
        target: "control" | "tenant" | "both"
    """
    if target not in ("control", "tenant", "both"):
        raise ValueError(
            f"@migration_target(target=...) must be 'control', 'tenant', or 'both'. Got: {target!r}"
        )

    def decorator(fn: F) -> F:
        fn_name = getattr(fn, "__qualname__", fn.__name__)

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            return fn(*args, **kwargs)

        wrapper.__migration_target__ = target      # type: ignore[attr-defined]
        wrapper.__migration_fn_name__ = fn_name    # type: ignore[attr-defined]
        wrapper.__wrapped__ = fn                   # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return decorator


def validate_migration_execution(target: MIGRATION_TARGET, actual_db: str) -> None:
    """
    Validates whether a migration with the declared target may run against actual_db.
    Fails closed if the boundary is violated.
    """
    db = str(actual_db).strip().lower() if actual_db else ""
    if not db:
        raise MigrationBoundaryViolation(
            target=target,
            actual_db="(empty)",
            reason="Database name is required for migration execution."
        )

    if target == "control" and db != "smritisys":
        raise MigrationBoundaryViolation(
            target=target,
            actual_db=db,
            reason=f"Control plane migrations (target='control') must ONLY run against 'smritisys'."
        )

    if target == "tenant" and db == "smritisys":
        raise MigrationBoundaryViolation(
            target=target,
            actual_db=db,
            reason="Tenant operational migrations (target='tenant') MUST NOT run against 'smritisys'."
        )
