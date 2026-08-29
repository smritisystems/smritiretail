"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-11
Modified     : 2026-08-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

# SMRITI database models init
from .crm import CustomerGroup, Customer
from .inventory import Product, StockMovement
from .sales import SalesInvoice, SalesInvoiceItem
from .tenant import Company, Branch
from .company_policy import CompanyBankAccount, CompanyPolicySetting, ComplianceThreshold
from .company_registry import CompanyDatabaseRegistry
from .menu import SmritiMenu
from .auth import User, RefreshTokenBlacklist, UserRole
from .purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from .pos import CashRegister, Shift, ShiftCashTransaction
from .product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from .user_assignment import UserCompanyAssignment, UserBranchAssignment, UserStoreAssignment
from .workflow import WorkflowEvent
from .supplier_payment import SupplierPayment
from .report_schedule import ReportSchedule, ReportDispatchLog
from .role import Role


# CRM, Loyalty Program & Universal Incentive Commission Engine (SICE)
from .loyalty import LoyaltyTier, LoyaltyRule, LoyaltyMember, LoyaltyPointsLedger
from .commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger

# Commercial Growth Engine - Promotions, Campaigns & Referrals
from .promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from .referral import ReferralProgram, ReferralRelationship, ReferralReward

# Operations & Fulfillment Engine
from .fulfillment import (
    PackingSlip, PackingSlipItem,
    Dispatch, DispatchItem,
    DeliveryCommissionSettlement, ReverseLogisticsReturn
)

# Cost & Profitability Intelligence Engine
from .profitability import ProductCostValuation, TransactionCostSnapshot, InvoiceProfitabilityLedger

# Reporting & Analytics Engine (Excel Grid, Flexi Studio, Chart Engine, Dashboard Manager)
from .reporting import ReportDefinition, ReportSavedView, Dashboard, DashboardWidget

# Step 1 Platform Baseline Schema Contracts
from .control import (
    ControlCompany,
    ControlCompanyDatabase,
    ControlUser,
    ControlPSVConfig,
)
from .outbox import IntegrationOutboxEvent
from .psv import (
    PSVParty,
    PSVPartySkuTracking,
    PSVStockEvent,
    PSVStockBalance,
)

# System Configuration & Integration Models
from .system import SystemConfig, TallyConfig

# Canonical Tax Invoice Template & Artifact Governance Models
from .tax_inv_template import (
    TaxInvoiceTemplate,
    TaxInvoiceTemplateVersion,
    InvoiceDocumentArtifact,
)

# Canonical Universal Party & Universal Item Master Models (Slice 2)
from .party import (
    Party,
    PartyRole,
    CustomerProfile,
    SupplierProfile,
)
from .item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
)

# Canonical Pricing, Payment Ledger & Document Sequence Models (Slice 4)
from .pricing import (
    PriceBook,
    PriceBookEntry,
    CustomerPriceTier,
)
from .payment_ledger import (
    PaymentTransaction,
    PaymentAllocation,
)
from .numbering import (
    DocumentSeries,
    NumberingAuditLog,
)

# Canonical Approval & Communicator Models (Slice 5)
from .approval import (
    ApprovalPolicy,
    ApprovalRequest,
    ApprovalAction,
)
from .communicator import (
    CommunicatorTemplate,
    CommunicatorLog,
)

# Canonical Capability & Workspace Models (Slice 6)
from .capability_template import (
    PlatformCapability,
    WorkspaceTemplate,
    TenantCapabilityBinding,
    UserWorkspaceConfig,
)

# Canonical Outbox Models (Slice 7)
from .outbox import (
    OutboxEvent,
)

# Canonical Authoritative Double-Entry Accounting Models (Slice 8, 9 & 11)
from .accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    AccountBalanceSnapshot,
    FiscalYear,
    FiscalPeriod,
    BankStatement,
    BankStatementLine,
    CurrencyExchangeRate,
)

# Global Reference Data & Localization Models (P1.1)
from .localization import (
    CountryRef,
    StateRef,
    DistrictRef,
    PostalCodeRef,
    LanguageRef,
    LocaleRef,
    TranslationKeyRef,
    TranslationRef,
    CurrencyRef,
    UnitOfMeasurementRef,
    UOMConversionRef,
    TaxReferenceRef,
    HsnSacCodeRef,
    PlatformReferenceData,
)

# Governed Logic & Reproducibility Models (P1.4 & P1.5)
from .governed_logic import (
    FormulaDefinition,
    BusinessRuleDefinition,
    PolicyDefinition,
    WorkflowDefinition,
)

# Distribution Engine Models (Section 8)
from .distribution import (
    DistributionTerritory,
    DealerAssignment,
    DistributionOrder,
    DistributionOrderItem,
)

# Offline Synchronization Models (Section 10)
from .sync import (
    POSOfflineSyncQueue,
)

# Analytics Plane Models (Section 11)
from .analytics import (
    AnalyticsDailySalesFact,
)

# Compliance & Audit Models (Section 12)
from .audit import (
    ComplianceImmutableAuditLog,
)

# Legacy Migration Registry (Sprint 2)
from .legacy_menu_map import LegacyMenuMap

