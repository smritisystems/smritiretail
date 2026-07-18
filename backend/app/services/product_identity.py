"""
Product Identity Engine services.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..api.deps import TenantContext
from ..models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from ..repositories.product_identity import (
    BarcodeProviderRepository,
    IdentityRuleRepository,
    ProductIdentityRepository,
)
from ..repositories.product import ProductRepository


class ProductIdentityService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.provider_repo = BarcodeProviderRepository(db, tenant_ctx)
        self.rule_repo = IdentityRuleRepository(db, tenant_ctx)
        self.identity_repo = ProductIdentityRepository(db, tenant_ctx)
        self.product_repo = ProductRepository(db, tenant_ctx)

    async def list_providers(self):
        return await self.provider_repo.get_all()

    async def create_provider(self, data):
        existing = await self.provider_repo.get_by_pool(data.poolCode) if data.poolCode else None
        if existing:
            raise HTTPException(status_code=400, detail="Barcode provider pool already exists")

        provider = BarcodeProvider(
            id=f"BP-{uuid.uuid4().hex[:8]}",
            name=data.name,
            provider_type=data.providerType,
            pool_code=data.poolCode,
            priority=data.priority or 100,
            config=data.config or {},
            description=data.description,
            is_active=data.isActive if data.isActive is not None else True,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            created_by="system",
            updated_by="system",
        )
        return await self.provider_repo.create(provider)

    async def update_provider(self, provider_id: str, data):
        provider = await self.provider_repo.get(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="Barcode provider not found")

        update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        return await self.provider_repo.update(provider, update_data)

    async def list_rules(self):
        return await self.rule_repo.get_all()

    async def create_rule(self, data):
        existing = await self.rule_repo.get_by_code(data.code)
        if existing:
            raise HTTPException(status_code=400, detail="Identity rule code already exists")

        rule = IdentityRule(
            id=f"IR-{uuid.uuid4().hex[:8]}",
            name=data.name,
            code=data.code,
            scope=data.scope or {},
            expression=data.expression,
            priority=data.priority or 100,
            is_active=data.isActive if data.isActive is not None else True,
            description=data.description,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            created_by="system",
            updated_by="system",
        )
        return await self.rule_repo.create(rule)

    async def update_rule(self, rule_id: str, data):
        rule = await self.rule_repo.get(rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Identity rule not found")

        update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        return await self.rule_repo.update(rule, update_data)

    async def create_identity(self, data):
        product = await self.product_repo.get(data.productId)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        existing = await self.identity_repo.get_by_business_key(data.businessKey)
        if existing:
            raise HTTPException(status_code=409, detail="Duplicate business key")

        if await self.identity_repo.get_by_barcode(data.barcode):
            raise HTTPException(status_code=409, detail="Barcode already assigned")

        identity = ProductIdentity(
            id=f"PI-{uuid.uuid4().hex[:8]}",
            product_id=data.productId,
            business_key=data.businessKey,
            fingerprint=data.fingerprint,
            barcode=data.barcode,
            barcode_provider_id=data.barcodeProviderId,
            state=data.state or "Available",
            identity_metadata=data.identityMetadata or {},
            rule_id=data.ruleId,
            assigned_at=datetime.now(timezone.utc),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            created_by="system",
            updated_by="system",
        )
        return await self.identity_repo.create(identity)

    async def list_identities(self, skip: int = 0, limit: int = 50):
        return await self.identity_repo.get_all()

    async def get_identity(self, identity_id: str):
        identity = await self.identity_repo.get(identity_id)
        if not identity:
            raise HTTPException(status_code=404, detail="Product identity not found")
        return identity

    async def update_identity(self, identity_id: str, data):
        identity = await self.identity_repo.get(identity_id)
        if not identity:
            raise HTTPException(status_code=404, detail="Product identity not found")

        if data.barcode:
            existing = await self.identity_repo.get_by_barcode(data.barcode)
            if existing and existing.id != identity.id:
                raise HTTPException(status_code=409, detail="Barcode already assigned")

        update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        return await self.identity_repo.update(identity, update_data)
