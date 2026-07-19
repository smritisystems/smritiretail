"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

# SMRITI database models init
from .crm import CustomerGroup, PricingGroup, Customer
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


