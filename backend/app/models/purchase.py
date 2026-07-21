"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity, RowSecuredMixin


class Supplier(RowSecuredMixin, BaseEntity):
    """
    Supplier Master — Aggregate Root for procurement entities.
    Tenant-scoped (company + branch) per BaseEntity.
    """
    __tablename__ = "suppliers"

    code               = Column(String(50),  nullable=False)
    name               = Column(String(255), nullable=False)
    trade_name         = Column(String(255), nullable=True)
    supplier_type_id   = Column(String(50),  nullable=True)
    supplier_group_id  = Column(String(50),  nullable=True)
    gst_number         = Column(String(20),  nullable=True)
    mobile             = Column(String(20),  nullable=True)
    email              = Column(String(255), nullable=True)
    address            = Column(Text,        nullable=True)
    city               = Column(String(100), nullable=True)
    state              = Column(String(100), nullable=True)
    pincode            = Column(String(10),  nullable=True)
    outstanding        = Column(Numeric(15, 2), nullable=False, default=0.00)
    lifecycle_stage    = Column(String(30), nullable=False, default="Active")
    account_status     = Column(String(20), nullable=False, default="Active")
    custom_attributes  = Column(JSON, nullable=True, default=dict)

    # Relationships to aggregate child entities
    tax_profile        = relationship("SupplierTaxProfile", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    compliance_profile = relationship("SupplierComplianceProfile", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    payment_profile    = relationship("SupplierPaymentProfile", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    credit_profile     = relationship("SupplierCreditProfile", back_populates="supplier", uselist=False, cascade="all, delete-orphan")
    bank_details       = relationship("SupplierBankDetails", back_populates="supplier", cascade="all, delete-orphan")
    addresses          = relationship("SupplierAddress", back_populates="supplier", cascade="all, delete-orphan")
    contacts           = relationship("SupplierContact", back_populates="supplier", cascade="all, delete-orphan")


class SupplierTaxProfile(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_tax_profiles"

    supplier_id              = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, unique=True)
    pan_number               = Column(String(10), nullable=True)
    gstin                    = Column(String(15), nullable=True)
    gst_registration_type_id = Column(String(50), nullable=True)
    is_tds_applicable        = Column(Boolean, nullable=False, default=False)
    tds_section_id           = Column(String(50), nullable=True)
    tds_rate                 = Column(Numeric(5, 2), nullable=False, default=0.00)
    is_tcs_applicable        = Column(Boolean, nullable=False, default=False)

    supplier = relationship("Supplier", back_populates="tax_profile")


class SupplierComplianceProfile(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_compliance_profiles"

    supplier_id         = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, unique=True)
    msme_category       = Column(String(30), nullable=True)
    msme_number         = Column(String(50), nullable=True)
    fssai_license_no    = Column(String(50), nullable=True)
    drug_license_no     = Column(String(50), nullable=True)
    iec_code            = Column(String(50), nullable=True)
    valid_from          = Column(DateTime(timezone=True), nullable=True)
    expiry_date         = Column(DateTime(timezone=True), nullable=True)
    verification_status = Column(String(30), nullable=False, default="Unverified")

    supplier = relationship("Supplier", back_populates="compliance_profile")


class SupplierPaymentProfile(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_payment_profiles"

    supplier_id      = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, unique=True)
    payment_terms_id = Column(String(50), nullable=True)
    payment_mode_id  = Column(String(50), nullable=True)
    currency_id      = Column(String(10), nullable=False, default="INR")
    payment_cycle    = Column(String(50), nullable=True)

    supplier = relationship("Supplier", back_populates="payment_profile")


class SupplierCreditProfile(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_credit_profiles"

    supplier_id          = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, unique=True)
    credit_limit         = Column(Numeric(15, 2), nullable=False, default=0.00)
    credit_days          = Column(Integer, nullable=False, default=0)
    opening_balance      = Column(Numeric(15, 2), nullable=False, default=0.00)
    opening_balance_type = Column(String(10), nullable=False, default="Cr")

    supplier = relationship("Supplier", back_populates="credit_profile")


class SupplierBankDetails(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_bank_details"

    supplier_id    = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    bank_name      = Column(String(150), nullable=False)
    branch_name    = Column(String(150), nullable=True)
    account_name   = Column(String(150), nullable=False)
    account_number = Column(String(50), nullable=False)
    ifsc_code      = Column(String(20), nullable=False)
    upi_id         = Column(String(100), nullable=True)
    is_primary     = Column(Boolean, nullable=False, default=False)

    supplier = relationship("Supplier", back_populates="bank_details")


class SupplierAddress(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_addresses"

    supplier_id     = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    address_type_id = Column(String(50), nullable=False, default="Billing")
    house_no        = Column(String(100), nullable=True)
    building_name   = Column(String(150), nullable=True)
    street          = Column(String(255), nullable=True)
    area            = Column(String(150), nullable=True)
    landmark        = Column(String(150), nullable=True)
    city            = Column(String(100), nullable=True)
    district        = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    country         = Column(String(100), nullable=False, default="India")
    pincode         = Column(String(10), nullable=True)
    is_primary      = Column(Boolean, nullable=False, default=False)

    supplier = relationship("Supplier", back_populates="addresses")


class SupplierContact(RowSecuredMixin, BaseEntity):
    __tablename__ = "supplier_contacts"

    supplier_id     = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    contact_type_id = Column(String(50), nullable=False, default="Primary")
    name            = Column(String(150), nullable=False)
    designation     = Column(String(100), nullable=True)
    mobile          = Column(String(20), nullable=True)
    email           = Column(String(255), nullable=True)
    is_primary      = Column(Boolean, nullable=False, default=False)

    supplier = relationship("Supplier", back_populates="contacts")



class PurchaseOrder(RowSecuredMixin, BaseEntity):
    """
    A purchase order sent to a supplier.
    Status lifecycle: DRAFT → CONFIRMED → RECEIVED → CANCELLED
    """
    __tablename__ = "purchase_orders"

    order_no    = Column(String(100), nullable=False, unique=True)
    supplier_id = Column(String(50),  ForeignKey("suppliers.id",   ondelete="RESTRICT"), nullable=False)
    status      = Column(String(20),  nullable=False, default="DRAFT")
    notes       = Column(Text,        nullable=True)
    # Totals — populated by the service layer on create/update
    subtotal    = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseOrderItem(BaseEntity):
    """
    A line item within a purchase order.
    """
    __tablename__ = "purchase_order_items"

    order_id   = Column(String(50),   ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(50),   ForeignKey("products.id",        ondelete="RESTRICT"), nullable=False)
    code       = Column(String(50),   nullable=False)
    name       = Column(String(255),  nullable=False)
    quantity   = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(15, 2), nullable=False)  # agreed cost per unit
    gst_rate   = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(15, 2), nullable=False)  # qty × cost + tax


class PurchaseReceipt(BaseEntity):
    """
    A goods receipt note (GRN) — records stock physically received from a supplier.
    Linked to a PurchaseOrder (optional: a receipt can exist without a prior PO).
    Receiving a receipt triggers stock increments on the linked products.
    """
    __tablename__ = "purchase_receipts"

    receipt_no  = Column(String(100), nullable=False, unique=True)
    supplier_id = Column(String(50),  ForeignKey("suppliers.id",       ondelete="RESTRICT"), nullable=False)
    order_id    = Column(String(50),  ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    status      = Column(String(20),  nullable=False, default="PENDING")
    notes       = Column(Text,        nullable=True)
    subtotal    = Column(Numeric(15, 2), nullable=False, default=0.00)
    tax_total   = Column(Numeric(15, 2), nullable=False, default=0.00)
    grand_total = Column(Numeric(15, 2), nullable=False, default=0.00)


class PurchaseReceiptItem(BaseEntity):
    """
    A line item within a purchase receipt (GRN).
    quantity_received drives the stock update on the product.
    """
    __tablename__ = "purchase_receipt_items"

    receipt_id         = Column(String(50),   ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    product_id         = Column(String(50),   ForeignKey("products.id",          ondelete="RESTRICT"), nullable=False)
    code               = Column(String(50),   nullable=False)
    name               = Column(String(255),  nullable=False)
    quantity_ordered   = Column(Numeric(10, 2), nullable=True)   # from PO (informational)
    quantity_received  = Column(Numeric(10, 2), nullable=False)  # actual received — drives stock
    cost_price         = Column(Numeric(15, 2), nullable=False)
    gst_rate           = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount         = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total         = Column(Numeric(15, 2), nullable=False)


class PurchaseReorderConfig(BaseEntity):
    """
    Reorder specifications configuration for a product.
    This replaces hardcoded REORDER_SPECS dictionary.
    """
    __tablename__ = "purchase_reorder_configs"

    product_id            = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    reorder_level         = Column(Numeric(12, 4), nullable=False, default=0.0000)
    reorder_quantity      = Column(Numeric(12, 4), nullable=False, default=0.0000)
    preferred_supplier_id = Column(String(50), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)


class PurchaseJurisdictionConfig(BaseEntity):
    """
    State tax jurisdiction configuration for a company/branch.
    """
    __tablename__ = "purchase_jurisdiction_configs"

    company_state = Column(String(10), nullable=False, default="DL")
