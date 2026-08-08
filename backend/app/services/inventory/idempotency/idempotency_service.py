"""
Platform Idempotency Engine (idempotency/idempotency_service.py)
Shared platform-wide deduplication and replay protection service.
Supports POS offline sync, Marketplace retries (Shopify/Amazon), and API gateways.
"""

from datetime import datetime, timezone
import hashlib
import json
from typing import Optional, Dict, Any, Tuple
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory_kernel import PlatformIdempotencyRecord


class PlatformIdempotencyService:
    """
    Platform-Wide Idempotency & Replay Protection Engine.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    @staticmethod
    def compute_request_hash(data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    async def get_existing_response(
        self,
        idempotency_key: str,
    ) -> Optional[Dict[str, Any]]:
        stmt = select(PlatformIdempotencyRecord).where(
            PlatformIdempotencyRecord.idempotency_key == idempotency_key,
            PlatformIdempotencyRecord.company_id == self.tenant_ctx.company_id,
        )
        res = await self.db.execute(stmt)
        record = res.scalars().first()
        if record and record.status == "COMPLETED":
            return record.response_payload
        return None

    async def register_execution(
        self,
        idempotency_key: str,
        request_data: Dict[str, Any],
        response_payload: Dict[str, Any],
        source_system: str = "API_GATEWAY",
        correlation_id: Optional[str] = None,
        external_reference: Optional[str] = None,
    ) -> PlatformIdempotencyRecord:
        request_hash = self.compute_request_hash(request_data)
        record = PlatformIdempotencyRecord(
            id=f"IDM-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            source_system=source_system,
            correlation_id=correlation_id,
            external_reference=external_reference,
            response_payload=response_payload,
            status="COMPLETED",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(record)
        await self.db.flush()
        return record
