"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
from typing import Any, Dict, Optional, Union
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..api.deps import TenantContext
from ..models.crm import (
    Customer,
    CustomerGSTRegistration,
    CustomerDeliveryLocation,
    CustomerBillingLocation,
    CustomerExternalIdentity,
)
from ..schemas.crm import (
    DuplicateDecision,
    MatchedIdentityType,
    CustomerDuplicateCheckRequest,
    CustomerDuplicateCheckResponse,
    ExistingCustomerSummary,
    CustomerCreate,
)


class CustomerIdentityService:
    """
    Authoritative Central Customer Identity and Duplicate Protection Engine.

    Enforces deterministic duplicate prevention rules across Customer Master,
    Corporate B2B Billing, Customer APIs, Excel/EDI imports, and external ERP connectors.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def check_duplicate_customer(
        self,
        payload: Union[CustomerDuplicateCheckRequest, CustomerCreate, Dict[str, Any]],
        exclude_customer_id: Optional[str] = None,
    ) -> CustomerDuplicateCheckResponse:
        """
        Evaluate customer creation or update against hard and secondary identity rules.
        """
        if isinstance(payload, dict):
            raw_id = payload.get("id")
            raw_code = payload.get("code")
            raw_name = payload.get("name")
            raw_mobile = payload.get("mobile")
            raw_email = payload.get("email")
            raw_gstin = payload.get("gstin") or payload.get("gst_number") or payload.get("gstNumber")
            raw_ext_code = payload.get("external_code") or payload.get("externalCode")
            raw_ext_source = payload.get("source_system") or payload.get("sourceSystem")
            raw_ext_type = payload.get("external_type") or payload.get("externalType") or "CUSTOMER"
        else:
            raw_id = getattr(payload, "id", None)
            raw_code = getattr(payload, "code", None)
            raw_name = getattr(payload, "name", None)
            raw_mobile = getattr(payload, "mobile", None)
            raw_email = getattr(payload, "email", None)
            raw_gstin = getattr(payload, "gstin", None) or getattr(payload, "gst_number", None)
            raw_ext_code = getattr(payload, "external_code", None)
            raw_ext_source = getattr(payload, "source_system", None)
            raw_ext_type = getattr(payload, "external_type", None) or "CUSTOMER"

        # 1. Check Exact Customer ID Collision (Rule 1)
        if raw_id and str(raw_id).strip():
            clean_id = str(raw_id).strip()
            stmt = select(Customer).filter(
                Customer.id == clean_id,
                Customer.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt = stmt.filter(
                    (Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            existing_id = res.scalars().first()
            if existing_id and existing_id.id != exclude_customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.HARD_DUPLICATE,
                    matched_identity=MatchedIdentityType.CUSTOMER_ID,
                    existing_customer=ExistingCustomerSummary(
                        id=existing_id.id,
                        code=existing_id.code,
                        name=existing_id.name,
                        mobile=existing_id.mobile,
                        email=existing_id.email,
                        gst_number=existing_id.gst_number,
                        status=existing_id.status,
                    ),
                    reason=f"Customer with internal ID '{clean_id}' already exists in the system.",
                    allow_override=False,
                )

        # 2. Check Customer Code Collision within Tenant (Rule 2)
        if raw_code and str(raw_code).strip():
            clean_code = str(raw_code).strip().upper()
            stmt = select(Customer).filter(
                func.upper(Customer.code) == clean_code,
                Customer.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt = stmt.filter(
                    (Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            existing_code = res.scalars().first()
            if existing_code and existing_code.id != exclude_customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.HARD_DUPLICATE,
                    matched_identity=MatchedIdentityType.CUSTOMER_CODE,
                    existing_customer=ExistingCustomerSummary(
                        id=existing_code.id,
                        code=existing_code.code,
                        name=existing_code.name,
                        mobile=existing_code.mobile,
                        email=existing_code.email,
                        gst_number=existing_code.gst_number,
                        status=existing_code.status,
                    ),
                    reason=f"Customer Code '{clean_code}' is already assigned to active customer '{existing_code.name}' ({existing_code.id}).",
                    allow_override=False,
                )

        # 3. Check External Customer Identity Collision (Rule 4)
        if raw_ext_code and raw_ext_source and str(raw_ext_code).strip() and str(raw_ext_source).strip():
            clean_ext_code = str(raw_ext_code).strip()
            clean_ext_source = str(raw_ext_source).strip().upper()
            clean_ext_type = str(raw_ext_type).strip().upper()
            stmt = (
                select(CustomerExternalIdentity, Customer)
                .join(Customer, CustomerExternalIdentity.customer_id == Customer.id)
                .filter(
                    CustomerExternalIdentity.source_system == clean_ext_source,
                    CustomerExternalIdentity.external_type == clean_ext_type,
                    CustomerExternalIdentity.external_code == clean_ext_code,
                    CustomerExternalIdentity.status == "ACTIVE",
                    CustomerExternalIdentity.is_deleted == False,
                )
            )
            if self.tenant_ctx.company_id:
                stmt = stmt.filter(
                    (CustomerExternalIdentity.company_id == self.tenant_ctx.company_id)
                    | (CustomerExternalIdentity.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            ext_row = res.first()
            if ext_row:
                ext_record, ext_customer = ext_row
                if ext_customer.id != exclude_customer_id:
                    return CustomerDuplicateCheckResponse(
                        decision=DuplicateDecision.HARD_DUPLICATE,
                        matched_identity=MatchedIdentityType.EXTERNAL_ID,
                        existing_customer=ExistingCustomerSummary(
                            id=ext_customer.id,
                            code=ext_customer.code,
                            name=ext_customer.name,
                            mobile=ext_customer.mobile,
                            email=ext_customer.email,
                            gst_number=ext_customer.gst_number,
                            status=ext_customer.status,
                        ),
                        reason=f"External identity '{clean_ext_code}' ({clean_ext_source}/{clean_ext_type}) is already mapped to customer '{ext_customer.name}' ({ext_customer.id}).",
                        allow_override=False,
                    )

        # 4. Check Legal Tax Identity (GSTIN) Collision (Rule 3)
        if raw_gstin and str(raw_gstin).strip():
            clean_gstin = str(raw_gstin).strip().upper()
            # Check CustomerGSTRegistration across tenant
            stmt_reg = (
                select(CustomerGSTRegistration, Customer)
                .join(Customer, CustomerGSTRegistration.customer_id == Customer.id)
                .filter(
                    CustomerGSTRegistration.gstin == clean_gstin,
                    CustomerGSTRegistration.status == "ACTIVE",
                    CustomerGSTRegistration.is_deleted == False,
                )
            )
            if self.tenant_ctx.company_id:
                stmt_reg = stmt_reg.filter(
                    (CustomerGSTRegistration.company_id == self.tenant_ctx.company_id)
                    | (CustomerGSTRegistration.company_id.is_(None))
                )
            res_reg = await self.db.execute(stmt_reg)
            reg_row = res_reg.first()
            if reg_row:
                gst_reg, gst_customer = reg_row
                if gst_customer.id != exclude_customer_id:
                    return CustomerDuplicateCheckResponse(
                        decision=DuplicateDecision.HARD_DUPLICATE,
                        matched_identity=MatchedIdentityType.GSTIN,
                        existing_customer=ExistingCustomerSummary(
                            id=gst_customer.id,
                            code=gst_customer.code,
                            name=gst_customer.name,
                            mobile=gst_customer.mobile,
                            email=gst_customer.email,
                            gst_number=gst_customer.gst_number,
                            status=gst_customer.status,
                        ),
                        reason=f"GSTIN '{clean_gstin}' is already registered to customer '{gst_customer.name}' ({gst_customer.id}). A statutory GSTIN cannot belong to multiple distinct customer accounts.",
                        allow_override=False,
                    )

            # Check legacy Customer.gst_number
            stmt_cust_gst = select(Customer).filter(
                func.upper(Customer.gst_number) == clean_gstin,
                Customer.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt_cust_gst = stmt_cust_gst.filter(
                    (Customer.company_id == self.tenant_ctx.company_id)
                    | (Customer.company_id.is_(None))
                )
            res_cust_gst = await self.db.execute(stmt_cust_gst)
            cust_gst = res_cust_gst.scalars().first()
            if cust_gst and cust_gst.id != exclude_customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.HARD_DUPLICATE,
                    matched_identity=MatchedIdentityType.GSTIN,
                    existing_customer=ExistingCustomerSummary(
                        id=cust_gst.id,
                        code=cust_gst.code,
                        name=cust_gst.name,
                        mobile=cust_gst.mobile,
                        email=cust_gst.email,
                        gst_number=cust_gst.gst_number,
                        status=cust_gst.status,
                    ),
                    reason=f"GSTIN '{clean_gstin}' is already recorded on customer '{cust_gst.name}' ({cust_gst.id}).",
                    allow_override=False,
                )

        # 5. Check Secondary Signals: Mobile (Possible Duplicate)
        if raw_mobile and str(raw_mobile).strip():
            clean_mobile = str(raw_mobile).strip()
            digits = re.sub(r"\D", "", clean_mobile)
            if digits:
                last10 = digits[-10:] if len(digits) >= 10 else digits
                stmt_mob = select(Customer).filter(
                    Customer.mobile.like(f"%{last10}"),
                    Customer.is_deleted == False,
                )
                if self.tenant_ctx.company_id:
                    stmt_mob = stmt_mob.filter(
                        (Customer.company_id == self.tenant_ctx.company_id)
                        | (Customer.company_id.is_(None))
                    )
                res_mob = await self.db.execute(stmt_mob)
                mob_cust = res_mob.scalars().first()
                if mob_cust and mob_cust.id != exclude_customer_id:
                    return CustomerDuplicateCheckResponse(
                        decision=DuplicateDecision.POSSIBLE_DUPLICATE,
                        matched_identity=MatchedIdentityType.MOBILE,
                        existing_customer=ExistingCustomerSummary(
                            id=mob_cust.id,
                            code=mob_cust.code,
                            name=mob_cust.name,
                            mobile=mob_cust.mobile,
                            email=mob_cust.email,
                            gst_number=mob_cust.gst_number,
                            status=mob_cust.status,
                        ),
                        reason=f"Mobile number '{clean_mobile}' is already in use by customer '{mob_cust.name}' ({mob_cust.code or mob_cust.id}). Verify if this represents the same customer account.",
                        allow_override=True,
                    )

        # 6. Check Secondary Signals: Email (Possible Duplicate)
        if raw_email and str(raw_email).strip():
            clean_email = str(raw_email).strip().lower()
            stmt_email = select(Customer).filter(
                func.lower(Customer.email) == clean_email,
                Customer.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt_email = stmt_email.filter(
                    (Customer.company_id == self.tenant_ctx.company_id)
                    | (Customer.company_id.is_(None))
                )
            res_email = await self.db.execute(stmt_email)
            email_cust = res_email.scalars().first()
            if email_cust and email_cust.id != exclude_customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.POSSIBLE_DUPLICATE,
                    matched_identity=MatchedIdentityType.EMAIL,
                    existing_customer=ExistingCustomerSummary(
                        id=email_cust.id,
                        code=email_cust.code,
                        name=email_cust.name,
                        mobile=email_cust.mobile,
                        email=email_cust.email,
                        gst_number=email_cust.gst_number,
                        status=email_cust.status,
                    ),
                    reason=f"Email address '{clean_email}' is already in use by customer '{email_cust.name}' ({email_cust.code or email_cust.id}).",
                    allow_override=True,
                )

        # 7. Check Secondary Signals: Exact Legal Name (Possible Duplicate)
        if raw_name and str(raw_name).strip():
            clean_name = str(raw_name).strip().lower()
            stmt_name = select(Customer).filter(
                func.lower(Customer.name) == clean_name,
                Customer.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt_name = stmt_name.filter(
                    (Customer.company_id == self.tenant_ctx.company_id)
                    | (Customer.company_id.is_(None))
                )
            res_name = await self.db.execute(stmt_name)
            name_cust = res_name.scalars().first()
            if name_cust and name_cust.id != exclude_customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.POSSIBLE_DUPLICATE,
                    matched_identity=MatchedIdentityType.NAME,
                    existing_customer=ExistingCustomerSummary(
                        id=name_cust.id,
                        code=name_cust.code,
                        name=name_cust.name,
                        mobile=name_cust.mobile,
                        email=name_cust.email,
                        gst_number=name_cust.gst_number,
                        status=name_cust.status,
                    ),
                    reason=f"A customer with identical legal name '{name_cust.name}' already exists ({name_cust.code or name_cust.id}).",
                    allow_override=True,
                )

        return CustomerDuplicateCheckResponse(
            decision=DuplicateDecision.ALLOW,
            reason="No duplicate customer identity detected.",
            allow_override=False,
        )

    async def check_duplicate_gst_registration(
        self,
        customer_id: str,
        gstin: str,
        exclude_reg_id: Optional[str] = None,
    ) -> CustomerDuplicateCheckResponse:
        """
        Evaluate GST registration against customer ownership and cross-customer collision rules.
        """
        clean_gstin = gstin.strip().upper()

        # Check 1: Same Customer + Same GSTIN -> Duplicate Registration Block
        stmt_same = select(CustomerGSTRegistration).filter(
            CustomerGSTRegistration.customer_id == customer_id,
            CustomerGSTRegistration.gstin == clean_gstin,
            CustomerGSTRegistration.is_deleted == False,
        )
        if exclude_reg_id:
            stmt_same = stmt_same.filter(CustomerGSTRegistration.id != exclude_reg_id)
        res_same = await self.db.execute(stmt_same)
        if res_same.scalars().first():
            return CustomerDuplicateCheckResponse(
                decision=DuplicateDecision.HARD_DUPLICATE,
                matched_identity=MatchedIdentityType.GSTIN,
                reason=f"GSTIN '{clean_gstin}' is already registered for this customer account.",
                allow_override=False,
            )

        # Check 2: Different Customer + Same GSTIN -> Hard Duplicate Collision
        stmt_other = (
            select(CustomerGSTRegistration, Customer)
            .join(Customer, CustomerGSTRegistration.customer_id == Customer.id)
            .filter(
                CustomerGSTRegistration.gstin == clean_gstin,
                CustomerGSTRegistration.customer_id != customer_id,
                CustomerGSTRegistration.status == "ACTIVE",
                CustomerGSTRegistration.is_deleted == False,
            )
        )
        if self.tenant_ctx.company_id:
            stmt_other = stmt_other.filter(
                (CustomerGSTRegistration.company_id == self.tenant_ctx.company_id)
                | (CustomerGSTRegistration.company_id.is_(None))
            )
        res_other = await self.db.execute(stmt_other)
        row = res_other.first()
        if row:
            other_reg, other_cust = row
            return CustomerDuplicateCheckResponse(
                decision=DuplicateDecision.HARD_DUPLICATE,
                matched_identity=MatchedIdentityType.GSTIN,
                existing_customer=ExistingCustomerSummary(
                    id=other_cust.id,
                    code=other_cust.code,
                    name=other_cust.name,
                    mobile=other_cust.mobile,
                    email=other_cust.email,
                    gst_number=other_cust.gst_number,
                    status=other_cust.status,
                ),
                reason=f"GSTIN '{clean_gstin}' is already registered to another customer '{other_cust.name}' ({other_cust.id}). Cross-customer GSTIN sharing is prohibited.",
                allow_override=False,
            )

        return CustomerDuplicateCheckResponse(
            decision=DuplicateDecision.ALLOW,
            reason="GSTIN is valid and unique.",
            allow_override=False,
        )

    async def check_duplicate_delivery_location(
        self,
        customer_id: str,
        store_code: str,
        address_line1: Optional[str] = None,
        gstin: Optional[str] = None,
        exclude_loc_id: Optional[str] = None,
    ) -> CustomerDuplicateCheckResponse:
        """
        Evaluate CustomerDeliveryLocation against store code duplicate rules.
        """
        clean_code = store_code.strip().upper()

        # Check 1: Same Customer + Same Active Store Code -> Hard Duplicate
        stmt_code = select(CustomerDeliveryLocation).filter(
            CustomerDeliveryLocation.customer_id == customer_id,
            CustomerDeliveryLocation.store_code == clean_code,
            CustomerDeliveryLocation.status == "ACTIVE",
            CustomerDeliveryLocation.is_deleted == False,
        )
        if exclude_loc_id:
            stmt_code = stmt_code.filter(CustomerDeliveryLocation.id != exclude_loc_id)
        res_code = await self.db.execute(stmt_code)
        if res_code.scalars().first():
            return CustomerDuplicateCheckResponse(
                decision=DuplicateDecision.HARD_DUPLICATE,
                matched_identity=MatchedIdentityType.STORE_CODE,
                reason=f"Store code '{clean_code}' is already an active delivery location for this customer.",
                allow_override=False,
            )

        # Check 2: Same Address on Different Store Code -> Possible Duplicate Warning
        if address_line1 and str(address_line1).strip():
            clean_addr = str(address_line1).strip().lower()
            stmt_addr = select(CustomerDeliveryLocation).filter(
                CustomerDeliveryLocation.customer_id == customer_id,
                func.lower(CustomerDeliveryLocation.address_line1) == clean_addr,
                CustomerDeliveryLocation.status == "ACTIVE",
                CustomerDeliveryLocation.is_deleted == False,
            )
            if exclude_loc_id:
                stmt_addr = stmt_addr.filter(CustomerDeliveryLocation.id != exclude_loc_id)
            res_addr = await self.db.execute(stmt_addr)
            existing_loc = res_addr.scalars().first()
            if existing_loc:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.POSSIBLE_DUPLICATE,
                    matched_identity=MatchedIdentityType.STORE_CODE,
                    reason=f"A delivery location with identical address line already exists under store code '{existing_loc.store_code}'. Verify if this is an intentional separate store at the same site.",
                    allow_override=True,
                )

        return CustomerDuplicateCheckResponse(
            decision=DuplicateDecision.ALLOW,
            reason="Store code and delivery location are valid.",
            allow_override=False,
        )

    async def check_duplicate_billing_location(
        self,
        customer_id: str,
        billing_store_code: str,
        exclude_loc_id: Optional[str] = None,
    ) -> CustomerDuplicateCheckResponse:
        """
        Evaluate CustomerBillingLocation against billing store code duplicate rules.
        """
        clean_code = billing_store_code.strip().upper()

        stmt = select(CustomerBillingLocation).filter(
            CustomerBillingLocation.customer_id == customer_id,
            CustomerBillingLocation.billing_store_code == clean_code,
            CustomerBillingLocation.status == "ACTIVE",
            CustomerBillingLocation.is_deleted == False,
        )
        if exclude_loc_id:
            stmt = stmt.filter(CustomerBillingLocation.id != exclude_loc_id)

        res = await self.db.execute(stmt)
        if res.scalars().first():
            return CustomerDuplicateCheckResponse(
                decision=DuplicateDecision.HARD_DUPLICATE,
                matched_identity=MatchedIdentityType.STORE_CODE,
                reason=f"Billing store code '{clean_code}' is already an active billing location for this customer.",
                allow_override=False,
            )

        return CustomerDuplicateCheckResponse(
            decision=DuplicateDecision.ALLOW,
            reason="Billing store code is valid.",
            allow_override=False,
        )

    async def check_duplicate_external_identity(
        self,
        customer_id: Optional[str] = None,
        source_system: str = "",
        external_type: str = "CUSTOMER",
        external_code: str = "",
        exclude_id: Optional[str] = None,
    ) -> CustomerDuplicateCheckResponse:
        """
        Evaluate external ERP identity against composite uniqueness rules.
        """
        clean_code = external_code.strip()
        clean_source = source_system.strip().upper()
        clean_type = external_type.strip().upper()

        stmt = (
            select(CustomerExternalIdentity, Customer)
            .join(Customer, CustomerExternalIdentity.customer_id == Customer.id)
            .filter(
                CustomerExternalIdentity.source_system == clean_source,
                CustomerExternalIdentity.external_type == clean_type,
                CustomerExternalIdentity.external_code == clean_code,
                CustomerExternalIdentity.status == "ACTIVE",
                CustomerExternalIdentity.is_deleted == False,
            )
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter(
                (CustomerExternalIdentity.company_id == self.tenant_ctx.company_id)
                | (CustomerExternalIdentity.company_id.is_(None))
            )
        if exclude_id:
            stmt = stmt.filter(CustomerExternalIdentity.id != exclude_id)

        res = await self.db.execute(stmt)
        row = res.first()
        if row:
            rec, cust = row
            if not customer_id or cust.id != customer_id:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.HARD_DUPLICATE,
                    matched_identity=MatchedIdentityType.EXTERNAL_ID,
                    existing_customer=ExistingCustomerSummary(
                        id=cust.id,
                        code=cust.code,
                        name=cust.name,
                        mobile=cust.mobile,
                        email=cust.email,
                        gst_number=cust.gst_number,
                        status=cust.status,
                    ),
                    reason=f"External identity '{clean_code}' ({clean_source}/{clean_type}) is already assigned to customer '{cust.name}' ({cust.id}).",
                    allow_override=False,
                )
            else:
                return CustomerDuplicateCheckResponse(
                    decision=DuplicateDecision.HARD_DUPLICATE,
                    matched_identity=MatchedIdentityType.EXTERNAL_ID,
                    reason=f"External identity '{clean_code}' ({clean_source}/{clean_type}) is already registered for this customer account.",
                    allow_override=False,
                )

        return CustomerDuplicateCheckResponse(
            decision=DuplicateDecision.ALLOW,
            reason="External identity is valid and unique.",
            allow_override=False,
        )
