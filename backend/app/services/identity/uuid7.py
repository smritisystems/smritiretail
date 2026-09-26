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

import os
import time
import uuid
import threading
from typing import Optional


class _UUIDv7State:
    """Thread-safe state for RFC 9562 monotonic sequence generator."""
    def __init__(self):
        self.lock = threading.Lock()
        self.last_ms: int = 0
        self.sequence: int = 0


_STATE = _UUIDv7State()


def uuid7(as_str: bool = True) -> str | uuid.UUID:
    """
    Generate an RFC 9562-compatible UUIDv7.

    Architecture Contract:
    - RFC 9562-compatible layout:
      * 48 bits: Unix timestamp in milliseconds
      * 4 bits: Version (0b0111 = 7)
      * 12 bits: Sub-millisecond monotonic sequence counter (0x000 - 0xFFF)
      * 2 bits: Variant (0b10 = RFC 4122/9562)
      * 62 bits: Cryptographically secure random bits
    - Generator-level monotonic ordering:
      * Enforces local monotonic lexical ordering within this process/generator
    - Uniqueness enforced by DB constraints (PRIMARY KEY / UNIQUE INDEX)
    - Not a universal guarantee of global temporal ordering across distributed clocks
    """
    with _STATE.lock:
        current_ms = int(time.time() * 1000)
        if current_ms > _STATE.last_ms:
            _STATE.last_ms = current_ms
            _STATE.sequence = 0
        else:
            # Same or backwards millisecond: increment monotonic sequence
            _STATE.sequence += 1
            if _STATE.sequence > 0x0FFF:
                # Counter rollover per RFC 9562 Section 6.2: advance simulated millisecond
                _STATE.last_ms += 1
                _STATE.sequence = 0
            current_ms = _STATE.last_ms

        seq = _STATE.sequence

    # 48-bit timestamp
    time_bytes = current_ms.to_bytes(6, byteorder="big")

    # 12-bit sequence with 4-bit version 7 (0b0111_xxxx)
    ver_seq = 0x7000 | (seq & 0x0FFF)
    ver_seq_bytes = ver_seq.to_bytes(2, byteorder="big")

    # 8 bytes of randomness
    rand_bytes = os.urandom(8)
    # Set variant bits (0b10xxxxxx) on first byte
    var_byte = (rand_bytes[0] & 0x3F) | 0x80
    rand_tail = bytes([var_byte]) + rand_bytes[1:]

    raw_bytes = time_bytes + ver_seq_bytes + rand_tail
    u = uuid.UUID(bytes=raw_bytes)

    return str(u) if as_str else u


def is_valid_uuidv7(value: str) -> bool:
    """Check if string is a valid UUIDv7 format and version."""
    try:
        u = uuid.UUID(str(value).strip())
        return u.version == 7
    except (ValueError, AttributeError, TypeError):
        return False
