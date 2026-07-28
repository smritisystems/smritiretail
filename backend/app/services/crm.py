"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.3.0
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.crm import (
    Customer, CustomerGroup, PricingGroup,
    CustomerAddress, CustomerContact, CustomerCreditProfile,
    CustomerTaxProfile, CustomerCommunicationPreference,
    Lead, Opportunity, Campaign, SupportTicket, TicketComment, CustomerActivity,
)

from ..schemas.crm import (
    CustomerCreate, CustomerUpdate, CustomerGroupCreate,
    PricingGroupCreate, PricingGroupUpdate,
)
from ..api.deps import TenantContext
from ..core.events.domain_events import publish_customer_created


class CrmService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    # ------------------------------------------------------------------
    # CustomerGroup
    # ------------------------------------------------------------------

    async def create_customer_group(self, group_in: CustomerGroupCreate) -> CustomerGroup:
        existing = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.name == group_in.name,
                CustomerGroup.is_deleted == False,
                CustomerGroup.company_id == self.tenant_ctx.company_id,
                CustomerGroup.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Customer group with this name already exists")

        db_group = CustomerGroup(
            **group_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Customer group with this name already exists"
            )
        await self.db.refresh(db_group)
        return db_group

    # ------------------------------------------------------------------
    # PricingGroup
    # ------------------------------------------------------------------

    async def create_pricing_group(self, group_in: PricingGroupCreate) -> PricingGroup:
        existing = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.name == group_in.name,
                PricingGroup.is_deleted == False,
                PricingGroup.company_id == self.tenant_ctx.company_id,
                PricingGroup.branch_id == self.tenant_ctx.branch_id,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Pricing group with this name already exists")

        db_group = PricingGroup(
            **group_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Pricing group with this name already exists"
            )
        await self.db.refresh(db_group)
        return db_group

    async def update_pricing_group(self, group_id: str, group_in: PricingGroupUpdate) -> PricingGroup:
        res = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.id == group_id,
                PricingGroup.is_deleted == False,
                PricingGroup.company_id == self.tenant_ctx.company_id,
                PricingGroup.branch_id == self.tenant_ctx.branch_id,
            )
        )
        pg = res.scalars().first()
        if not pg:
            raise HTTPException(status_code=404, detail="Pricing group not found")

        for field, value in group_in.model_dump(exclude_unset=True).items():
            setattr(pg, field, value)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="A pricing group with this name already exists")
        await self.db.refresh(pg)
        return pg

    async def resolve_customer_pricing(self, customer_id: str) -> dict:
        res = await self.db.execute(
            select(Customer).filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        defaults = {
            "pricing_group_id": None,
            "pricing_group_name": None,
            "base_price_field": "price",
            "discount_percent": 0.00,
            "price_adjustment": 0.00,
            "rounding_rule": "Nearest1",
            "max_additional_discount_percent": 0.00,
            "tax_inclusive": True,
            "scheme_eligible": True,
            "quantity_break_eligible": False,
            "min_order_value": 0.00,
        }

        if not customer.pricing_group_id:
            return defaults

        pg_res = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.id == customer.pricing_group_id,
                PricingGroup.is_deleted == False,
            )
        )
        pg = pg_res.scalars().first()
        if not pg:
            return defaults

        return {
            "pricing_group_id": pg.id,
            "pricing_group_name": pg.name,
            "base_price_field": pg.base_price_field,
            "discount_percent": float(pg.discount_percent),
            "price_adjustment": float(pg.price_adjustment),
            "rounding_rule": pg.rounding_rule,
            "max_additional_discount_percent": float(pg.max_additional_discount_percent),
            "tax_inclusive": pg.tax_inclusive,
            "scheme_eligible": pg.scheme_eligible,
            "quantity_break_eligible": pg.quantity_break_eligible,
            "min_order_value": float(pg.min_order_value),
        }

    # ------------------------------------------------------------------
    # Customer Code Generator Engine (CUS-100001)
    # ------------------------------------------------------------------

    async def _generate_customer_code(self) -> str:
        stmt = select(func.count(Customer.id)).filter(
            Customer.company_id == self.tenant_ctx.company_id
        )
        res = await self.db.execute(stmt)
        count = res.scalar() or 0
        return f"CUS-{100001 + count}"

    # ------------------------------------------------------------------
    # Customer Aggregate Operations
    # ------------------------------------------------------------------

    async def create_customer(self, customer_in: CustomerCreate) -> Customer:
        if customer_in.mobile:
            existing_mobile = await self.db.execute(
                select(Customer).filter(
                    Customer.mobile == customer_in.mobile,
                    Customer.is_deleted == False,
                    Customer.company_id == self.tenant_ctx.company_id,
                    Customer.branch_id == self.tenant_ctx.branch_id
                )
            )
            if existing_mobile.scalars().first():
                raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")

        if customer_in.customer_group_id:
            stmt = select(CustomerGroup).filter(
                CustomerGroup.id == customer_in.customer_group_id,
                CustomerGroup.is_deleted == False,
                CustomerGroup.company_id == self.tenant_ctx.company_id,
                CustomerGroup.branch_id == self.tenant_ctx.branch_id
            )
            res = await self.db.execute(stmt)
            if not res.scalars().first():
                raise HTTPException(status_code=400, detail="Specified Customer Group does not exist")

        if customer_in.pricing_group_id:
            pg_res = await self.db.execute(
                select(PricingGroup).filter(
                    PricingGroup.id == customer_in.pricing_group_id,
                    PricingGroup.is_deleted == False,
                    PricingGroup.company_id == self.tenant_ctx.company_id,
                    PricingGroup.branch_id == self.tenant_ctx.branch_id,
                )
            )
            if not pg_res.scalars().first():
                raise HTTPException(status_code=400, detail="Specified Pricing Group does not exist")

        # Auto-generate customer code if omitted
        code = customer_in.code or await self._generate_customer_code()
        customer_id = customer_in.id or f"cust-{uuid.uuid4().hex[:12]}"

        # Dump base model attributes excluding nested child entity payloads
        customer_dict = customer_in.model_dump(exclude={
            "id", "code", "tax_profile", "credit_profile", "addresses", "contacts", "channel_preferences"
        })

        db_customer = Customer(
            id=customer_id,
            code=code,
            **customer_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_customer)

        # Handle nested CustomerTaxProfile
        if customer_in.tax_profile:
            tax_dict = customer_in.tax_profile.model_dump()
            db_tax = CustomerTaxProfile(
                id=f"tax-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **tax_dict
            )
            self.db.add(db_tax)

        # Handle nested CustomerCreditProfile
        if customer_in.credit_profile:
            credit_dict = customer_in.credit_profile.model_dump()
            db_credit = CustomerCreditProfile(
                id=f"cred-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **credit_dict
            )
            self.db.add(db_credit)

        # Handle nested CustomerAddress list
        for addr_in in customer_in.addresses:
            db_addr = CustomerAddress(
                id=f"addr-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **addr_in.model_dump()
            )
            self.db.add(db_addr)

        # Handle nested CustomerContact list
        for contact_in in customer_in.contacts:
            db_contact = CustomerContact(
                id=f"cnt-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **contact_in.model_dump()
            )
            self.db.add(db_contact)

        # Handle nested CustomerChannelPreference list
        for chan_in in customer_in.channel_preferences:
            db_chan = CustomerCommunicationPreference(
                id=f"chan-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **chan_in.model_dump()
            )
            self.db.add(db_chan)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            logger.warning("Customer creation database constraint violation: %s", exc)
            raise HTTPException(
                status_code=400,
                detail=f"Customer creation failed due to database constraint violation (duplicate record or invalid reference)."
            )
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Unexpected error during customer aggregate creation")
            raise HTTPException(
                status_code=500,
                detail="An unexpected internal error occurred while saving customer record."
            )

        # Fetch full aggregate graph with eager loaded child entities
        stmt_full = (
            select(Customer)
            .options(
                selectinload(Customer.tax_profile),
                selectinload(Customer.credit_profile),
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.channel_preferences),
            )
            .filter(Customer.id == customer_id)
        )
        res_full = await self.db.execute(stmt_full)
        customer = res_full.scalars().first()

        # Fire-and-forget: CustomerCreated domain event (ADR-007, GR-003)
        try:
            await publish_customer_created(
                customer_id=customer_id,
                customer_name=customer_in.name,
                mobile=customer_in.mobile or None,
                email=customer_in.email or None,
                company_id=self.tenant_ctx.company_id,
            )
        except Exception as _evt_err:
            logger.warning("[EVENT] CustomerCreated publish failed (non-blocking): %s", _evt_err)

        return customer

    async def check_credit_limit(self, customer_id: Optional[str], new_invoice_amount: float) -> None:
        if not customer_id:
            return

        res = await self.db.execute(
            select(Customer)
            .options(selectinload(Customer.credit_profile))
            .filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        customer = res.scalars().first()
        if not customer:
            return

        # Check account status block
        if customer.account_status == "Blocked":
            raise HTTPException(
                status_code=400,
                detail=f"Sales blocked for customer '{customer.name}': Account status is Blocked.",
            )

        # Check 1:1 CustomerCreditProfile first if present
        if customer.credit_profile:
            cp = customer.credit_profile
            if cp.block_sales_on_limit and not cp.allow_override and cp.credit_limit > 0:
                current_outstanding = float(customer.outstanding or 0.0)
                limit = float(cp.credit_limit)
                if (current_outstanding + new_invoice_amount) > limit:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Credit limit exceeded for customer '{customer.name}'. "
                            f"Limit: ₹{limit:,.2f}, Outstanding: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_invoice_amount:,.2f}"
                        ),
                    )
            return

        # Fallback to CustomerGroup policy if no individual credit profile exists
        if not customer.customer_group_id:
            return

        group_res = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.id == customer.customer_group_id,
                CustomerGroup.is_deleted == False,
            )
        )
        group = group_res.scalars().first()
        if not group:
            return

        if group.credit_hold:
            raise HTTPException(
                status_code=400,
                detail=f"Sales blocked for customer '{customer.name}': Account group is on credit hold.",
            )

        if not group.unlimited_credit and group.auto_block_sales and group.credit_limit and float(group.credit_limit) > 0:
            current_outstanding = float(customer.outstanding or 0.0)
            limit = float(group.credit_limit)
            if (current_outstanding + new_invoice_amount) > limit:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Credit limit exceeded for customer '{customer.name}'. "
                        f"Limit: ₹{limit:,.2f}, Outstanding: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_invoice_amount:,.2f}"
                    ),
                )


    # ---------------------------------------------------------------------------
    # Lead Management & Lead -> Customer Conversion (Task C-1 / C-6)
    # ---------------------------------------------------------------------------

    async def create_lead(self, data: dict) -> Lead:
        lead_id = f"LEAD-{uuid.uuid4().hex[:8]}"
        lead_no = f"LD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        lead = Lead(
            id=lead_id,
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            lead_no=lead_no,
            first_name=data["first_name"],
            last_name=data.get("last_name"),
            company_name=data.get("company_name"),
            email=data.get("email"),
            mobile=data.get("mobile"),
            lead_source=data.get("lead_source", "Website"),
            status=data.get("status", "NEW"),
            assigned_to=data.get("assigned_to"),
            notes=data.get("notes"),
        )
        self.db.add(lead)
        await self.db.flush()
        return lead

    async def list_leads(self) -> List[Lead]:
        stmt = select(Lead).where(Lead.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(Lead.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def convert_lead_to_customer(self, lead_id: str) -> Customer:
        """
        Converts a qualified Lead into an active Customer. (Task C-6)
        """
        stmt = select(Lead).where(Lead.id == lead_id, Lead.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(Lead.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        lead = result.scalars().first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")

        full_name = f"{lead.first_name} {lead.last_name or ''}".strip()
        cust_create = CustomerCreate(
            name=full_name,
            mobile=lead.mobile or "",
            email=lead.email,
            customerGroupId="CG-Retail",
        )
        customer = await self.create_customer(cust_create)
        lead.status = "CONVERTED"
        self.db.add(lead)
        return customer

    # ---------------------------------------------------------------------------
    # Opportunity Management (Task C-2)
    # ---------------------------------------------------------------------------

    async def create_opportunity(self, data: dict) -> Opportunity:
        opp_id = f"OPP-{uuid.uuid4().hex[:8]}"
        opp_no = f"OPP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        opp = Opportunity(
            id=opp_id,
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            opp_no=opp_no,
            name=data["name"],
            lead_id=data.get("lead_id"),
            customer_id=data.get("customer_id"),
            stage=data.get("stage", "PROSPECTING"),
            probability_percent=data.get("probability_percent", 10.0),
            expected_revenue=data.get("expected_revenue", 0.0),
            expected_close_date=data.get("expected_close_date"),
            assigned_to=data.get("assigned_to"),
        )
        self.db.add(opp)
        await self.db.flush()
        return opp

    async def list_opportunities(self) -> List[Opportunity]:
        stmt = select(Opportunity).where(Opportunity.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(Opportunity.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ---------------------------------------------------------------------------
    # Campaign Management (Task C-3 / C-7)
    # ---------------------------------------------------------------------------

    async def create_campaign(self, data: dict) -> Campaign:
        cmp_id = f"CMP-{uuid.uuid4().hex[:8]}"
        cmp_no = f"CMP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        cmp = Campaign(
            id=cmp_id,
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            campaign_no=cmp_no,
            name=data["name"],
            campaign_type=data.get("campaign_type", "EMAIL"),
            status=data.get("status", "PLANNING"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            budget=data.get("budget", 0.0),
            actual_cost=data.get("actual_cost", 0.0),
        )
        self.db.add(cmp)
        await self.db.flush()
        return cmp

    async def list_campaigns(self) -> List[Campaign]:
        stmt = select(Campaign).where(Campaign.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(Campaign.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ---------------------------------------------------------------------------
    # Support Ticket Management (Task C-4 / C-8)
    # ---------------------------------------------------------------------------

    async def create_support_ticket(self, data: dict) -> SupportTicket:
        ticket_id = f"TCK-{uuid.uuid4().hex[:8]}"
        ticket_no = f"TCK-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        ticket = SupportTicket(
            id=ticket_id,
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            ticket_no=ticket_no,
            customer_id=data["customer_id"],
            subject=data["subject"],
            category=data.get("category", "PRODUCT"),
            priority=data.get("priority", "MEDIUM"),
            status="OPEN",
            assigned_to=data.get("assigned_to"),
        )
        self.db.add(ticket)
        await self.db.flush()
        return ticket

    async def list_support_tickets(self) -> List[SupportTicket]:
        stmt = select(SupportTicket).where(SupportTicket.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(SupportTicket.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add_ticket_comment(self, ticket_id: str, author_name: str, comment_text: str, is_internal: bool = False) -> TicketComment:
        cmt_id = f"CMT-{uuid.uuid4().hex[:8]}"
        comment = TicketComment(
            id=cmt_id,
            uuid=str(uuid.uuid4()),
            ticket_id=ticket_id,
            author_name=author_name,
            comment_text=comment_text,
            is_internal=is_internal,
        )
        self.db.add(comment)
        await self.db.flush()
        return comment

