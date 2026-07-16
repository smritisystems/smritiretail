"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.compliance.exceptions import ConfigurationException, VaultException

# Retrieve Master Key
master_key_str = os.getenv("SGIP_VAULT_MASTER_KEY")
if not master_key_str:
    raise ConfigurationException(
        "SGIP-VAULT-001: The required environment variable 'SGIP_VAULT_MASTER_KEY' is missing. "
        "The application cannot start without a valid vault master key."
    )

# Retrieve JWT Secret to ensure isolation
jwt_secret = os.getenv("JWT_SECRET_KEY")
if jwt_secret and master_key_str == jwt_secret:
    raise ConfigurationException(
        "SGIP-VAULT-002: The vault master key 'SGIP_VAULT_MASTER_KEY' must not be the same "
        "as the JWT secret key 'JWT_SECRET_KEY'."
    )

def derive_company_key(company_id: str | None) -> bytes:
    """
    Derives a company-specific 256-bit key from the vault master key using HKDF-SHA256.
    """
    info = (company_id or "global").encode("utf-8")
    master_bytes = master_key_str.encode("utf-8")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=info,
    )
    return hkdf.derive(master_bytes)

def encrypt_data(company_id: str | None, plaintext: str) -> str:
    """
    Encrypts plaintext using AES-256-GCM with a company-derived key.
    Enforces deterministic encryption mode only when running under pytest and enabled.
    """
    if not plaintext:
        return ""
    try:
        key = derive_company_key(company_id)
        aesgcm = AESGCM(key)

        # Enforce deterministic mode ONLY when running under pytest
        is_test_env = os.getenv("PYTEST_CURRENT_TEST") is not None
        is_deterministic = is_test_env and os.getenv("SGIP_VAULT_DETERMINISTIC") == "true"

        if is_deterministic:
            nonce = b"\x00" * 12
        else:
            nonce = os.urandom(12)

        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        combined = nonce + ciphertext
        return base64.b64encode(combined).decode("utf-8")
    except Exception as e:
        raise VaultException(f"Encryption failed: {e}") from e

def decrypt_data(company_id: str | None, encrypted_text: str) -> str:
    """
    Decrypts ciphertext using AES-256-GCM with a company-derived key.
    """
    if not encrypted_text:
        return ""
    try:
        key = derive_company_key(company_id)
        aesgcm = AESGCM(key)
        combined = base64.b64decode(encrypted_text.encode("utf-8"))
        if len(combined) < 12:
            raise VaultException("Invalid encrypted payload length")
        nonce = combined[:12]
        ciphertext = combined[12:]
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception as e:
        raise VaultException(f"Decryption failed: {e}") from e
