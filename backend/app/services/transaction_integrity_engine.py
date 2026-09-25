"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Transaction Integrity Engine (STIE)
Capability   : @SmritiCapability("TRANSACTION_INTEGRITY", "STIE_CORE_ENGINE")
"""

import hashlib
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, Dict, Any, Union, List

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.transaction_integrity import TransactionIdempotencyRecord

logger = logging.getLogger("smriti.stie")


def _json_serial(obj: Any) -> Any:
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    raise TypeError(f"Type {type(obj)} not serializable")


def canonicalize_payload(payload: Any) -> str:
    """Produce a canonical, deterministically sorted JSON string of a payload."""
    if payload is None:
        return ""
    if isinstance(payload, BaseModel):
        data = payload.model_dump(mode="json")
    elif isinstance(payload, dict):
        data = payload
    else:
        try:
            data = json.loads(json.dumps(payload, default=_json_serial))
        except Exception:
            data = str(payload)

    # Filter out client-ephemeral fields that should not alter business idempotency
    if isinstance(data, dict):
        ephemeral_keys = {"timestamp", "client_request_time", "nonce"}
        filtered = {k: v for k, v in data.items() if k not in ephemeral_keys}
        return json.dumps(filtered, sort_keys=True, default=_json_serial)
    
    return json.dumps(data, sort_keys=True, default=_json_serial)


def compute_payload_hash(payload: Any) -> str:
    """Compute SHA-256 hash of canonicalized request payload."""
    canon = canonicalize_payload(payload)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


class IntegrityGuard:
    """
    Context guard object managed by TransactionIntegrityEngine.
    """
    def __init__(
        self,
        session: AsyncSession,
        company_id: str,
        entity_type: str,
        idempotency_key: Optional[str],
        business_key: Optional[str],
        request_hash: str,
        record: Optional[TransactionIdempotencyRecord] = None,
        is_replayed: bool = False,
        replayed_response: Optional[Any] = None,
    ):
        self.session = session
        self.company_id = company_id
        self.entity_type = entity_type
        self.idempotency_key = idempotency_key
        self.business_key = business_key
        self.request_hash = request_hash
        self.record = record
        self.is_replayed = is_replayed
        self.replayed_response = replayed_response
        self._completed = False

    def complete(
        self,
        document_id: str,
        document_no: Optional[str] = None,
        response_payload: Optional[Any] = None,
    ) -> None:
        """Mark the transaction completed with resulting identifiers and payload."""
        self._completed = True
        if self.record:
            self.record.status = "COMMITTED"
            self.record.document_id = str(document_id)
            self.record.document_no = str(document_no) if document_no else None
            if response_payload is not None:
                try:
                    if isinstance(response_payload, BaseModel):
                        self.record.response_payload = response_payload.model_dump(mode="json")
                    elif isinstance(response_payload, dict):
                        self.record.response_payload = json.loads(json.dumps(response_payload, default=_json_serial))
                    else:
                        self.record.response_payload = {"result": str(response_payload)}
                except Exception as e:
                    logger.warning("Could not serialize response_payload for idempotency record: %s", e)
                    self.record.response_payload = {"document_id": str(document_id), "document_no": str(document_no)}
            self.record.completed_at = datetime.now(timezone.utc)
            self.session.add(self.record)


class TransactionIntegrityEngine:
    """
    SMRITI Transaction Integrity Engine (STIE)
    Sole authoritative transactional gatekeeper enforcing:
      1. Universal Idempotency: Duplicate submissions return cached result; payload divergence returns 409.
      2. Concurrency Protection: PostgreSQL transaction advisory locks + row locks + SQLSTATE 23505 interception.
      3. Transaction Atomicity: All-or-nothing mutations, zero partial movements, clean rollback on error.
      4. Movement & Ledger Integrity: Append-only immutability, exact stock movement parity.
    """

    @classmethod
    async def try_acquire_advisory_lock(
        cls,
        session: AsyncSession,
        company_id: str,
        entity_type: str,
        lock_identifier: str,
    ) -> bool:
        """
        Attempts to acquire a PostgreSQL transaction-level advisory lock.
        Automatically released when the current database transaction completes (commit or rollback).
        """
        raw_key = f"{company_id}:{entity_type}:{lock_identifier}"
        # pg_try_advisory_xact_lock with hashtext (32-bit integer)
        query = text("SELECT pg_try_advisory_xact_lock(hashtext(:key)) AS acquired")
        result = await session.execute(query, {"key": raw_key})
        row = result.mappings().first()
        acquired = bool(row["acquired"]) if row else False
        if not acquired:
            logger.warning(
                "STIE Concurrency Lock Rejected: key='%s' held by another active transaction",
                raw_key,
            )
        return acquired

    @classmethod
    @asynccontextmanager
    async def guard(
        cls,
        session: AsyncSession,
        company_id: str,
        entity_type: str,
        idempotency_key: Optional[str] = None,
        business_key: Optional[str] = None,
        request_payload: Optional[Any] = None,
        branch_id: Optional[str] = None,
        user_id: Optional[str] = None,
        commit: bool = True,
    ):
        """
        Context manager providing universal idempotency, concurrency locking,
        and transaction atomicity for any mutating business transaction.
        """
        if not company_id:
            raise HTTPException(status_code=400, detail="SMRITI-INTEG-001: Company context required for transaction integrity.")

        # Clean/normalize keys
        clean_idemp_key = str(idempotency_key).strip() if idempotency_key else None
        clean_biz_key = str(business_key).strip() if business_key else None
        req_hash = compute_payload_hash(request_payload)

        # 1. Concurrency Advisory Locking
        # Lock on explicit idempotency key or business key (e.g. order_no, invoice_no, return_no)
        lock_key = clean_idemp_key or clean_biz_key or req_hash
        acquired = await cls.try_acquire_advisory_lock(
            session=session,
            company_id=company_id,
            entity_type=entity_type,
            lock_identifier=lock_key,
        )
        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"SMRITI-CONC-001: Concurrent execution locked for {entity_type} '{clean_biz_key or clean_idemp_key or 'REQUEST'}'. Another transaction is actively in progress.",
            )

        # 2. Idempotency Check & In-Flight Registration
        idemp_record: Optional[TransactionIdempotencyRecord] = None
        if clean_idemp_key:
            stmt = select(TransactionIdempotencyRecord).where(
                TransactionIdempotencyRecord.company_id == company_id,
                TransactionIdempotencyRecord.entity_type == entity_type,
                TransactionIdempotencyRecord.idempotency_key == clean_idemp_key,
            )
            existing = (await session.execute(stmt)).scalars().first()
            if existing:
                if existing.status == "COMMITTED":
                    # Check fingerprint
                    if existing.request_hash == req_hash:
                        logger.info(
                            "STIE Idempotent Replay: %s key '%s' previously committed as doc '%s'",
                            entity_type,
                            clean_idemp_key,
                            existing.document_no or existing.document_id,
                        )
                        guard_obj = IntegrityGuard(
                            session=session,
                            company_id=company_id,
                            entity_type=entity_type,
                            idempotency_key=clean_idemp_key,
                            business_key=clean_biz_key,
                            request_hash=req_hash,
                            record=existing,
                            is_replayed=True,
                            replayed_response=existing.response_payload,
                        )
                        yield guard_obj
                        return
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"SMRITI-IDEMP-001: Idempotency key collision. Key '{clean_idemp_key}' was previously committed with a different request fingerprint.",
                        )
                elif existing.status == "IN_FLIGHT":
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"SMRITI-IDEMP-002: Concurrent transaction in progress for idempotency key '{clean_idemp_key}'. Please wait or retry.",
                    )

            # Insert in-flight record
            record_id = f"tx_idemp_{uuid.uuid4().hex[:16]}"
            idemp_record = TransactionIdempotencyRecord(
                id=record_id,
                company_id=company_id,
                branch_id=branch_id,
                entity_type=entity_type,
                idempotency_key=clean_idemp_key,
                request_hash=req_hash,
                status="IN_FLIGHT",
                created_by=user_id,
            )
            session.add(idemp_record)
            try:
                await session.flush()
            except IntegrityError as exc:
                await session.rollback()
                logger.warning("STIE In-flight insertion collision: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"SMRITI-CONC-002: Concurrent transaction collision on idempotency key '{clean_idemp_key}'.",
                )

        guard_obj = IntegrityGuard(
            session=session,
            company_id=company_id,
            entity_type=entity_type,
            idempotency_key=clean_idemp_key,
            business_key=clean_biz_key,
            request_hash=req_hash,
            record=idemp_record,
            is_replayed=False,
        )

        try:
            yield guard_obj

            # If execution reached here without error, commit or flush
            if commit:
                await session.commit()
            else:
                await session.flush()

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as exc:
            await session.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            logger.error("STIE Integrity Error during %s: %s", entity_type, err_msg)
            # Map SQLSTATE 23505 to clean HTTP 409
            if "23505" in err_msg or "unique" in err_msg.lower() or "duplicate" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"SMRITI-DATA-001: Duplicate business record detected. A {entity_type.replace('_', ' ').lower()} with document number '{clean_biz_key or 'specified'}' already exists under this tenant.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SMRITI-DATA-002: Database constraint violation during {entity_type.lower()}: {err_msg[:200]}",
            )
        except Exception as exc:
            await session.rollback()
            logger.error("STIE Unhandled Error during %s: %s", entity_type, exc, exc_info=True)
            raise
