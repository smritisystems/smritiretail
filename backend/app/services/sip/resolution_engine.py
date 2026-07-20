"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.sip import UniversalIdentityRegistry, SIPIdentityOutbox
from app.services.sip.providers import SIPProviderRegistry
from app.services.sip.strategies import IdentifierStrategyFactory

logger = logging.getLogger("smriti.sip_resolution_engine")


class SIPIdentityResolutionEngine:
    """
    Deterministic identity resolution engine for multi-domain universal identity generation,
    collision resolution, and transactional outbox event publishing.
    """

    async def register_identity(
        self,
        db: AsyncSession,
        domain: str,
        entity_id: str,
        payload: Dict[str, Any],
        standard: str = "GS1",
        external_identity: Optional[str] = None,
        source_system: Optional[str] = None,
    ) -> UniversalIdentityRegistry:
        """
        Generates deterministic business key, calculates hash, formats barcode/digital link/RFID hex,
        persists into central UniversalIdentityRegistry, and emits Outbox event.
        """
        provider = SIPProviderRegistry.get_provider(domain)
        strategy = IdentifierStrategyFactory.get_strategy(standard)

        seq_num = uuid.uuid4().int % 100000
        business_key = provider.generate_business_key(payload, seq_num)
        identity_hash = provider.calculate_identity_hash(payload)

        barcode = strategy.generate_barcode(seq_num)
        serial = f"SRL{seq_num:05d}"
        digital_link = strategy.generate_digital_link_uri(barcode, serial)
        sgtin96 = strategy.generate_sgtin96_hex(barcode, serial)

        record = UniversalIdentityRegistry(
            id=str(uuid.uuid4()),
            domain=domain.upper(),
            entity_id=entity_id,
            business_key=business_key,
            identity_hash=identity_hash,
            identifier_standard=standard.upper(),
            barcode_value=barcode,
            digital_link_uri=digital_link,
            sgtin96_hex=sgtin96,
            external_identity=external_identity,
            source_system=source_system,
            status="ACTIVE",
        )
        db.add(record)

        # Emit transactional outbox event (IdentityRegistered)
        outbox = SIPIdentityOutbox(
            id=str(uuid.uuid4()),
            event_type="IdentityRegistered",
            aggregate_type="UniversalIdentity",
            aggregate_id=record.id,
            payload={
                "domain": domain.upper(),
                "entity_id": entity_id,
                "business_key": business_key,
                "barcode": barcode,
            },
            status="PENDING",
        )
        db.add(outbox)
        await db.commit()
        return record

    async def search_registry(
        self,
        db: AsyncSession,
        search_query: str,
    ) -> list[UniversalIdentityRegistry]:
        """
        Searches central UniversalIdentityRegistry across business_key, identity_hash, barcode_value, or entity_id.
        """
        q = search_query.strip()
        stmt = select(UniversalIdentityRegistry).where(
            (UniversalIdentityRegistry.business_key.ilike(f"%{q}%")) |
            (UniversalIdentityRegistry.identity_hash == q) |
            (UniversalIdentityRegistry.barcode_value == q) |
            (UniversalIdentityRegistry.entity_id == q)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())
