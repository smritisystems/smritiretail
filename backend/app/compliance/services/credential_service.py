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

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.exceptions import VaultException
from app.compliance.models.compliance import ComplianceCredentials
from app.compliance.repositories.credentials_repository import ComplianceCredentialsRepository
from app.compliance.vault.crypto import decrypt_data, encrypt_data


class CredentialService:
    """
    Coordinates secure storage, retrieval, encryption, and decryption of compliance credentials.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext | None = None) -> None:
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = ComplianceCredentialsRepository(db, tenant_ctx)

    def _get_company_id(self) -> str:
        if self.tenant_ctx and self.tenant_ctx.company_id:
            return self.tenant_ctx.company_id
        return "global"

    async def save_credentials(
        self,
        service_id: str,
        username: str,
        password: str,
        client_secret: str | None = None
    ) -> ComplianceCredentials:
        """
        Encrypts and persists credentials for a specific compliance service.
        """
        company_id = self._get_company_id()
        encrypted_user = encrypt_data(company_id, username)
        encrypted_pass = encrypt_data(company_id, password)
        encrypted_secret = encrypt_data(company_id, client_secret) if client_secret else None

        existing = await self.repo.get_by_service(service_id)
        if existing:
            existing.encrypted_username = encrypted_user  # type: ignore
            existing.encrypted_password = encrypted_pass  # type: ignore
            existing.encrypted_client_secret = encrypted_secret  # type: ignore
            self.db.add(existing)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        new_cred = ComplianceCredentials(
            id=f"cred-{uuid.uuid4().hex[:8]}",
            service_id=service_id,
            encrypted_username=encrypted_user,
            encrypted_password=encrypted_pass,
            encrypted_client_secret=encrypted_secret
        )
        created = await self.repo.create(new_cred)
        await self.db.commit()
        return created

    async def get_credentials(self, service_id: str) -> dict[str, str | None] | None:
        """
        Retrieves, decrypts, and returns credentials in plaintext.
        """
        cred = await self.repo.get_by_service(service_id)
        if not cred:
            return None

        company_id = self._get_company_id()
        try:
            username = decrypt_data(company_id, cred.encrypted_username)  # type: ignore
            password = decrypt_data(company_id, cred.encrypted_password)  # type: ignore
            client_secret = (
                decrypt_data(company_id, cred.encrypted_client_secret)  # type: ignore
                if cred.encrypted_client_secret
                else None
            )
            return {
                "username": username,
                "password": password,
                "client_secret": client_secret
            }
        except VaultException as e:
            raise VaultException(f"Failed to decrypt service credentials: {e}") from e
