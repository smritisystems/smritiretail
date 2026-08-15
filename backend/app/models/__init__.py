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
from .auth import User, RefreshTokenBlacklist, UserRole
from .purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from .pos import CashRegister, Shift
from .product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from .user_assignment import UserCompanyAssignment, UserBranchAssignment, UserStoreAssignment
from .workflow import WorkflowEvent
from .supplier_payment import SupplierPayment
from .report_schedule import ReportSchedule

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
