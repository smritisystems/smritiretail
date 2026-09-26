"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Architecture Contract

SMRITI Seed Ownership Contract (TDB-v2.0)
==========================================
Every seed function MUST be decorated with @seed_contract(target="...")
to declare its database ownership at definition time.

This replaces ad-hoc guards (RuntimeError inside each seed function) with a
uniform, inspectable, testable contract — enforced by the @seed_contract
decorator at call time, and verified by the CI guard at static analysis time.

Usage:

    from app.db.seed_contract import seed_contract

    @seed_contract(target="control")
    def seed_platform_capabilities(database_name: str) -> None:
        ...

    @seed_contract(target="tenant")
    def seed_customers(database_name: str) -> None:
        ...

    @seed_contract(target="shared")
    def seed_reference_data(database_name: str) -> None:
        ...

Rules enforced by the decorator:
    control → raises SeedBoundaryViolation if database_name != "smritisys"
    tenant  → raises SeedBoundaryViolation if database_name == "smritisys"
    shared  → always passes (runs in all databases)
"""

import functools
import logging
from typing import Literal, Callable, TypeVar, Any

logger = logging.getLogger("smriti.seed_contract")

SEED_TARGET = Literal["control", "tenant", "shared"]


class SeedBoundaryViolation(RuntimeError):
    """
    Raised when a seed function is called against a database
    that violates the declared ownership contract.
    """
    def __init__(self, seed_name: str, target: SEED_TARGET, actual_db: str, reason: str):
        self.seed_name = seed_name
        self.target = target
        self.actual_db = actual_db
        self.reason = reason
        super().__init__(
            f"SEED BOUNDARY VIOLATION — {seed_name}\n"
            f"  Declared target : {target}\n"
            f"  Called against  : {actual_db}\n"
            f"  Reason          : {reason}\n"
            f"  TDB-v2.0 Policy : smritisys = Control Plane ONLY. "
            f"No tenant operational data may be seeded into the Control Plane, "
            f"and no Control Plane governance may be seeded into tenant databases."
        )


F = TypeVar("F", bound=Callable[..., Any])


def seed_contract(target: SEED_TARGET) -> Callable[[F], F]:
    """
    Decorator factory that declares and enforces a seed function's ownership.

    Args:
        target: "control" | "tenant" | "shared"

    Returns:
        A wrapped function that validates the database_name argument before
        delegating to the original seed function.

    The wrapped function exposes:
        fn.__seed_target__: str   — the declared target ("control"|"tenant"|"shared")

    These attributes are used by:
        - CI guard (ci_tenant_boundary_guard.py) for static inspection
        - Test suite (test_tenant_data_boundary.py) for contract verification
    """
    if target not in ("control", "tenant", "shared"):
        raise ValueError(
            f"@seed_contract(target=...) must be 'control', 'tenant', or 'shared'. Got: {target!r}"
        )

    def decorator(fn: F) -> F:
        fn_name = getattr(fn, "__qualname__", fn.__name__)

        @functools.wraps(fn)
        def wrapper(database_name: str, *args: Any, **kwargs: Any) -> Any:
            db = str(database_name).strip().lower() if database_name else ""

            if not db:
                raise SeedBoundaryViolation(
                    seed_name=fn_name,
                    target=target,
                    actual_db="(empty)",
                    reason=(
                        "database_name is required. Seed functions must be called with an "
                        "explicit target database. Fail-closed: no silent fallback."
                    )
                )

            if target == "control" and db != "smritisys":
                raise SeedBoundaryViolation(
                    seed_name=fn_name,
                    target=target,
                    actual_db=db,
                    reason=(
                        f"This seed function declares target='control'. "
                        f"Control Plane seeds must only run against 'smritisys'. "
                        f"Called with '{db}'."
                    )
                )

            if target == "tenant" and db == "smritisys":
                raise SeedBoundaryViolation(
                    seed_name=fn_name,
                    target=target,
                    actual_db=db,
                    reason=(
                        f"This seed function declares target='tenant'. "
                        f"Tenant operational data MUST NOT be seeded into smritisys (Control Plane). "
                        f"TDB-v2.0 Policy violation."
                    )
                )

            # shared: no restriction — runs in all databases
            logger.debug(
                "[SeedContract] %s | target=%s | db=%s | ALLOWED",
                fn_name, target, db
            )
            return fn(database_name, *args, **kwargs)

        # Expose metadata for static inspection
        wrapper.__seed_target__ = target          # type: ignore[attr-defined]
        wrapper.__seed_fn_name__ = fn_name        # type: ignore[attr-defined]
        wrapper.__wrapped__ = fn                  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return decorator
