"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-11
Modified     : 2026-07-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

# SMRITI database models init
from .auth import RefreshTokenBlacklist, User, UserRole
from .crm import Customer, CustomerGroup
from .inventory import Product, StockMovement
from .pos import CashRegister, Shift
from .product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from .purchase import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    Supplier,
)
from .report_schedule import ReportSchedule
from .sales import SalesInvoice, SalesInvoiceItem
from .supplier_payment import SupplierPayment
from .tenant import Branch, Company
from .user_assignment import UserBranchAssignment, UserCompanyAssignment, UserStoreAssignment
from .workflow import WorkflowEvent
