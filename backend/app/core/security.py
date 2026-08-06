"""
Project         : SMRITI Retail OS
Organization    : SmritiSys
Author          : Jawahar Ramkripal Mallah
Designation     : Chief Systems Architect & Creator
Email           : support@smritibooks.com
Websites        : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version         : 3.32.0
Created         : 2026-07-11
Modified        : 2026-08-04
Copyright       : © SMRITIBooks.com. All Rights Reserved.
License         : Proprietary Commercial Software
Classification  : Internal
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError
from fastapi import HTTPException
from passlib.context import CryptContext
from passlib.exc import MissingBackendError
import hashlib
import binascii
from .config import settings

pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
)

# ---------------------------------------------------------------------------
# Password hashing — Passlib with Argon2 / bcrypt compatibility
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash the given plain-text password with the current secure algorithm."""
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback to standard PBKDF2-SHA512 if passlib backends fail on host environment
        salt = binascii.hexlify(hashlib.sha256(password.encode("utf-8")).digest()[:16]).decode("ascii")
        dk = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return f"pbkdf2$sha512$100000${salt}${dk.hex()}"




def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored password hash. Supports legacy hashes."""
    if hashed and hashed.startswith("pbkdf2$"):
        try:
            parts = hashed.split("$")
            if len(parts) != 5:
                return False
            _, algo, iter_str, salt, hash_hex = parts
            iterations = int(iter_str)
            dk = hashlib.pbkdf2_hmac(
                hash_name="sha512",
                password=plain.encode("utf-8"),
                salt=salt.encode("utf-8"),
                iterations=iterations,
                dklen=64,
            )
            computed_hex = binascii.hexlify(dk).decode("utf-8")
            return computed_hex == hash_hex
        except Exception:
            return False

    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def validate_password_strength(password: str) -> None:
    """Raise HTTPException if the provided password does not meet security policy."""
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter.",
        )
    if not any(c.islower() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one lowercase letter.",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one number.",
        )
    if not any(c in "!@#$%^&*()-_=+[]{}|;:'\",.<>/?`~" for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one special character.",
        )


def generate_compliant_password(length: int = 12) -> str:
    """
    Generate a random temporary password guaranteed to satisfy
    validate_password_strength (uppercase, lowercase, digit, special char).
    """
    if length < 8:
        length = 8

    uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    lowercase = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    specials = "!@#$%^&*()-_=+"
    all_chars = uppercase + lowercase + digits + specials

    password_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(specials),
    ]

    for _ in range(length - 4):
        password_chars.append(secrets.choice(all_chars))

    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


# ---------------------------------------------------------------------------
# JWT helpers — python-jose
# ---------------------------------------------------------------------------

def create_access_token(data: dict) -> str:
    """
    Encode a signed HS256 JWT access token.

    The payload is a copy of `data` with:
      - ``type`` = "access"
      - ``exp``  = now + ACCESS_TOKEN_EXPIRE_MINUTES
    """
    payload = data.copy()
    payload["type"] = "access"
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Encode a signed HS256 JWT refresh token.

    The payload is a copy of `data` with:
      - ``type`` = "refresh"
      - ``exp``  = now + REFRESH_TOKEN_EXPIRE_DAYS
    """
    payload = data.copy()
    payload["type"] = "refresh"
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Raises ``HTTPException(401)`` if the token is expired, tampered, or malformed.
    Returns the decoded payload dict on success.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except (PyJWTError, Exception):
        raise HTTPException(
            status_code=401,
            detail="Token is invalid or has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
