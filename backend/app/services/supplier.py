"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import logging
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

from ..models.purchase import (
    Supplier,
    SupplierTaxProfile,
    SupplierComplianceProfile,
    SupplierPaymentProfile,
    SupplierCreditProfile,
    SupplierBankDetails,
    SupplierAddress,
    SupplierContact,
)
from ..repositories.supplier import SupplierRepository
from ..api.deps import TenantContext
from ..schemas.purchase import SupplierCreate, SupplierUpdate, SupplierResponse


class SupplierService:
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = SupplierRepository(db, tenant_ctx)

    async def generate_supplier_code(self) -> str:
        """
        Generates auto-incremented supplier master code per company.
        Format: SUP-100001, SUP-100002, etc.
        """
        stmt = select(func.count(Supplier.id))
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(Supplier.company_id == self.tenant_ctx.company_id)
        res = await self.db.execute(stmt)
        count = res.scalar() or 0
        return f"SUP-{100001 + count}"

    async def create_supplier(self, supplier_in: SupplierCreate) -> Supplier:
        """
        Creates Supplier aggregate root with child entities inside an atomic transaction.
        """
        # Validate supplier_type_id against Master Lookup framework if provided
        if supplier_in.supplier_type_id:
            from ..models.master_lookup import MasterValue
            try:
                type_uuid = uuid.UUID(supplier_in.supplier_type_id)
                stmt = select(MasterValue).filter(MasterValue.id == type_uuid, MasterValue.active == True, MasterValue.is_deleted == False)
            except ValueError:
                stmt = select(MasterValue).filter(MasterValue.code == supplier_in.supplier_type_id, MasterValue.active == True, MasterValue.is_deleted == False)
            type_res = await self.db.execute(stmt)
            if not type_res.scalars().first():
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid supplier_type_id '{supplier_in.supplier_type_id}': classification does not exist in Master Lookup framework."
                )

        # Validate unique mobile per company if provided
        if supplier_in.mobile:
            stmt = select(Supplier).filter(Supplier.mobile == supplier_in.mobile, Supplier.is_deleted == False)
            if self.tenant_ctx and self.tenant_ctx.company_id:
                stmt = stmt.filter(Supplier.company_id == self.tenant_ctx.company_id)
            res = await self.db.execute(stmt)
            if res.scalars().first():
                raise HTTPException(
                    status_code=400,
                    detail=f"Supplier with mobile number {supplier_in.mobile} already exists for this company."
                )

        # Generate Code if not explicitly provided
        code = supplier_in.code
        if not code:
            code = await self.generate_supplier_code()

        supplier_id = f"sup-{uuid.uuid4().hex[:12]}"
        company_id = self.tenant_ctx.company_id if self.tenant_ctx else None
        branch_id = self.tenant_ctx.branch_id if self.tenant_ctx else None
        tenant_id = self.tenant_ctx.tenant_id if self.tenant_ctx else None

        # Build Supplier Aggregate Root
        supplier = Supplier(
            id=supplier_id,
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            code=code,
            name=supplier_in.name,
            trade_name=supplier_in.trade_name,
            supplier_type_id=supplier_in.supplier_type_id,
            supplier_group_id=supplier_in.supplier_group_id,
            gst_number=supplier_in.gst_number,
            mobile=supplier_in.mobile,
            email=supplier_in.email,
            address=supplier_in.address,
            city=supplier_in.city,
            state=supplier_in.state,
            pincode=supplier_in.pincode,
            lifecycle_stage=supplier_in.lifecycle_stage,
            account_status=supplier_in.account_status,
            custom_attributes=supplier_in.custom_attributes or {},
        )

        # Child Profile 1: Tax Profile
        tax_in = supplier_in.tax_profile
        supplier.tax_profile = SupplierTaxProfile(
            id=f"stax-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            pan_number=tax_in.pan_number if tax_in else None,
            gstin=tax_in.gstin if tax_in else supplier_in.gst_number,
            gst_registration_type_id=tax_in.gst_registration_type_id if tax_in else None,
            is_tds_applicable=tax_in.is_tds_applicable if tax_in else False,
            tds_section_id=tax_in.tds_section_id if tax_in else None,
            tds_rate=tax_in.tds_rate if tax_in else 0.00,
            is_tcs_applicable=tax_in.is_tcs_applicable if tax_in else False,
            workflow_status="Approved",
        )

        # Child Profile 2: Compliance Profile
        comp_in = supplier_in.compliance_profile
        supplier.compliance_profile = SupplierComplianceProfile(
            id=f"scomp-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            msme_category=comp_in.msme_category if comp_in else None,
            msme_number=comp_in.msme_number if comp_in else None,
            fssai_license_no=comp_in.fssai_license_no if comp_in else None,
            drug_license_no=comp_in.drug_license_no if comp_in else None,
            iec_code=comp_in.iec_code if comp_in else None,
            valid_from=comp_in.valid_from if comp_in else None,
            expiry_date=comp_in.expiry_date if comp_in else None,
            verification_status=comp_in.verification_status if comp_in else "Unverified",
            workflow_status="Approved",
        )

        # Child Profile 3: Payment Profile
        pay_in = supplier_in.payment_profile
        supplier.payment_profile = SupplierPaymentProfile(
            id=f"spay-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            payment_terms_id=pay_in.payment_terms_id if pay_in else None,
            payment_mode_id=pay_in.payment_mode_id if pay_in else None,
            currency_id=pay_in.currency_id if pay_in else "INR",
            payment_cycle=pay_in.payment_cycle if pay_in else None,
            workflow_status="Approved",
        )

        # Child Profile 4: Credit Profile
        cred_in = supplier_in.credit_profile
        supplier.credit_profile = SupplierCreditProfile(
            id=f"scred-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            credit_limit=cred_in.credit_limit if cred_in else 0.00,
            credit_days=cred_in.credit_days if cred_in else 0,
            opening_balance=cred_in.opening_balance if cred_in else 0.00,
            opening_balance_type=cred_in.opening_balance_type if cred_in else "Cr",
            workflow_status="Approved",
        )

        # Child Profile 5: Bank Details List
        if supplier_in.bank_details:
            has_primary = False
            for bank_in in supplier_in.bank_details:
                is_prim = bank_in.is_primary and not has_primary
                if is_prim:
                    has_primary = True
                supplier.bank_details.append(
                    SupplierBankDetails(
                        id=f"sbank-{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        tenant_id=tenant_id,
                        company_id=company_id,
                        branch_id=branch_id,
                        bank_name=bank_in.bank_name,
                        branch_name=bank_in.branch_name,
                        account_name=bank_in.account_name,
                        account_number=bank_in.account_number,
                        ifsc_code=bank_in.ifsc_code,
                        upi_id=bank_in.upi_id,
                        is_primary=is_prim,
                        workflow_status="Approved",
                    )
                )

        # Child Profile 6: Addresses List
        if supplier_in.addresses:
            for addr_in in supplier_in.addresses:
                supplier.addresses.append(
                    SupplierAddress(
                        id=f"saddr-{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        tenant_id=tenant_id,
                        company_id=company_id,
                        branch_id=branch_id,
                        address_type_id=addr_in.address_type_id,
                        house_no=addr_in.house_no,
                        building_name=addr_in.building_name,
                        street=addr_in.street,
                        area=addr_in.area,
                        landmark=addr_in.landmark,
                        city=addr_in.city,
                        district=addr_in.district,
                        state=addr_in.state,
                        country=addr_in.country,
                        pincode=addr_in.pincode,
                        is_primary=addr_in.is_primary,
                        workflow_status="Approved",
                    )
                )

        # Child Profile 7: Contacts List
        if supplier_in.contacts:
            for cont_in in supplier_in.contacts:
                supplier.contacts.append(
                    SupplierContact(
                        id=f"scont-{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        tenant_id=tenant_id,
                        company_id=company_id,
                        branch_id=branch_id,
                        contact_type_id=cont_in.contact_type_id,
                        name=cont_in.name,
                        designation=cont_in.designation,
                        mobile=cont_in.mobile,
                        email=cont_in.email,
                        is_primary=cont_in.is_primary,
                        workflow_status="Approved",
                    )
                )

        self.db.add(supplier)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            logger.warning("Supplier creation constraint violation: %s", exc)
            raise HTTPException(
                status_code=400,
                detail="Supplier creation failed due to database constraint violation (duplicate code or reference)."
            )
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Unexpected error during supplier creation")
            raise HTTPException(
                status_code=500,
                detail="An unexpected internal error occurred while saving supplier record."
            )

        return await self.repo.get(supplier_id)

    async def get_supplier(self, id: str) -> Optional[Supplier]:
        supplier = await self.repo.get(id)
        if not supplier:
            raise HTTPException(status_code=44, detail="Supplier not found")
        return supplier

    async def delete_supplier(self, id: str) -> bool:
        supplier = await self.repo.get(id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        await self.repo.soft_delete(supplier)
        return True
