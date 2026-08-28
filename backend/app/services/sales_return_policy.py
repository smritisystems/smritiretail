"""Sales Return policy resolution over the existing control-plane policies."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.governed_logic import PolicyDefinition


@dataclass(frozen=True)
class ResolvedSalesReturnPolicy:
    policy_id: Optional[str]
    policy_version: Optional[int]
    resolution_scope: str
    resolution_source: str
    values: Dict[str, Any]
    resolved_at: str


class SalesReturnPolicyResolver:
    """Reads versioned Sales Return policy inputs from the existing control plane."""

    POLICY_CODES = (
        "POLICY_BILLING_CONTROLS",
        "POLICY_GST_STANDARD",
    )

    def __init__(self, control_db: Optional[AsyncSession]):
        self.control_db = control_db

    async def resolve(self) -> ResolvedSalesReturnPolicy:
        values: Dict[str, Any] = {}
        policy_id: Optional[str] = None
        policy_version: Optional[int] = None
        sources = []

        if self.control_db is not None:
            result = await self.control_db.execute(
                select(PolicyDefinition)
                .where(
                    PolicyDefinition.code.in_(self.POLICY_CODES),
                    PolicyDefinition.is_active == True,
                    PolicyDefinition.is_deleted == False,
                )
                .order_by(PolicyDefinition.version.desc())
            )
            for policy in result.scalars().all():
                if policy.code not in sources:
                    values.update(policy.parameters or {})
                    sources.append(policy.code)
                    if policy_id is None:
                        policy_id = policy.id
                        policy_version = policy.version

        return ResolvedSalesReturnPolicy(
            policy_id=policy_id,
            policy_version=policy_version,
            resolution_scope="GLOBAL",
            resolution_source=",".join(sources) if sources else "UNRESOLVED",
            values=values,
            resolved_at=datetime.now(timezone.utc).isoformat(),
        )
