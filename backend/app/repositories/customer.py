"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-10-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, cast, Integer, func, or_
from sqlalchemy.orm import selectinload
from ..models.crm import CustomerRelationship
from ..models.crm import Customer, CustomerGroup, CustomerCompanyRelationship
from .base import BaseRepository
from ..api.deps import TenantContext

class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Customer, db, tenant_ctx)

    def _apply_tenant_filter(self, stmt):
        """
        Model C Multi-Company Unification Filter:
        Customers are visible in the active company if:
        1. Customer was created for / bound to this company (Customer.company_id == tenant_ctx.company_id), OR
        2. Customer is a tenant-wide master record (Customer.company_id IS NULL), OR
        3. An active commercial relationship exists linking this Customer to this company
           (EXISTS in customer_company_relationships where company_id == tenant_ctx.company_id and is_deleted == False).
        """
        if self.tenant_ctx and self.tenant_ctx.company_id:
            rel_exists = (
                select(1)
                .select_from(CustomerCompanyRelationship)
                .filter(
                    CustomerCompanyRelationship.customer_id == Customer.id,
                    CustomerCompanyRelationship.company_id == self.tenant_ctx.company_id,
                    CustomerCompanyRelationship.is_deleted == False,
                )
                .exists()
            )
            company_filter = or_(
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.company_id.is_(None),
                rel_exists,
            )
            stmt = stmt.filter(company_filter)

            if hasattr(self.model, "branch_id") and self.tenant_ctx.branch_id:
                if self.tenant_ctx.branch_id in ("BR-MAIN-001", "MAIN", "BR-001"):
                    stmt = stmt.filter(or_(self.model.branch_id.in_(["BR-MAIN-001", "MAIN", "BR-001"]), self.model.branch_id.is_(None)))
                else:
                    stmt = stmt.filter(or_(self.model.branch_id == self.tenant_ctx.branch_id, self.model.branch_id.is_(None)))
        return stmt

    def _apply_billing_visibility_filter(self, stmt):
        """
        Billing visibility filter:
        Child customers (is_dependant=True or existing in customer_relationships as dependant)
        appear in billing ONLY when their parent customer has show_child_customers_in_billing=True.
        Standalone customers (not dependant) always appear.
        """
        from sqlalchemy.orm import aliased
        ParentCust = aliased(Customer, name="parent_cust_repo")

        parent_enabled_subquery = (
            select(1)
            .select_from(CustomerRelationship)
            .join(ParentCust, CustomerRelationship.parent_customer_id == ParentCust.id)
            .where(
                CustomerRelationship.dependant_customer_id == Customer.id,
                CustomerRelationship.is_deleted == False,
                ParentCust.is_deleted == False,
                ParentCust.show_child_customers_in_billing == True,
            )
            .exists()
        )

        is_child_subquery = (
            select(1)
            .select_from(CustomerRelationship)
            .where(
                CustomerRelationship.dependant_customer_id == Customer.id,
                CustomerRelationship.is_deleted == False,
            )
            .exists()
        )

        visibility_filter = or_(
            and_(
                Customer.is_dependant == False,
                ~is_child_subquery,
            ),
            parent_enabled_subquery,
        )
        return stmt.filter(visibility_filter)

    async def get(self, id: str) -> Optional[Customer]:
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.group),
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.policy),
                selectinload(Customer.parent_relationships).selectinload(CustomerRelationship.parent_customer),
                selectinload(Customer.dependant_relationships).selectinload(CustomerRelationship.dependant_customer),
                selectinload(Customer.loyalty_members),
                selectinload(Customer.company_relationships),
            )
            .filter(Customer.id == id, Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    def _apply_invoice_scope(self, stmt, invoice_series: Optional[str], invoice_from: Optional[int], invoice_to: Optional[int]):
        if not invoice_series:
            return stmt
        from ..models.sales import SalesInvoice
        invoice_number = func.split_part(SalesInvoice.invoice_no, "/", 2)
        scope = [
            SalesInvoice.invoice_no.like(f"{invoice_series}/%"),
            invoice_number.op("~")("^[0-9]+$"),
        ]
        if invoice_from is not None:
            scope.append(cast(invoice_number, Integer) >= invoice_from)
        if invoice_to is not None:
            scope.append(cast(invoice_number, Integer) <= invoice_to)
        return stmt.join(SalesInvoice, SalesInvoice.customer_id == Customer.id).filter(and_(*scope)).distinct()

    async def get_all(
        self, skip: int = 0, limit: int = 100,
        invoice_series: Optional[str] = None, invoice_from: Optional[int] = None,
        invoice_to: Optional[int] = None,
        status: Optional[str] = None,
        billing_only: bool = False,
    ) -> List[Customer]:
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.group),
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.policy),
                selectinload(Customer.parent_relationships).selectinload(CustomerRelationship.parent_customer),
                selectinload(Customer.dependant_relationships).selectinload(CustomerRelationship.dependant_customer),
                selectinload(Customer.loyalty_members),
                selectinload(Customer.company_relationships),
            )
            .filter(Customer.is_deleted == False)
        )
        if status:
            stmt = stmt.filter(Customer.status == status)
        stmt = self._apply_tenant_filter(stmt)
        stmt = self._apply_invoice_scope(stmt, invoice_series, invoice_from, invoice_to)
        if billing_only:
            stmt = self._apply_billing_visibility_filter(stmt)
        stmt = stmt.order_by(Customer.created_at.asc(), Customer.id.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self, q: Optional[str] = None, skip: int = 0, limit: int = 50,
        invoice_series: Optional[str] = None, invoice_from: Optional[int] = None,
        invoice_to: Optional[int] = None,
        status: Optional[str] = None,
        billing_only: bool = False,
    ) -> List[Customer]:
        """
        Search customers by name, mobile, code, email, GST number under tenant context.
        Optionally filters by status (Active/Inactive/Archived). Eagerly loads group for credit policy.
        """
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.group),
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.policy),
                selectinload(Customer.parent_relationships).selectinload(CustomerRelationship.parent_customer),
                selectinload(Customer.dependant_relationships).selectinload(CustomerRelationship.dependant_customer),
                selectinload(Customer.loyalty_members),
                selectinload(Customer.company_relationships),
            )
            .filter(Customer.is_deleted == False)
        )
        if status:
            stmt = stmt.filter(Customer.status == status)
        stmt = self._apply_tenant_filter(stmt)
        stmt = self._apply_invoice_scope(stmt, invoice_series, invoice_from, invoice_to)
        if billing_only:
            stmt = self._apply_billing_visibility_filter(stmt)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (Customer.name.ilike(f"%{clean_q}%")) |
                (Customer.mobile.ilike(f"%{clean_q}%")) |
                (Customer.code.ilike(f"%{clean_q}%")) |
                (Customer.id.ilike(f"%{clean_q}%")) |
                (Customer.email.ilike(f"%{clean_q}%")) |
                (Customer.gst_number.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def enterprise_search(
        self,
        q: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> List[Customer]:
        """
        BD-4 Enterprise Cross-Company Customer Search:
        Unrestricted across company boundaries for global identity lookups.
        Must only be called from audited enterprise search endpoints.
        """
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.group),
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
                selectinload(Customer.policy),
                selectinload(Customer.dependant_relationships).selectinload(CustomerRelationship.dependant_customer),
                selectinload(Customer.loyalty_members),
                selectinload(Customer.company_relationships),
            )
            .filter(Customer.is_deleted == False)
        )
        if status and status.lower() != "all":
            stmt = stmt.filter(Customer.status == status)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (Customer.name.ilike(f"%{clean_q}%")) |
                (Customer.mobile.ilike(f"%{clean_q}%")) |
                (Customer.code.ilike(f"%{clean_q}%")) |
                (Customer.id.ilike(f"%{clean_q}%")) |
                (Customer.email.ilike(f"%{clean_q}%")) |
                (Customer.gst_number.ilike(f"%{clean_q}%")) |
                (Customer.pan_number.ilike(f"%{clean_q}%")) |
                (Customer.identity_code.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.order_by(Customer.name.asc(), Customer.id.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

class CustomerGroupRepository(BaseRepository[CustomerGroup]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(CustomerGroup, db, tenant_ctx)


class CustomerGSTRegistrationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerGSTRegistration
        super().__init__(CustomerGSTRegistration, db, tenant_ctx)
        self.model = CustomerGSTRegistration

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = select(self.model).filter(
            self.model.id == id,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(self, customer_id: str, id: str):
        stmt = select(self.model).filter(
            self.model.id == id,
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_gstin(
        self, customer_id: str, gstin: str, include_deleted: bool = False
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.gstin == gstin,
        )
        if not include_deleted:
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        if not include_inactive:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.is_primary.desc(), self.model.state_name.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_primary(self, customer_id: str):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_primary == True,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_primary_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_primary == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for reg in res.scalars().all():
            reg.is_primary = False


class CustomerDeliveryLocationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerDeliveryLocation
        super().__init__(CustomerDeliveryLocation, db, tenant_ctx)
        self.model = CustomerDeliveryLocation

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(
        self, customer_id: str, id: str, with_for_update: bool = False
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        if with_for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_store_code(
        self, store_code: str, active_only: bool = True, with_for_update: bool = False
    ):
        clean_code = store_code.strip().upper()
        stmt = select(self.model).filter(
            self.model.store_code == clean_code,
            self.model.is_deleted == False,
        )
        if active_only:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        if with_for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search_store_code_lookup(
        self,
        q: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        from ..models.crm import Customer
        stmt = (
            select(self.model, Customer)
            .outerjoin(Customer, self.model.customer_id == Customer.id)
            .filter(
                self.model.is_deleted == False,
                self.model.is_active == True,
            )
        )
        stmt = self._apply_company_filter(stmt)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (self.model.store_code.ilike(f"%{clean_q}%")) |
                (self.model.location_name.ilike(f"%{clean_q}%")) |
                (self.model.city.ilike(f"%{clean_q}%")) |
                (self.model.state.ilike(f"%{clean_q}%")) |
                (self.model.pincode.ilike(f"%{clean_q}%")) |
                (Customer.name.ilike(f"%{clean_q}%")) |
                (Customer.code.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.order_by(self.model.store_code.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.all())

    async def get_by_customer_and_store_code(
        self, customer_id: str, store_code: str, active_only: bool = True
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.store_code == store_code,
            self.model.is_deleted == False,
        )
        if active_only:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        if not include_inactive:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.store_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self,
        q: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.is_deleted == False,
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        )
        stmt = self._apply_company_filter(stmt)
        if customer_id:
            stmt = stmt.filter(self.model.customer_id == customer_id)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (self.model.store_code.ilike(f"%{clean_q}%")) |
                (self.model.location_name.ilike(f"%{clean_q}%")) |
                (self.model.city.ilike(f"%{clean_q}%")) |
                (self.model.state.ilike(f"%{clean_q}%")) |
                (self.model.pincode.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.order_by(self.model.store_code.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_default(self, customer_id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_default == True,
                self.model.is_active == True,
                self.model.status == "ACTIVE",
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_default_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_default == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for loc in res.scalars().all():
            loc.is_default = False


class CustomerBillingLocationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerBillingLocation
        super().__init__(CustomerBillingLocation, db, tenant_ctx)
        self.model = CustomerBillingLocation

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(self, customer_id: str, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_billing_store_code(
        self, customer_id: str, billing_store_code: str, active_only: bool = True
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.billing_store_code == billing_store_code,
            self.model.is_deleted == False,
        )
        if active_only:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        if not include_inactive:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.is_default.desc(), self.model.billing_store_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_default(self, customer_id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_default == True,
                self.model.status == "ACTIVE",
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_default_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_default == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for loc in res.scalars().all():
            loc.is_default = False


class CustomerExternalIdentityRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerExternalIdentity
        super().__init__(CustomerExternalIdentity, db, tenant_ctx)
        self.model = CustomerExternalIdentity

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get_all_for_customer(self, customer_id: str, include_inactive: bool = False):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        if not include_inactive:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.source_system.asc(), self.model.external_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_composite(
        self, source_system: str, external_type: str, external_code: str
    ):
        stmt = select(self.model).filter(
            self.model.source_system == source_system,
            self.model.external_type == external_type,
            self.model.external_code == external_code,
            self.model.status == "ACTIVE",
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

