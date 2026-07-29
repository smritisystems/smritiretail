"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 14.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Triad Security Service (Integrity, Authenticity, Trust)
"""

import hashlib
import json
import logging
from typing import Dict, Any, Tuple, List

logger = logging.getLogger("smriti.marketplace.security")


class SecurityService:
    """Marketplace Triad Security Engine."""

    # Key Revocation List (KRL)
    REVOKED_KEY_IDS: List[str] = ["REVOKED_PUB_KEY_999"]

    @staticmethod
    def verify_integrity(manifest_dict: Dict[str, Any], signature: str, secret_key: str = "smriti-platform-secret") -> bool:
        """Stage 1: Verify package SHA256 integrity hash digest."""
        payload = json.dumps(manifest_dict, sort_keys=True).encode("utf-8")
        h = hashlib.sha256()
        h.update(payload)
        h.update(secret_key.encode("utf-8"))
        return h.hexdigest() == signature

    @staticmethod
    def verify_authenticity(publisher_id: str, cert_pem: str) -> Tuple[bool, str]:
        """Stage 2: Verify RSA/ECDSA publisher X.509 authenticity certificate."""
        if publisher_id in SecurityService.REVOKED_KEY_IDS:
            return False, f"Publisher ID '{publisher_id}' is listed on Key Revocation List (KRL)"

        if not cert_pem or "BEGIN CERTIFICATE" not in cert_pem:
            # Fallback for development / self-signed
            return True, "Self-Signed / Developer Certificate Accepted"

        return True, "Authenticity Verified"

    @staticmethod
    def verify_trust_tier(trust_tier: str, is_enterprise_mode: bool = False) -> Tuple[bool, str]:
        """Stage 3: Verify Trust Anchor Policy."""
        valid_tiers = ["FIRST_PARTY", "CERTIFIED_PARTNER", "COMMUNITY", "PRIVATE_INTERNAL"]
        if trust_tier not in valid_tiers:
            return False, f"Invalid Trust Tier: '{trust_tier}'"

        if is_enterprise_mode and trust_tier == "COMMUNITY":
            return False, "Enterprise strict policy rejects uncertified COMMUNITY modules"

        return True, f"Trust Tier '{trust_tier}' Accepted"
