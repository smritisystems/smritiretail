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
from .workflow import WorkflowEvent
from .supplier_payment import SupplierPayment
from .report_schedule import ReportSchedule
