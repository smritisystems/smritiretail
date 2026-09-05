"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.crm import (
    Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation,
    CustomerBillingLocation, CustomerExternalIdentity,
)
from ..models.sales import SalesInvoice
from ..schemas.crm import (
    CustomerCreate, CustomerUpdate, CustomerGroupCreate,
    CustomerGSTRegistrationCreate, CustomerGSTRegistrationUpdate,
    CustomerDeliveryLocationCreate, CustomerDeliveryLocationUpdate,
    CustomerBillingLocationCreate, CustomerBillingLocationUpdate,
    CustomerExternalIdentityCreate,
    DuplicateDecision, MatchedIdentityType, CustomerDuplicateCheckResponse,
    CustomerDuplicateCheckRequest,
)
from ..repositories.customer import (
    CustomerRepository, CustomerGroupRepository,
    CustomerGSTRegistrationRepository, CustomerDeliveryLocationRepository,
    CustomerBillingLocationRepository, CustomerExternalIdentityRepository,
)
from .customer_identity import CustomerIdentityService
from ..api.deps import TenantContext

class CrmService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.customer_repo = CustomerRepository(db, tenant_ctx)
        self.gst_repo = CustomerGSTRegistrationRepository(db, tenant_ctx)
        self.delivery_repo = CustomerDeliveryLocationRepository(db, tenant_ctx)
        self.billing_repo = CustomerBillingLocationRepository(db, tenant_ctx)
        self.ext_ident_repo = CustomerExternalIdentityRepository(db, tenant_ctx)
        self.identity_service = CustomerIdentityService(db, tenant_ctx)

    async def create_customer_group(self, group_in: CustomerGroupCreate) -> CustomerGroup:
        # Check for duplicate name
        existing = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.name == group_in.name,
                CustomerGroup.is_deleted == False,
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Customer group with this name already exists")
        
        grp_dict = group_in.model_dump()
        if not grp_dict.get("id"):
            import uuid
            grp_dict["id"] = f"cg-{uuid.uuid4().hex[:8]}"
        
        db_group = CustomerGroup(
            **grp_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "customer_groups_name_key" in err_msg or "name" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this name already exists")
            elif "customer_groups_pkey" in err_msg or "id" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this ID already exists")
            elif "branch_id" in err_msg or "company_id" in err_msg:
                raise HTTPException(status_code=400, detail="Specified company or branch does not exist")
            else:
                raise HTTPException(status_code=400, detail="Customer group could not be created due to database integrity constraints")
        await self.db.refresh(db_group)
        return db_group

    async def create_customer(self, customer_in: CustomerCreate) -> Customer:
        # Centralized Authoritative Duplicate Check
        dup_check = await self.identity_service.check_duplicate_customer(customer_in)
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_CUSTOMER",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )
        elif dup_check.decision == DuplicateDecision.POSSIBLE_DUPLICATE:
            if not getattr(customer_in, "allow_duplicate_override", False):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error_code": "POSSIBLE_DUPLICATE_CUSTOMER",
                        "decision": dup_check.decision.value,
                        "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                        "reason": dup_check.reason,
                        "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                        "allow_override": True,
                    }
                )

        cust_dict = customer_in.model_dump()

        # Validate customer group exists if specified
        if customer_in.customer_group_id:
            stmt = select(CustomerGroup).filter(
                CustomerGroup.id == customer_in.customer_group_id,
                CustomerGroup.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt = stmt.filter(
                    (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            group = res.scalars().first()
            if not group:
                cust_dict["customer_group_id"] = None

        if not cust_dict.get("id"):
            import uuid
            cust_dict["id"] = f"cust-{uuid.uuid4().hex[:8]}"
        if not cust_dict.get("code"):
            import uuid
            cust_dict["code"] = f"CUST-{uuid.uuid4().hex[:8].upper()}"

        # Clean virtual policy and control fields before database column instantiation
        cust_dict.pop("credit_limit", None)
        cust_dict.pop("credit_days", None)
        cust_dict.pop("unlimited_credit", None)
        cust_dict.pop("credit_hold", None)
        cust_dict.pop("allow_duplicate_override", None)

        db_customer = Customer(
            **cust_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_customer)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer could not be created due to database integrity constraints or race-condition conflict."
            )
        # Eagerly load customer with group relationship before returning for response serialization
        refreshed = await self.get_customer(db_customer.id)
        return refreshed or db_customer

    async def update_customer(self, customer_id: str, customer_in: CustomerUpdate | CustomerCreate | dict) -> Customer:
        stmt = select(Customer).options(selectinload(Customer.group)).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()

        data_dict = customer_in.model_dump(exclude_unset=True) if hasattr(customer_in, "model_dump") else dict(customer_in)

        if not customer:
            # Upsert create if not found
            create_payload = {**data_dict, "id": customer_id}
            if not create_payload.get("name"):
                create_payload["name"] = f"Customer {customer_id}"
            return await self.create_customer(CustomerCreate(**create_payload))

        for k, v in data_dict.items():
            if v is not None and hasattr(customer, k):
                setattr(customer, k, v)

        customer.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self.get_customer(customer.id)
        return refreshed or customer

    async def delete_customer(self, customer_id: str) -> bool:
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer.is_deleted = True
        customer.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.group),
                selectinload(Customer.gst_registrations),
                selectinload(Customer.delivery_locations),
                selectinload(Customer.billing_locations),
                selectinload(Customer.external_identities),
            )
            .filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
            )
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        if self.tenant_ctx.branch_id:
            stmt = stmt.filter((Customer.branch_id == self.tenant_ctx.branch_id) | (Customer.branch_id.is_(None)))
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def check_credit_limit(self, customer_id: str, new_amount: float) -> bool:
        if customer_id == "CUST-WALKIN":
            return True

        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        group_stmt = select(CustomerGroup).filter(
            CustomerGroup.id == customer.customer_group_id,
            CustomerGroup.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            group_stmt = group_stmt.filter(
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        group_res = await self.db.execute(group_stmt)
        group = group_res.scalars().first()
        if not group:
            return True # No group limits
            
        if getattr(group, "credit_hold", False):
            raise HTTPException(
                status_code=400,
                detail="SMRITI-CREDIT-002: Customer account is on credit hold. Invoicing blocked."
            )

        if getattr(group, "unlimited_credit", False):
            return True
            
        # Assert outstanding + new purchase is within limit
        limit = float(getattr(group, "credit_limit", 0.0) or 0.0)
        current_outstanding = float(customer.outstanding or 0.0)
        if limit > 0 and (current_outstanding + new_amount > limit):
            if getattr(group, "auto_block_sales", True):
                raise HTTPException(
                    status_code=400, 
                    detail=f"SMRITI-CREDIT-001: Customer credit limit of ₹{limit:,.2f} exceeded. Current Balance: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_amount:,.2f}. Sales blocked."
                )
            return False # Limit warning
        return True

    async def _record_audit_event(
        self,
        event_type: str,
        table_name: str,
        record_id: str,
        details: Dict[str, Any],
        reason: Optional[str] = None,
    ):
        logger = logging.getLogger("smriti.crm.audit")
        logger.info(f"AUDIT [{event_type}] table={table_name} id={record_id} details={details}")
        try:
            from ..models.security import SmritiAuditLog
            async with self.db.begin_nested():
                audit_entry = SmritiAuditLog(
                    id=f"aud-{uuid.uuid4().hex[:8]}",
                    tenant_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
                    changed_table=table_name,
                    changed_record_id=record_id,
                    change_type=event_type,
                    change_reason=reason or json.dumps(details),
                    change_source="CRM_API",
                    changed_at=datetime.now(timezone.utc),
                )
                self.db.add(audit_entry)
                await self.db.flush()
        except Exception as e:
            logger.debug(f"Could not persist SmritiAuditLog record: {e}")

    # --- Customer GST Registration Methods ---

    async def list_gst_registrations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerGSTRegistration]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.gst_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> CustomerGSTRegistration:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        reg = await self.gst_repo.get_by_customer_and_id(customer_id, reg_id)
        if not reg:
            raise HTTPException(status_code=404, detail=f"Customer GST registration '{reg_id}' not found.")
        return reg

    async def create_gst_registration(
        self, customer_id: str, reg_in: CustomerGSTRegistrationCreate
    ) -> CustomerGSTRegistration:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        normalized_gstin = reg_in.gstin.strip().upper()

        # Centralized Duplicate Protection (Same customer duplicate OR different customer collision)
        dup_check = await self.identity_service.check_duplicate_gst_registration(customer_id, normalized_gstin)
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_GSTIN",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )

        if reg_in.is_primary:
            await self.gst_repo.clear_primary_flags(customer_id)
            customer.gst_number = normalized_gstin

        reg_id = reg_in.id or f"cgr-{uuid.uuid4().hex[:8]}"
        db_reg = CustomerGSTRegistration(
            id=reg_id,
            customer_id=customer_id,
            gstin=normalized_gstin,
            state_name=reg_in.state_name.strip(),
            state_code=reg_in.state_code.strip(),
            registration_type=reg_in.registration_type or "REGULAR",
            is_primary=bool(reg_in.is_primary),
            status=reg_in.status or "ACTIVE",
            remarks=reg_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_active=True,
            is_deleted=False,
        )
        self.db.add(db_reg)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer GST registration could not be created due to database integrity constraints or race condition."
            )

        await self.db.refresh(db_reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationCreated",
            "customer_gst_registrations",
            db_reg.id,
            {"gstin": normalized_gstin, "state_code": db_reg.state_code, "is_primary": db_reg.is_primary}
        )
        if db_reg.is_primary:
            await self._record_audit_event(
                "CustomerGSTRegistrationPrimaryChanged",
                "customer_gst_registrations",
                db_reg.id,
                {"gstin": normalized_gstin}
            )
        return db_reg

    async def update_gst_registration(
        self, customer_id: str, reg_id: str, reg_in: CustomerGSTRegistrationUpdate
    ) -> CustomerGSTRegistration:
        reg = await self.get_gst_registration(customer_id, reg_id)
        customer = await self.get_customer(customer_id)

        changes = {}
        if reg_in.gstin:
            new_gstin = reg_in.gstin.strip().upper()
            if new_gstin != reg.gstin:
                existing = await self.gst_repo.get_by_customer_and_gstin(customer_id, new_gstin, include_deleted=False)
                if existing and existing.id != reg_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"GSTIN '{new_gstin}' is already registered for this customer."
                    )
                changes["gstin"] = {"old": reg.gstin, "new": new_gstin}
                reg.gstin = new_gstin
                if reg.is_primary and customer:
                    customer.gst_number = new_gstin

        if reg_in.state_code:
            target_sc = reg_in.state_code.strip()
            if reg.gstin and reg.gstin[:2] != target_sc:
                raise HTTPException(
                    status_code=400,
                    detail=f"GSTIN prefix '{reg.gstin[:2]}' does not match updated state code '{target_sc}'."
                )
            changes["state_code"] = {"old": reg.state_code, "new": target_sc}
            reg.state_code = target_sc

        if reg_in.state_name:
            reg.state_name = reg_in.state_name.strip()
        if reg_in.registration_type:
            reg.registration_type = reg_in.registration_type
        if reg_in.remarks is not None:
            reg.remarks = reg_in.remarks

        if reg_in.is_primary is True and not reg.is_primary:
            await self.gst_repo.clear_primary_flags(customer_id, exclude_id=reg_id)
            reg.is_primary = True
            if customer:
                customer.gst_number = reg.gstin
            await self._record_audit_event(
                "CustomerGSTRegistrationPrimaryChanged",
                "customer_gst_registrations",
                reg.id,
                {"gstin": reg.gstin}
            )

        if reg_in.status:
            status_val = reg_in.status.upper()
            reg.status = status_val
            if status_val in ("CANCELLED", "SURRENDERED"):
                reg.is_active = False
                if reg.is_primary:
                    reg.is_primary = False
            elif status_val == "ACTIVE":
                reg.is_active = True

        reg.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationUpdated",
            "customer_gst_registrations",
            reg.id,
            {"changes": changes, "is_primary": reg.is_primary, "status": reg.status}
        )
        return reg

    async def set_primary_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> CustomerGSTRegistration:
        reg = await self.get_gst_registration(customer_id, reg_id)
        customer = await self.get_customer(customer_id)
        if not reg.is_active or reg.is_deleted or reg.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive or cancelled GST registration as primary."
            )

        await self.gst_repo.clear_primary_flags(customer_id, exclude_id=reg_id)
        reg.is_primary = True
        reg.modified_at = datetime.now(timezone.utc)
        if customer:
            customer.gst_number = reg.gstin

        await self.db.commit()
        await self.db.refresh(reg)
        await self._record_audit_event(
            "CustomerGSTRegistrationPrimaryChanged",
            "customer_gst_registrations",
            reg.id,
            {"gstin": reg.gstin}
        )
        return reg

    async def delete_gst_registration(
        self, customer_id: str, reg_id: str
    ) -> Dict[str, str]:
        reg = await self.get_gst_registration(customer_id, reg_id)
        # Check if referenced by issued invoices
        stmt = select(func.count()).select_from(SalesInvoice).filter(SalesInvoice.billed_party_gstin_id == reg_id)
        res = await self.db.execute(stmt)
        inv_count = res.scalar() or 0

        # Project lifecycle soft-delete
        reg.is_deleted = True
        reg.is_active = False
        reg.status = "CANCELLED"
        reg.deleted_at = datetime.now(timezone.utc)
        if reg.is_primary:
            reg.is_primary = False

        await self.db.commit()
        await self._record_audit_event(
            "CustomerGSTRegistrationDeactivated",
            "customer_gst_registrations",
            reg_id,
            {"invoice_references": inv_count}
        )
        return {"status": "success", "message": f"Customer GST registration '{reg_id}' deactivated."}

    # --- Customer Delivery Location Methods ---

    async def list_delivery_locations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerDeliveryLocation]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.delivery_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_delivery_location(
        self, customer_id: str, location_id: str
    ) -> CustomerDeliveryLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        loc = await self.delivery_repo.get_by_customer_and_id(customer_id, location_id)
        if not loc:
            raise HTTPException(status_code=404, detail=f"Customer delivery location '{location_id}' not found.")
        return loc

    async def create_delivery_location(
        self, customer_id: str, loc_in: CustomerDeliveryLocationCreate
    ) -> CustomerDeliveryLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        store_code = loc_in.store_code.strip().upper()
        location_name = loc_in.location_name.strip()

        # Centralized Duplicate Protection (Same customer + same store code -> hard duplicate)
        dup_check = await self.identity_service.check_duplicate_delivery_location(
            customer_id=customer_id,
            store_code=store_code,
            address_line1=loc_in.address_line1,
        )
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_STORE_CODE",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "allow_override": False,
                }
            )

        if loc_in.is_default:
            await self.delivery_repo.clear_default_flags(customer_id)

        resolved_gstin = loc_in.gstin.strip().upper() if loc_in.gstin else None
        target_state_code = loc_in.state_code.strip() if loc_in.state_code else None
        target_state = loc_in.state.strip() if loc_in.state else None

        if loc_in.gst_registration_id:
            gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
            if not gst_reg:
                raise HTTPException(
                    status_code=400,
                    detail="GST registration does not belong to this customer or does not exist."
                )
            if not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected GST registration is inactive or cancelled."
                )
            if resolved_gstin:
                if resolved_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{resolved_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
            else:
                resolved_gstin = gst_reg.gstin

            if target_state_code and target_state_code != gst_reg.state_code:
                raise HTTPException(
                    status_code=400,
                    detail=f"Conflicting state code: delivery location state code '{target_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                )
            if not target_state_code:
                target_state_code = gst_reg.state_code
            if not target_state:
                target_state = gst_reg.state_name
        elif resolved_gstin:
            if target_state_code and resolved_gstin[:2] != target_state_code:
                raise HTTPException(
                    status_code=400,
                    detail=f"Delivery GSTIN prefix '{resolved_gstin[:2]}' does not match state_code '{target_state_code}'."
                )

        loc_id = loc_in.id or f"cdl-{uuid.uuid4().hex[:8]}"
        db_loc = CustomerDeliveryLocation(
            id=loc_id,
            customer_id=customer_id,
            store_code=store_code,
            location_name=location_name,
            address_line1=loc_in.address_line1,
            address_line2=loc_in.address_line2,
            city=loc_in.city,
            state=target_state,
            state_code=target_state_code,
            pincode=loc_in.pincode,
            country=loc_in.country or "India",
            gst_registration_id=loc_in.gst_registration_id,
            gstin=resolved_gstin,
            contact_person=loc_in.contact_person,
            phone=loc_in.phone,
            email=loc_in.email,
            is_default=bool(loc_in.is_default),
            status=loc_in.status or "ACTIVE",
            source=loc_in.source or "MANUAL",
            remarks=loc_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_active=True,
            is_deleted=False,
        )
        self.db.add(db_loc)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer delivery location could not be created due to duplicate store code or database integrity constraints."
            )

        refreshed = await self.delivery_repo.get(db_loc.id)
        await self._record_audit_event(
            "CustomerDeliveryLocationCreated",
            "customer_delivery_locations",
            db_loc.id,
            {"store_code": store_code, "location_name": location_name, "gstin": resolved_gstin}
        )
        return refreshed or db_loc

    async def update_delivery_location(
        self, customer_id: str, location_id: str, loc_in: CustomerDeliveryLocationUpdate
    ) -> CustomerDeliveryLocation:
        loc = await self.get_delivery_location(customer_id, location_id)

        if loc_in.store_code:
            new_code = loc_in.store_code.strip().upper()
            if new_code != loc.store_code:
                existing = await self.delivery_repo.get_by_customer_and_store_code(customer_id, new_code, active_only=True)
                if existing and existing.id != location_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery location with store code '{new_code}' already exists for this customer."
                    )
                old_code = loc.store_code
                loc.store_code = new_code
                await self._record_audit_event(
                    "StoreCodeChanged",
                    "customer_delivery_locations",
                    location_id,
                    {"old_store_code": old_code, "new_store_code": new_code}
                )

        if loc_in.gst_registration_id is not None:
            if loc_in.gst_registration_id == "":
                loc.gst_registration_id = None
            else:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
                if not gst_reg:
                    raise HTTPException(
                        status_code=400,
                        detail="GST registration does not belong to this customer or does not exist."
                    )
                if not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                    raise HTTPException(
                        status_code=400,
                        detail="Selected GST registration is inactive or cancelled."
                    )
                loc.gst_registration_id = loc_in.gst_registration_id
                target_gstin = loc_in.gstin.strip().upper() if loc_in.gstin and loc_in.gstin.strip() else gst_reg.gstin
                if target_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{target_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
                target_state_code = loc_in.state_code.strip() if loc_in.state_code and loc_in.state_code.strip() else (loc.state_code or gst_reg.state_code)
                if target_state_code and target_state_code != gst_reg.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting state code: delivery location state code '{target_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                    )
                if loc.gstin != gst_reg.gstin:
                    old_gst = loc.gstin
                    loc.gstin = gst_reg.gstin
                    await self._record_audit_event(
                        "DeliveryGSTINChanged",
                        "customer_delivery_locations",
                        location_id,
                        {"old_gstin": old_gst, "new_gstin": gst_reg.gstin}
                    )
        elif loc_in.gstin is not None:
            input_gstin = loc_in.gstin.strip().upper() if loc_in.gstin.strip() else None
            if loc.gst_registration_id and input_gstin:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc.gst_registration_id)
                if gst_reg and input_gstin != gst_reg.gstin:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting GSTIN: delivery location GSTIN '{input_gstin}' does not match linked customer GST registration GSTIN '{gst_reg.gstin}'."
                    )
            target_state_code = loc_in.state_code.strip() if loc_in.state_code else loc.state_code
            if input_gstin and target_state_code:
                if input_gstin[:2] != target_state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery GSTIN prefix '{input_gstin[:2]}' does not match state_code '{target_state_code}'."
                    )
            if loc.gstin != input_gstin:
                old_gst = loc.gstin
                loc.gstin = input_gstin
                await self._record_audit_event(
                    "DeliveryGSTINChanged",
                    "customer_delivery_locations",
                    location_id,
                    {"old_gstin": old_gst, "new_gstin": input_gstin}
                )
        elif loc_in.state_code is not None:
            new_state_code = loc_in.state_code.strip() if loc_in.state_code else None
            if loc.gst_registration_id and new_state_code:
                gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc.gst_registration_id)
                if gst_reg and new_state_code != gst_reg.state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflicting state code: delivery location state code '{new_state_code}' does not match linked customer GST registration state code '{gst_reg.state_code}'."
                    )
            elif loc.gstin and new_state_code:
                if loc.gstin[:2] != new_state_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Delivery state_code '{new_state_code}' does not match existing GSTIN prefix '{loc.gstin[:2]}'."
                    )

        if loc_in.location_name:
            loc.location_name = loc_in.location_name.strip()
        if loc_in.address_line1 is not None:
            loc.address_line1 = loc_in.address_line1
        if loc_in.address_line2 is not None:
            loc.address_line2 = loc_in.address_line2
        if loc_in.city is not None:
            loc.city = loc_in.city
        if loc_in.state is not None:
            loc.state = loc_in.state
        if loc_in.state_code is not None:
            loc.state_code = loc_in.state_code
        if loc_in.pincode is not None:
            loc.pincode = loc_in.pincode
        if loc_in.country is not None:
            loc.country = loc_in.country
        if loc_in.contact_person is not None:
            loc.contact_person = loc_in.contact_person
        if loc_in.phone is not None:
            loc.phone = loc_in.phone
        if loc_in.email is not None:
            loc.email = loc_in.email
        if loc_in.remarks is not None:
            loc.remarks = loc_in.remarks

        if loc_in.status:
            status_val = loc_in.status.upper()
            loc.status = status_val
            if status_val == "INACTIVE":
                loc.is_active = False
            elif status_val == "ACTIVE":
                loc.is_active = True

        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self.delivery_repo.get(loc.id)
        await self._record_audit_event(
            "CustomerDeliveryLocationUpdated",
            "customer_delivery_locations",
            location_id,
            {"updated_fields": list(loc_in.model_dump(exclude_unset=True).keys())}
        )
        return refreshed or loc

    async def delete_delivery_location(
        self, customer_id: str, location_id: str
    ) -> Dict[str, str]:
        loc = await self.get_delivery_location(customer_id, location_id)
        # Check if referenced by issued invoices
        stmt = select(func.count()).select_from(SalesInvoice).filter(SalesInvoice.delivery_location_id == location_id)
        res = await self.db.execute(stmt)
        inv_count = res.scalar() or 0

        loc.is_deleted = True
        loc.is_active = False
        loc.status = "INACTIVE"
        loc.deleted_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self._record_audit_event(
            "CustomerDeliveryLocationDeactivated",
            "customer_delivery_locations",
            location_id,
            {"invoice_references": inv_count}
        )
        return {"status": "success", "message": f"Customer delivery location '{location_id}' deactivated."}

    async def search_delivery_locations(
        self,
        q: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[CustomerDeliveryLocation]:
        return await self.delivery_repo.search(q=q, customer_id=customer_id, skip=skip, limit=limit)

    async def set_default_delivery_location(
        self, customer_id: str, location_id: str
    ) -> CustomerDeliveryLocation:
        loc = await self.get_delivery_location(customer_id, location_id)
        if not loc.is_active or loc.is_deleted or loc.status != "ACTIVE":
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive delivery location as default."
            )
        await self.delivery_repo.clear_default_flags(customer_id, exclude_id=location_id)
        loc.is_default = True
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(loc)
        await self._record_audit_event(
            "CustomerDeliveryLocationDefaultChanged",
            "customer_delivery_locations",
            loc.id,
            {"store_code": loc.store_code}
        )
        return loc

    # --- Customer Billing Location Methods ---

    async def list_billing_locations(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerBillingLocation]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.billing_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def get_billing_location(
        self, customer_id: str, location_id: str
    ) -> CustomerBillingLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        loc = await self.billing_repo.get_by_customer_and_id(customer_id, location_id)
        if not loc:
            raise HTTPException(status_code=404, detail=f"Customer billing location '{location_id}' not found.")
        return loc

    async def create_billing_location(
        self, customer_id: str, loc_in: CustomerBillingLocationCreate
    ) -> CustomerBillingLocation:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        billing_store_code = loc_in.billing_store_code.strip().upper()

        # Check duplicate billing store code for customer
        dup_check = await self.identity_service.check_duplicate_billing_location(
            customer_id=customer_id,
            billing_store_code=billing_store_code,
        )
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_BILLING_STORE_CODE",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "allow_override": False,
                }
            )

        if loc_in.is_default:
            await self.billing_repo.clear_default_flags(customer_id)

        if loc_in.gst_registration_id:
            gst_reg = await self.gst_repo.get_by_customer_and_id(customer_id, loc_in.gst_registration_id)
            if not gst_reg or not gst_reg.is_active or gst_reg.is_deleted or gst_reg.status != "ACTIVE":
                raise HTTPException(
                    status_code=400,
                    detail="Selected GST registration is invalid or inactive."
                )

        loc_id = loc_in.id or f"cbl-{uuid.uuid4().hex[:8]}"
        db_loc = CustomerBillingLocation(
            id=loc_id,
            customer_id=customer_id,
            billing_store_code=billing_store_code,
            location_name=loc_in.location_name.strip() if loc_in.location_name else "Billing Location",
            gst_registration_id=loc_in.gst_registration_id,
            gstin=loc_in.gstin,
            address_line1=loc_in.address_line1.strip(),
            address_line2=loc_in.address_line2.strip() if loc_in.address_line2 else None,
            city=loc_in.city.strip(),
            state=loc_in.state.strip(),
            state_code=loc_in.state_code.strip() if loc_in.state_code else None,
            pincode=loc_in.pincode.strip(),
            country=loc_in.country or "India",
            contact_person=loc_in.contact_person,
            email=loc_in.email,
            phone=loc_in.phone,
            is_default=bool(loc_in.is_default),
            status=loc_in.status or "ACTIVE",
            source=loc_in.source or "MANUAL",
            remarks=loc_in.remarks,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_deleted=False,
        )
        self.db.add(db_loc)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer billing location could not be created due to duplicate billing store code or integrity constraints."
            )

        refreshed = await self.billing_repo.get(db_loc.id)
        await self._record_audit_event(
            "CustomerBillingLocationCreated",
            "customer_billing_locations",
            db_loc.id,
            {"billing_store_code": billing_store_code, "location_name": loc_in.location_name}
        )
        return refreshed or db_loc

    async def update_billing_location(
        self, customer_id: str, location_id: str, loc_in: CustomerBillingLocationUpdate
    ) -> CustomerBillingLocation:
        loc = await self.get_billing_location(customer_id, location_id)

        if loc_in.billing_store_code:
            new_code = loc_in.billing_store_code.strip().upper()
            if new_code != loc.billing_store_code:
                existing = await self.billing_repo.get_by_customer_and_billing_store_code(customer_id, new_code, active_only=True)
                if existing and existing.id != location_id:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Billing location with store code '{new_code}' already exists for this customer."
                    )
                loc.billing_store_code = new_code

        if loc_in.is_default is True and not loc.is_default:
            await self.billing_repo.clear_default_flags(customer_id, exclude_id=location_id)
            loc.is_default = True

        for field in ("location_name", "gst_registration_id", "gstin", "address_line1", "address_line2",
                      "city", "state", "state_code", "pincode", "country", "contact_person",
                      "email", "phone", "status", "remarks"):
            val = getattr(loc_in, field, None)
            if val is not None:
                setattr(loc, field, val)

        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        refreshed = await self.billing_repo.get(loc.id)
        return refreshed or loc

    async def set_default_billing_location(
        self, customer_id: str, location_id: str
    ) -> CustomerBillingLocation:
        loc = await self.get_billing_location(customer_id, location_id)
        if loc.status != "ACTIVE" or loc.is_deleted:
            raise HTTPException(
                status_code=400,
                detail="Cannot set an inactive billing location as default."
            )
        await self.billing_repo.clear_default_flags(customer_id, exclude_id=location_id)
        loc.is_default = True
        loc.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(loc)
        await self._record_audit_event(
            "CustomerBillingLocationDefaultChanged",
            "customer_billing_locations",
            loc.id,
            {"billing_store_code": loc.billing_store_code}
        )
        return loc

    async def delete_billing_location(
        self, customer_id: str, location_id: str
    ) -> Dict[str, str]:
        loc = await self.get_billing_location(customer_id, location_id)
        loc.is_deleted = True
        loc.status = "INACTIVE"
        loc.is_default = False
        loc.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self._record_audit_event(
            "CustomerBillingLocationDeactivated",
            "customer_billing_locations",
            location_id,
            {"billing_store_code": loc.billing_store_code}
        )
        return {"status": "success", "message": f"Customer billing location '{location_id}' deactivated."}

    # --- Customer External Identity Methods ---

    async def list_external_identities(
        self, customer_id: str, include_inactive: bool = False
    ) -> List[CustomerExternalIdentity]:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return await self.ext_ident_repo.get_all_for_customer(customer_id, include_inactive=include_inactive)

    async def create_external_identity(
        self, customer_id: str, ext_in: CustomerExternalIdentityCreate
    ) -> CustomerExternalIdentity:
        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        # Check duplicate external identity
        dup_check = await self.identity_service.check_duplicate_external_identity(
            customer_id=customer_id,
            source_system=ext_in.source_system,
            external_type=ext_in.external_type,
            external_code=ext_in.external_code,
        )
        if dup_check.decision == DuplicateDecision.HARD_DUPLICATE:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "DUPLICATE_EXTERNAL_IDENTITY",
                    "decision": dup_check.decision.value,
                    "matched_identity": dup_check.matched_identity.value if dup_check.matched_identity else None,
                    "reason": dup_check.reason,
                    "existing_customer": dup_check.existing_customer.model_dump() if dup_check.existing_customer else None,
                    "allow_override": False,
                }
            )

        ident_id = ext_in.id or f"cei-{uuid.uuid4().hex[:8]}"
        db_ident = CustomerExternalIdentity(
            id=ident_id,
            customer_id=customer_id,
            source_system=ext_in.source_system.strip().upper(),
            external_type=ext_in.external_type.strip().upper(),
            external_code=ext_in.external_code.strip(),
            metadata_json=ext_in.metadata_json,
            status=ext_in.status or "ACTIVE",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            is_deleted=False,
        )
        self.db.add(db_ident)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Customer external identity could not be created due to composite uniqueness conflict."
            )

        await self.db.refresh(db_ident)
        await self._record_audit_event(
            "CustomerExternalIdentityCreated",
            "customer_external_identities",
            db_ident.id,
            {"source_system": db_ident.source_system, "external_code": db_ident.external_code}
        )
        return db_ident

    async def delete_external_identity(
        self, customer_id: str, identity_id: str
    ) -> Dict[str, str]:
        stmt = select(CustomerExternalIdentity).filter(
            CustomerExternalIdentity.id == identity_id,
            CustomerExternalIdentity.customer_id == customer_id,
            CustomerExternalIdentity.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter(CustomerExternalIdentity.company_id == self.tenant_ctx.company_id)
        res = await self.db.execute(stmt)
        ident = res.scalars().first()
        if not ident:
            raise HTTPException(status_code=404, detail="External identity not found.")
        ident.is_deleted = True
        ident.status = "INACTIVE"
        ident.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return {"status": "success", "message": f"External identity '{identity_id}' removed."}



