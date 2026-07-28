"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Statutory Accounting Core Layer - MCA Mandatory Immutable Audit Trail Engine
Conforms to Companies (Accounts) Amendment Rules, Notification G.S.R. 235(E) (Audit Trail Rule).

Mandates:
1. Every financial transaction edit, posting, cancellation, or modification must generate an audit record.
2. Cryptographic SHA-256 hash chaining guarantees tamper-evident immutability:
   Hash_N = SHA256(Hash_{N-1} + Sequence + Timestamp + EntityType + EntityID + UserID + Action + Payload)
3. Direct database tampering breaks the hash chain, detected by `verify_chain_integrity()`.
"""

import hashlib
import json
import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple, Any

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


class AuditAction(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    POST = "POST"
    CANCEL = "CANCEL"
    VOID = "VOID"


@dataclass
class AuditTrailEntry:
    sequence: int
    entity_type: str
    entity_id: str
    user_id: str
    action: AuditAction
    payload: Dict[str, Any]
    timestamp: str
    previous_hash: str
    entry_hash: str


class ImmutableAuditLedger:
    """
    SHA-256 Hash-Chained Cryptographic Audit Trail Engine for Statutory Accounting Compliance.
    """

    def __init__(self):
        self._chain: List[AuditTrailEntry] = []

    def _compute_hash(
        self,
        previous_hash: str,
        sequence: int,
        timestamp: str,
        entity_type: str,
        entity_id: str,
        user_id: str,
        action: str,
        payload: Dict[str, Any],
    ) -> str:
        payload_json = json.dumps(payload, sort_keys=True, str=str)
        raw = f"{previous_hash}|{sequence}|{timestamp}|{entity_type}|{entity_id}|{user_id}|{action}|{payload_json}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def append_entry(
        self,
        entity_type: str,
        entity_id: str,
        user_id: str,
        action: AuditAction,
        payload: Dict[str, Any],
        timestamp: Optional[str] = None,
    ) -> AuditTrailEntry:
        sequence = len(self._chain) + 1
        previous_hash = self._chain[-1].entry_hash if self._chain else GENESIS_HASH
        timestamp_str = timestamp or datetime.datetime.now().isoformat()

        entry_hash = self._compute_hash(
            previous_hash=previous_hash,
            sequence=sequence,
            timestamp=timestamp_str,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            action=action.value if isinstance(action, AuditAction) else str(action),
            payload=payload,
        )

        entry = AuditTrailEntry(
            sequence=sequence,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            action=action if isinstance(action, AuditAction) else AuditAction(action),
            payload=payload,
            timestamp=timestamp_str,
            previous_hash=previous_hash,
            entry_hash=entry_hash,
        )
        self._chain.append(entry)
        return entry

    def verify_chain_integrity(self) -> Tuple[bool, Optional[int]]:
        """
        Traverse the entire audit chain and verify cryptographic hash continuity.

        Returns:
            Tuple (is_valid: bool, tampered_sequence_number: Optional[int])
        """
        for i, entry in enumerate(self._chain):
            expected_prev_hash = GENESIS_HASH if i == 0 else self._chain[i - 1].entry_hash

            if entry.previous_hash != expected_prev_hash:
                return False, entry.sequence

            recalculated_hash = self._compute_hash(
                previous_hash=entry.previous_hash,
                sequence=entry.sequence,
                timestamp=entry.timestamp,
                entity_type=entry.entity_type,
                entity_id=entry.entity_id,
                user_id=entry.user_id,
                action=entry.action.value,
                payload=entry.payload,
            )

            if entry.entry_hash != recalculated_hash:
                return False, entry.sequence

        return True, None

    def get_history(self, entity_type: str, entity_id: str) -> List[AuditTrailEntry]:
        return [
            entry
            for entry in self._chain
            if entry.entity_type == entity_type and entry.entity_id == entity_id
        ]
