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

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, Text, Boolean, DateTime, JSON, func
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

    # Blanket Purchase Agreement (BPA) linkage
    bpa_id         = Column(String(50), ForeignKey("blanket_purchase_agreements.id", ondelete="SET NULL"), nullable=True)
    bpa_release_no = Column(Integer, nullable=True)


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

    # Immutable Contract Audit Snapshot & Manual Override Audit
    contract_id                  = Column(String(50), nullable=True)
    contract_version              = Column(Integer, nullable=True)
    applied_tier_id              = Column(String(50), nullable=True)
    applied_unit_price           = Column(Numeric(15, 2), nullable=True)
    applied_discount_percentage  = Column(Numeric(5, 2), nullable=True)
    is_manually_overridden       = Column(Boolean, nullable=False, default=False)
    override_reason              = Column(String(255), nullable=True)
    overridden_by                = Column(String(100), nullable=True)
    overridden_at                = Column(DateTime(timezone=True), nullable=True)


class VendorContract(RowSecuredMixin, BaseEntity):
    """
    VendorContract — Commercial Agreement Aggregate Root.
    Decoupled from operational ProductVendor catalog entity.
    Supports contract versioning, dates, currency, and payment/incoterms.
    """
    __tablename__ = "vendor_contracts"

    supplier_id            = Column(String(50), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    contract_code          = Column(String(100), nullable=False)
    contract_title         = Column(String(255), nullable=False)
    version_number         = Column(Integer, nullable=False, default=1)
    parent_contract_id     = Column(String(50), ForeignKey("vendor_contracts.id", ondelete="SET NULL"), nullable=True)
    valid_from             = Column(DateTime(timezone=True), nullable=False)
    valid_to               = Column(DateTime(timezone=True), nullable=False)
    currency_id            = Column(String(10), nullable=False, default="INR")
    payment_terms_id       = Column(String(50), nullable=True)
    delivery_terms         = Column(String(100), nullable=True)
    min_commitment_value   = Column(Numeric(15, 2), nullable=False, default=0.00)
    terms_and_conditions   = Column(Text, nullable=True)
    attachment_url         = Column(String(500), nullable=True)
    digital_signature_hash = Column(String(255), nullable=True)
    approval_status        = Column(String(30), nullable=False, default="Draft")
    lifecycle_stage        = Column(String(30), nullable=False, default="Draft")

    supplier = relationship("Supplier", backref="contracts")
    tiers    = relationship("VendorContractTier", back_populates="contract", cascade="all, delete-orphan")


class VendorContractTier(BaseEntity):
    """
    VendorContractTier — Volume Discount & Product Pricing Line.
    Supports min/max quantity slabs, tiered unit prices, discount %, and bonus (free) items.
    """
    __tablename__ = "vendor_contract_tiers"

    contract_id            = Column(String(50), ForeignKey("vendor_contracts.id", ondelete="CASCADE"), nullable=False)
    product_id             = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    purchase_uom_id        = Column(String(50), nullable=True)
    currency_id            = Column(String(10), nullable=False, default="INR")
    min_quantity           = Column(Numeric(10, 2), nullable=False, default=1.00)
    max_quantity           = Column(Numeric(10, 2), nullable=True)
    contract_unit_price    = Column(Numeric(15, 2), nullable=False)
    discount_percentage    = Column(Numeric(5, 2), nullable=False, default=0.00)
    bonus_quantity         = Column(Numeric(10, 2), nullable=False, default=0.00)
    effective_from         = Column(DateTime(timezone=True), nullable=True)
    effective_to           = Column(DateTime(timezone=True), nullable=True)

    contract = relationship("VendorContract", back_populates="tiers")
    product  = relationship("Product")


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

    receipt_id            = Column(String(50),   ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    product_id            = Column(String(50),   ForeignKey("products.id",          ondelete="RESTRICT"), nullable=False)
    code                  = Column(String(50),   nullable=False)
    name                  = Column(String(255),  nullable=False)
    quantity_ordered      = Column(Numeric(10, 2), nullable=True)   # from PO (informational)
    quantity_received     = Column(Numeric(10, 2), nullable=False)  # actual received — drives stock
    cost_price            = Column(Numeric(15, 2), nullable=False)
    gst_rate              = Column(Numeric(5, 2),  nullable=False, default=18.00)
    tax_amount            = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total            = Column(Numeric(15, 2), nullable=False)

    # v5.8.0 Landed Cost & Matching Columns
    allocated_landed_cost = Column(Numeric(15, 2), nullable=False, default=0.00)
    true_landed_unit_cost = Column(Numeric(15, 2), nullable=True)
    match_status          = Column(String(30), nullable=False, default="Pending")


class ThreeWayMatch(RowSecuredMixin, BaseEntity):
    """
    ThreeWayMatch — Aggregate Header for PO <-> GRN <-> Vendor Bill 3-Way Verification.
    Tracks overall price variance, quantity variance, match status FSM, and supervisor approval logs.
    """
    __tablename__ = "three_way_matches"

    po_id                  = Column(String(50), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    grn_id                 = Column(String(50), ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    vendor_bill_no         = Column(String(100), nullable=False)
    vendor_bill_date       = Column(DateTime(timezone=True), nullable=True)
    match_status           = Column(String(30), nullable=False, default="Pending")  # Pending, Matched, Warning, Blocked, Approved Override, Rejected
    overall_price_variance = Column(Numeric(15, 2), nullable=False, default=0.00)
    overall_qty_variance   = Column(Numeric(10, 2), nullable=False, default=0.00)
    approved_by            = Column(String(100), nullable=True)
    approved_at            = Column(DateTime(timezone=True), nullable=True)
    approval_notes         = Column(String(500), nullable=True)

    po    = relationship("PurchaseOrder")
    grn   = relationship("PurchaseReceipt")
    lines = relationship("ThreeWayMatchLine", back_populates="match", cascade="all, delete-orphan")


class ThreeWayMatchLine(BaseEntity):
    """
    ThreeWayMatchLine — Line-by-line 3-way variance verification item.
    Tracks ordered vs received vs billed quantities, prices, variances %, and resolution trace.
    """
    __tablename__ = "three_way_match_lines"

    match_id           = Column(String(50), ForeignKey("three_way_matches.id", ondelete="CASCADE"), nullable=False)
    product_id         = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    ordered_qty        = Column(Numeric(10, 2), nullable=False, default=0.00)
    received_qty       = Column(Numeric(10, 2), nullable=False, default=0.00)
    billed_qty         = Column(Numeric(10, 2), nullable=False, default=0.00)
    po_unit_price      = Column(Numeric(15, 2), nullable=False, default=0.00)
    billed_unit_price  = Column(Numeric(15, 2), nullable=False, default=0.00)
    price_variance_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    qty_variance_pct   = Column(Numeric(5, 2), nullable=False, default=0.00)
    line_status        = Column(String(30), nullable=False, default="Matched")
    resolution_trace   = Column(JSON, nullable=False, default=list)

    match   = relationship("ThreeWayMatch", back_populates="lines")
    product = relationship("Product")


class LandedCostVoucher(RowSecuredMixin, BaseEntity):
    """
    LandedCostVoucher — Secondary landed cost charge voucher linked to a GRN shipment.
    Charge types: Freight, Customs Duty, Marine Insurance, Local Handling.
    Allocation Methods: VALUE, WEIGHT, VOLUME, QUANTITY, MANUAL.
    """
    __tablename__ = "landed_cost_vouchers"

    grn_id            = Column(String(50), ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False)
    charge_type       = Column(String(100), nullable=False)
    charge_amount     = Column(Numeric(15, 2), nullable=False)
    currency_id       = Column(String(10), nullable=False, default="INR")
    vendor_name       = Column(String(255), nullable=True)
    allocation_method = Column(String(30), nullable=False, default="VALUE")

    grn = relationship("PurchaseReceipt")


class ProcurementTolerancePolicy(RowSecuredMixin, BaseEntity):
    """
    ProcurementTolerancePolicy — Multi-level tolerance rule configuration.
    Hierarchy levels: SYSTEM -> COMPANY -> VENDOR -> PRODUCT.
    """
    __tablename__ = "procurement_tolerance_policies"

    level                          = Column(String(30), nullable=False)  # SYSTEM, COMPANY, VENDOR, PRODUCT
    target_id                      = Column(String(50), nullable=True)   # supplier_id or product_id if VENDOR/PRODUCT
    allowed_price_variance_pct     = Column(Numeric(5, 2), nullable=False, default=2.00)
    allowed_qty_variance_pct       = Column(Numeric(5, 2), nullable=False, default=0.00)
    auto_approve_under_threshold   = Column(Boolean, nullable=False, default=True)


class ProcurementRFQ(RowSecuredMixin, BaseEntity):
    """
    ProcurementRFQ — Request for Quotation Aggregate Root.
    Manages multi-vendor bidding workflows, submission deadlines, and evaluation profiles.
    """
    __tablename__ = "procurement_rfqs"

    rfq_code            = Column(String(100), nullable=False)
    title               = Column(String(255), nullable=False)
    description         = Column(Text, nullable=True)
    submission_deadline = Column(DateTime(timezone=True), nullable=False)
    evaluation_profile  = Column(String(50), nullable=False, default="RETAIL_DEFAULT")
    status              = Column(String(30), nullable=False, default="Draft")  # Draft, Published, Bidding Open, Under Evaluation, Awarded, Closed, Cancelled

    items               = relationship("ProcurementRFQItem", back_populates="rfq", cascade="all, delete-orphan")
    invited_vendors     = relationship("ProcurementRFQVendor", back_populates="rfq", cascade="all, delete-orphan")
    quotations          = relationship("VendorQuotation", back_populates="rfq", cascade="all, delete-orphan")


class ProcurementRFQItem(BaseEntity):
    """
    ProcurementRFQItem — Product line item requirement on an RFQ.
    """
    __tablename__ = "procurement_rfq_items"

    rfq_id               = Column(String(50), ForeignKey("procurement_rfqs.id", ondelete="CASCADE"), nullable=False)
    product_id           = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    required_quantity    = Column(Numeric(10, 2), nullable=False)
    target_unit_price    = Column(Numeric(15, 2), nullable=True)
    target_delivery_date = Column(DateTime(timezone=True), nullable=True)

    rfq     = relationship("ProcurementRFQ", back_populates="items")
    product = relationship("Product")


class ProcurementRFQVendor(BaseEntity):
    """
    ProcurementRFQVendor — Invited vendor link table for an RFQ.
    """
    __tablename__ = "procurement_rfq_vendors"

    rfq_id            = Column(String(50), ForeignKey("procurement_rfqs.id", ondelete="CASCADE"), nullable=False)
    supplier_id       = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    invitation_status = Column(String(30), nullable=False, default="Invited")
    invited_at        = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    rfq      = relationship("ProcurementRFQ", back_populates="invited_vendors")
    supplier = relationship("Supplier")


class VendorQuotation(RowSecuredMixin, BaseEntity):
    """
    VendorQuotation — Vendor Bidding Response Aggregate Root.
    Supports quotation versioning (v1 -> v2) and evaluation scores.
    """
    __tablename__ = "vendor_quotations"

    rfq_id                 = Column(String(50), ForeignKey("procurement_rfqs.id", ondelete="CASCADE"), nullable=False)
    supplier_id            = Column(String(50), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    quotation_code         = Column(String(100), nullable=False)
    version_number         = Column(Integer, nullable=False, default=1)
    parent_quotation_id    = Column(String(50), ForeignKey("vendor_quotations.id"), nullable=True)
    currency_id            = Column(String(10), nullable=False, default="INR")
    offered_lead_time_days = Column(Integer, nullable=False, default=7)
    payment_terms          = Column(String(100), nullable=True)
    quote_validity_date    = Column(DateTime(timezone=True), nullable=False)
    total_quote_value      = Column(Numeric(15, 2), nullable=False, default=0.00)
    score                  = Column(Numeric(5, 2), nullable=True)
    rank                   = Column(Integer, nullable=True)
    status                 = Column(String(30), nullable=False, default="Submitted")  # Submitted, Revised, Evaluated, Awarded, Rejected

    rfq      = relationship("ProcurementRFQ", back_populates="quotations")
    supplier = relationship("Supplier")
    items    = relationship("VendorQuotationItem", back_populates="quotation", cascade="all, delete-orphan")


class VendorQuotationItem(BaseEntity):
    """
    VendorQuotationItem — Line item pricing and offered quantities in a vendor quotation.
    """
    __tablename__ = "vendor_quotation_items"

    quotation_id        = Column(String(50), ForeignKey("vendor_quotations.id", ondelete="CASCADE"), nullable=False)
    product_id          = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    offered_quantity    = Column(Numeric(10, 2), nullable=False)
    offered_unit_price  = Column(Numeric(15, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0.00)
    net_unit_price      = Column(Numeric(15, 2), nullable=False)
    line_total          = Column(Numeric(15, 2), nullable=False)

    quotation = relationship("VendorQuotation", back_populates="items")
    product   = relationship("Product")


class QuotationEvaluation(RowSecuredMixin, BaseEntity):
    """
    QuotationEvaluation — Immutable Award Audit Evidence & Comparison Matrix Snapshot.
    """
    __tablename__ = "quotation_evaluations"

    rfq_id                     = Column(String(50), ForeignKey("procurement_rfqs.id", ondelete="CASCADE"), nullable=False)
    winning_quotation_id       = Column(String(50), ForeignKey("vendor_quotations.id"), nullable=False)
    winning_supplier_id        = Column(String(50), ForeignKey("suppliers.id"), nullable=False)
    evaluation_profile         = Column(String(50), nullable=False)
    winning_score              = Column(Numeric(5, 2), nullable=False)
    comparison_matrix_snapshot = Column(JSON, nullable=False)
    awarded_by                 = Column(String(100), nullable=False)
    awarded_at                 = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    award_notes                = Column(Text, nullable=True)
    converted_doc_type         = Column(String(50), nullable=True)  # PURCHASE_ORDER, VENDOR_CONTRACT
    converted_doc_id           = Column(String(50), nullable=True)

    rfq               = relationship("ProcurementRFQ")
    winning_quotation = relationship("VendorQuotation")
    winning_supplier  = relationship("Supplier")


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


class BlanketPurchaseAgreement(RowSecuredMixin, BaseEntity):
    """
    BlanketPurchaseAgreement — Aggregate Root for long-term committed procurement agreements.
    Tracks total commitment ceilings, released values, remaining commitment values, and status lifecycle.
    Lifecycle states: Draft -> Active -> Exhausted -> Expired / Cancelled.
    """
    __tablename__ = "blanket_purchase_agreements"

    bpa_code              = Column(String(100), nullable=False)
    title                 = Column(String(255), nullable=False)
    supplier_id           = Column(String(50), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    valid_from            = Column(DateTime(timezone=True), nullable=False)
    valid_to              = Column(DateTime(timezone=True), nullable=False)
    max_commitment_value  = Column(Numeric(15, 2), nullable=False, default=0.00)
    released_value        = Column(Numeric(15, 2), nullable=False, default=0.00)
    remaining_value       = Column(Numeric(15, 2), nullable=False, default=0.00)
    terms_and_conditions  = Column(Text, nullable=True)
    status                = Column(String(30), nullable=False, default="Draft")  # Draft, Active, Exhausted, Expired, Cancelled

    supplier = relationship("Supplier")
    lines    = relationship("BlanketPurchaseAgreementLine", back_populates="bpa", cascade="all, delete-orphan")


class BlanketPurchaseAgreementLine(BaseEntity):
    """
    BlanketPurchaseAgreementLine — Product commitment line item in a BPA.
    Tracks committed quantity, released quantity, and remaining quantity ceiling.
    """
    __tablename__ = "blanket_purchase_agreement_lines"

    bpa_id             = Column(String(50), ForeignKey("blanket_purchase_agreements.id", ondelete="CASCADE"), nullable=False)
    product_id         = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    agreed_unit_price  = Column(Numeric(15, 2), nullable=False)
    committed_quantity = Column(Numeric(10, 2), nullable=False)
    released_quantity  = Column(Numeric(10, 2), nullable=False, default=0.00)
    remaining_quantity = Column(Numeric(10, 2), nullable=False)

    bpa     = relationship("BlanketPurchaseAgreement", back_populates="lines")
    product = relationship("Product")


class RequisitionApprovalPolicy(RowSecuredMixin, BaseEntity):
    """
    RequisitionApprovalPolicy — Threshold configuration for multi-level requisition approvals.
    Data-driven routing based on estimated total value.
    """
    __tablename__ = "requisition_approval_policies"

    policy_name            = Column(String(100), nullable=False)
    min_value              = Column(Numeric(15, 2), nullable=False, default=0.00)
    max_value              = Column(Numeric(15, 2), nullable=True)
    required_approver_role = Column(String(50), nullable=True)
    stage_order            = Column(Integer, nullable=False, default=1)
    auto_approve           = Column(Boolean, nullable=False, default=False)


class PurchaseRequisition(RowSecuredMixin, BaseEntity):
    """
    PurchaseRequisition — Aggregate Root for internal demand requisitions.
    FSM Lifecycle: Draft -> Submitted -> UnderApproval -> Approved -> Converted -> Rejected / Cancelled.
    """
    __tablename__ = "purchase_requisitions"

    requisition_no         = Column(String(100), nullable=False, unique=True)
    title                  = Column(String(255), nullable=False)
    requestor_id           = Column(String(50), nullable=True)
    department             = Column(String(100), nullable=True)
    cost_center            = Column(String(100), nullable=True)
    required_by_date       = Column(DateTime(timezone=True), nullable=True)
    estimated_total        = Column(Numeric(15, 2), nullable=False, default=0.00)
    notes                  = Column(Text, nullable=True)
    status                 = Column(String(30), nullable=False, default="Draft")
    current_approval_stage = Column(Integer, nullable=True)
    converted_doc_type     = Column(String(50), nullable=True)  # PURCHASE_ORDER, RFQ, BPA_RELEASE
    converted_doc_id       = Column(String(50), nullable=True)

    lines     = relationship("PurchaseRequisitionLine", back_populates="requisition", cascade="all, delete-orphan")
    approvals = relationship("RequisitionApproval", back_populates="requisition", cascade="all, delete-orphan")


class PurchaseRequisitionLine(BaseEntity):
    """
    PurchaseRequisitionLine — Line item in a purchase requisition.
    """
    __tablename__ = "purchase_requisition_lines"

    requisition_id        = Column(String(50), ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False)
    product_id            = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    requested_quantity    = Column(Numeric(10, 2), nullable=False)
    estimated_unit_price  = Column(Numeric(15, 2), nullable=False, default=0.00)
    line_total            = Column(Numeric(15, 2), nullable=False, default=0.00)
    preferred_supplier_id = Column(String(50), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    notes                 = Column(Text, nullable=True)

    requisition        = relationship("PurchaseRequisition", back_populates="lines")
    product            = relationship("Product")
    preferred_supplier = relationship("Supplier")


class RequisitionApproval(BaseEntity):
    """
    RequisitionApproval — Immutable approval stage record for a purchase requisition.
    """
    __tablename__ = "requisition_approvals"

    requisition_id         = Column(String(50), ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False)
    stage_order            = Column(Integer, nullable=False)
    stage_name             = Column(String(100), nullable=False)
    required_approver_role = Column(String(50), nullable=True)
    approver_id            = Column(String(50), nullable=True)
    decision               = Column(String(20), nullable=True)  # PENDING, APPROVED, REJECTED
    decided_at             = Column(DateTime(timezone=True), nullable=True)
    notes                  = Column(Text, nullable=True)

    requisition = relationship("PurchaseRequisition", back_populates="approvals")


