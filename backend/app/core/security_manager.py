"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 13.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Security Manager & Digital Signature Verifier
"""

import hashlib
import json
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger("smriti.security_manager")


class SecurityManager:
    """Security Manager: Computes SHA256 signatures and verifies Trust Tiers."""

    @staticmethod
    def calculate_sha256(content: bytes) -> str:
        """Calculates SHA-256 hash digest of binary content."""
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def sign_manifest(manifest_dict: Dict[str, Any], secret_key: str = "smriti-platform-secret") -> str:
        """Generates SHA256 HMAC digital signature for a manifest dictionary."""
        payload = json.dumps(manifest_dict, sort_keys=True).encode("utf-8")
        h = hashlib.sha256()
        h.update(payload)
        h.update(secret_key.encode("utf-8"))
        return h.hexdigest()

    @staticmethod
    def verify_manifest_signature(manifest_dict: Dict[str, Any], expected_signature: str, secret_key: str = "smriti-platform-secret") -> Tuple[bool, str]:
        """Verifies signature integrity of a module manifest."""
        actual = SecurityManager.sign_manifest(manifest_dict, secret_key)
        if actual == expected_signature:
            return True, "Signature Valid"
        return False, f"Signature Mismatch: expected {expected_signature[:8]}... got {actual[:8]}..."
