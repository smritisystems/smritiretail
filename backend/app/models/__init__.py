"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-07-11
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

# SMRITI database models init
from .crm import (
    CustomerGroup, PricingGroup, Customer,
    Lead, Opportunity, Campaign, SupportTicket, TicketComment, CustomerActivity,
)
from .inventory import Product, StockMovement
from .inventory_kernel import (
    InventoryLocationNode,
    InventoryIdentityRecord,
    InventoryLedgerEntry,
    ReservationLedgerEntry,
    CostLayerLedgerEntry,
    InventorySnapshotRecord,
    DocumentPostingProfileRecord,
)
from .wms import WarehouseZone, WarehouseBin, StockBinAssignment
from .loyalty import CustomerLoyaltyModel, GiftCardModel, LoyaltyTransactionModel

from .sales import (
    SalesInvoice, SalesInvoiceItem, SalesPayment,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from .tenant import Company, Branch
from .auth import User, RefreshTokenBlacklist, UserRole
from .purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from .pos import PosSession, PosTransaction, PosTransactionItem, PosOfflineSyncQueue
from .tax import GstTaxSettlement, GstReturnFiling, EWayBill
from .accounting import ChartOfAccounts, JournalVoucherModel, JournalLedgerEntryModel, FiscalPeriod
from .product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from .sip import UniversalIdentityRegistry, SIPIdentityRule, SIPIdentityRuleVersion, SIPIdentityOutbox
from .screen_studio import ScreenLayoutTemplate
from .user_assignment import UserCompanyAssignment, UserBranchAssignment, UserStoreAssignment
from .workflow import WorkflowEvent
from .system import SystemConfig, BootstrapTask, SystemBootstrapState
from .supplier_payment import SupplierPayment

from .report_schedule import ReportSchedule
from .security import (
    PermissionType,
    SMRITIRole,
    SMRITIPermission,
    SMRITIPermissionSet,
    SMRITIRolePermissionSet,
    SMRITIPermissionSetPermission,
    SMRITIUserRole,
    SMRITIMenu,
    SMRITISecurityAudit,
)

from .platform import DocumentNumberSeries, DocumentWorkflow, IntegrationLog
from .consignment import (
    ConsignmentPartner, ConsignmentTransfer, ConsignmentTransferItem,
    ConsignmentSaleReport, ConsignmentSaleReportItem,
    ConsignmentSettlement, ConsignmentReturn, ConsignmentReturnItem
)
from .sre import (
    CorporateGstinRegistry, SreRuleEngine, SreStatutoryLedger, SreComplianceDecision
)
from .dispatch import (
    StockDispatch, StockDispatchLine, DispatchApprovalEvent
)
from .approval import (
    ApprovalStrategy, ApprovalRequestStatus,
    SMRITIApprovalPolicy, SMRITIApprovalMatrix, SMRITIApprovalStep,
    SMRITIApprovalCondition, SMRITIApprovalAssignment, SMRITIApprovalRequest,
    SMRITIApprovalAction, SMRITIApprovalHistory, SMRITIApprovalDelegation,
    SMRITIApprovalEscalation, SMRITIApprovalComment, SMRITIApprovalOutbox
)
from .api_key import (
    SMRITIServiceAccount, SMRITIAPIKey,
    SMRITIAPIKeyPermissionSet, SMRITIAPIKeyLog
)
from .notification import (
    NotificationTemplateModel, NotificationDispatchModel, InAppNotificationModel
)
from .integration_hub import (
    WebhookSubscriptionModel, OutboundMessageQueueModel, ConnectorRegistryModel
)
from .analytics_bi import (
    DashboardDefinitionModel, KPIMetricModel, ReportBuilderQueryModel
)

# ADR-015: SMRITI Foundation Platform v3.0 (2026-07-28)
from .foundation import (
    SmritiEntityRegistry,
    SmritiAddress,
    SmritiContact,
    SmritiBank,
    SmritiBankAccount,
    SmritiCommChannel,
    SmritiSetting,
    SmritiTheme,
    SmritiThemeVariant,
    SmritiBranding,
    SmritiReportTemplate,
    SmritiSocialProfile,
    SmritiAuditLog,
)
from .company_master import (
    Organization,
    CompanyTaxProfile,
    CompanyFinancialYear,
)

# SCDM — SMRITI Channel Distribution Management (Platform Capability v1.0 & v1.1)
from .scdm import (
    ChannelLocation,
    ChannelDispatch,
    ChannelDispatchLine,
    ChannelStockMovement,
    SellOutImport,
    SellOutImportLine,
)
from .scdm_settlement import (
    ClaimStatus,
    SettlementStatus,
    SCDMClaimType,
    SCDMClaim,
    SCDMSettlement,
    SCDMSettlementLine,
)

