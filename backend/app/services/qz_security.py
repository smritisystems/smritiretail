"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.8.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import base64
import datetime
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

CERTS_DIR = Path(__file__).resolve().parent.parent / "certs"
PRIVATE_KEY_PATH = CERTS_DIR / "qz_private_key.pem"
CERTIFICATE_PATH = CERTS_DIR / "qz_certificate.pem"

_private_key = None
_certificate_pem = None


def _ensure_keys():
    global _private_key, _certificate_pem

    if _private_key is not None and _certificate_pem is not None:
        return

    CERTS_DIR.mkdir(parents=True, exist_ok=True)

    if PRIVATE_KEY_PATH.exists() and CERTIFICATE_PATH.exists():
        try:
            with open(PRIVATE_KEY_PATH, "rb") as f:
                _private_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
            with open(CERTIFICATE_PATH, "r", encoding="utf-8") as f:
                _certificate_pem = f.read()
            return
        except Exception:
            pass

    # Generate new RSA 2048-bit Key Pair
    _private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    # Self-signed X.509 Certificate valid for 10 years
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Maharashtra"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Mumbai"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SMRITI Systems"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Retail OS Security Gateway"),
        x509.NameAttribute(NameOID.COMMON_NAME, "SMRITI Retail OS QZ Signing Authority"),
    ])

    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(_private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .sign(_private_key, hashes.SHA256(), default_backend())
    )

    # Serialize and save to disk
    priv_pem = _private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    )
    cert_bytes = cert.public_bytes(serialization.Encoding.PEM)
    _certificate_pem = cert_bytes.decode("utf-8")

    with open(PRIVATE_KEY_PATH, "wb") as f:
        f.write(priv_pem)
    with open(CERTIFICATE_PATH, "wb") as f:
        f.write(cert_bytes)


class QzSecurityService:
    """
    Production-grade QZ Tray Signing & Certificate Authority Service.
    Private keys remain strictly contained on the server.
    """

    @classmethod
    def get_public_certificate(cls) -> str:
        _ensure_keys()
        return _certificate_pem

    @classmethod
    def sign_request(cls, request_str: str) -> str:
        """
        Signs the QZ Tray request payload using SHA512 (default in QZ 2.1+) with PKCS1v15 padding.
        Returns base64 encoded signature.
        """
        _ensure_keys()
        if not request_str:
            raise ValueError("Request string to sign cannot be empty.")

        data_bytes = request_str.encode("utf-8")
        signature = _private_key.sign(
            data_bytes,
            padding.PKCS1v15(),
            hashes.SHA512()
        )
        return base64.b64encode(signature).decode("utf-8")
