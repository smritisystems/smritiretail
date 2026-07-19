"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import hashlib
import hmac
import ipaddress
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.api_key import (
    SMRITIServiceAccount,
    SMRITIAPIKey,
    SMRITIAPIKeyPermissionSet,
    SMRITIAPIKeyLog,
)
from ..models.security import SMRITIPermissionSet, SMRITIPermissionSetPermission, SMRITIPermission


class APIKeyService:
    """
    Core API Key service managing cryptographic secret hashing, lookup by key_prefix,
    expiration verification, IP CIDR containment, rate limiting, and permission set resolution.
    """

    KEY_PREFIX_LEN = 12
    SECRET_LEN = 32

    @staticmethod
    def _hash_secret(secret: str) -> str:
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    async def create_service_account(
        self,
        db: AsyncSession,
        code: str,
        name: str,
        description: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> SMRITIServiceAccount:
        sa = SMRITIServiceAccount(
            id=str(uuid.uuid4()),
            code=code,
            name=name,
            description=description,
            company_id=company_id,
            branch_id=branch_id,
        )
        db.add(sa)
        await db.commit()
        await db.refresh(sa)
        return sa

    async def generate_api_key(
        self,
        db: AsyncSession,
        service_account_id: str,
        name: str,
        permission_set_ids: List[str],
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        allowed_ip_cidrs: Optional[List[str]] = None,
        rate_limit_per_minute: int = 600,
        expires_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Generates raw API key string (smriti_live_<prefix>_<secret>) and saves hashed_secret in DB.
        """
        prefix = secrets.token_hex(self.KEY_PREFIX_LEN // 2)
        secret = secrets.token_urlsafe(self.SECRET_LEN)
        raw_key = f"smriti_live_{prefix}_{secret}"
        hashed_secret = self._hash_secret(secret)

        api_key = SMRITIAPIKey(
            id=str(uuid.uuid4()),
            service_account_id=service_account_id,
            name=name,
            key_prefix=prefix,
            hashed_secret=hashed_secret,
            company_id=company_id,
            branch_id=branch_id,
            allowed_ip_cidrs=allowed_ip_cidrs,
            rate_limit_per_minute=rate_limit_per_minute,
            expires_at=expires_at,
        )
        db.add(api_key)

        for ps_id in permission_set_ids:
            ps_rel = SMRITIAPIKeyPermissionSet(
                id=str(uuid.uuid4()),
                api_key_id=api_key.id,
                permission_set_id=ps_id,
            )
            db.add(ps_rel)

        await db.commit()
        await db.refresh(api_key)

        return {
            "api_key_id": api_key.id,
            "raw_key": raw_key,
            "key_prefix": prefix,
            "name": name,
            "created_at": api_key.created_at.isoformat() if api_key.created_at else None,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
        }

    async def authenticate_api_key(
        self,
        db: AsyncSession,
        raw_key: str,
        client_ip: Optional[str] = None,
    ) -> SMRITIAPIKey:
        """
        Parses raw key, performs prefix lookup, compares secret digest, validates IP CIDR and expiration.
        """
        if not raw_key or not raw_key.startswith("smriti_live_"):
            raise ValueError("Invalid API key format.")

        parts = raw_key.split("_", 3)
        if len(parts) != 4 or parts[0] != "smriti" or parts[1] != "live":
            raise ValueError("Invalid API key token structure.")

        prefix = parts[2]
        secret = parts[3]
        hashed_input = self._hash_secret(secret)

        stmt = (
            select(SMRITIAPIKey)
            .options(
                selectinload(SMRITIAPIKey.permission_sets)
                .selectinload(SMRITIAPIKeyPermissionSet.permission_set)
                .selectinload(SMRITIPermissionSet.permissions)
                .selectinload(SMRITIPermissionSetPermission.permission),
                selectinload(SMRITIAPIKey.service_account),
            )
            .where(
                SMRITIAPIKey.key_prefix == prefix,
                SMRITIAPIKey.is_active == True,
                SMRITIAPIKey.is_deleted == False,
            )
        )
        res = await db.execute(stmt)
        api_key = res.scalars().unique().first()

        if not api_key:
            raise ValueError("Invalid or revoked API key.")

        # Constant-time comparison
        if not hmac.compare_digest(api_key.hashed_secret, hashed_input):
            raise ValueError("Invalid API key secret.")

        # Expiration check
        now = datetime.now(timezone.utc)
        if api_key.expires_at:
            expires_at = api_key.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now:
                raise ValueError("API key has expired.")

        # Allowed IP CIDR check
        if api_key.allowed_ip_cidrs and client_ip:
            ip_obj = ipaddress.ip_address(client_ip)
            allowed = False
            for cidr in api_key.allowed_ip_cidrs:
                net = ipaddress.ip_network(cidr, strict=False)
                if ip_obj in net:
                    allowed = True
                    break
            if not allowed:
                raise PermissionError(f"Client IP address {client_ip} is not permitted for this API key.")

        api_key.last_used_at = now
        await db.commit()

        return api_key

    async def get_effective_permissions(self, api_key: SMRITIAPIKey) -> List[str]:
        """
        Resolves distinct permission codes granted to the API Key via its assigned Permission Sets.
        """
        codes = set()
        for ps_link in api_key.permission_sets:
            ps = ps_link.permission_set
            if ps and ps.is_active:
                for p_link in ps.permissions:
                    perm = p_link.permission
                    if perm and perm.is_active:
                        codes.add(perm.code)
        return sorted(list(codes))

    async def log_usage(
        self,
        db: AsyncSession,
        api_key_id: str,
        endpoint: str,
        http_method: str,
        status_code: int,
        client_ip: Optional[str] = None,
        response_time_ms: Optional[int] = None,
    ):
        log_entry = SMRITIAPIKeyLog(
            id=str(uuid.uuid4()),
            api_key_id=api_key_id,
            ip_address=client_ip,
            endpoint=endpoint,
            http_method=http_method,
            status_code=status_code,
            response_time_ms=response_time_ms,
        )
        db.add(log_entry)
        await db.commit()
