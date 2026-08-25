"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class StockMovementRecordRequest(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: float = Field(..., description="Positive quantity value")
    movement_type: str = Field(..., description="IN, OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, INWARD_GRN, OUTWARD_SALE, TRANSFER_IN, TRANSFER_OUT, RETURN_INWARD, RETURN_OUTWARD")
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    warehouse: Optional[str] = None
    bin: Optional[str] = None
    batch: Optional[str] = None
    serial: Optional[str] = None
    unit_cost: Optional[float] = None
    remarks: Optional[str] = None
    source_module: Optional[str] = "INVENTORY"


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    product_name: str
    sku: str
    quantity: float
    movement_type: str
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    unit_cost: Optional[float] = None
    batch: Optional[str] = None
    serial: Optional[str] = None
    remarks: Optional[str] = None


class StockDriftItem(BaseModel):
    product_id: str
    sku: str
    product_name: str
    materialized_on_hand: float
    computed_from_movements: float
    drift_quantity: float
    has_drift: bool
    status: str  # BALANCED, OVERSTATED, UNDERSTATED


class StockBalanceRebuildResponse(BaseModel):
    company_id: str
    total_products_checked: int
    balanced_products_count: int
    drift_products_count: int
    items: List[StockDriftItem] = Field(default_factory=list)
    reconciliation_status: str  # CLEAN, DRIFT_DETECTED


class JournalEntryLine(BaseModel):
    account_code: str
    account_name: Optional[str] = None
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    party_id: Optional[str] = None
    remarks: Optional[str] = None


class JournalVoucherCreateRequest(BaseModel):
    voucher_no: Optional[str] = None
    voucher_type: str = "JOURNAL"  # SALES_INVOICE, PURCHASE_BILL, PAYMENT_RECEIPT, SUPPLIER_PAYMENT, JOURNAL, STOCK_ADJUSTMENT
    voucher_date: Optional[str] = None
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    reference_doc_no: Optional[str] = None
    narration: Optional[str] = None
    entries: List[JournalEntryLine] = Field(..., min_length=2)


class JournalVoucherResponse(BaseModel):
    voucher_id: str
    voucher_no: str
    voucher_type: str
    total_debit: float
    total_credit: float
    is_balanced: bool
    is_posted: bool
    entries_count: int
    message: str


class StockReconciliationReport(BaseModel):
    company_id: str
    audit_timestamp: str
    total_movements_logged: int
    total_products_audited: int
    clean_products: int
    drift_products: int
    drift_items: List[StockDriftItem] = Field(default_factory=list)
    is_healthy: bool


class GlReconciliationReport(BaseModel):
    company_id: str
    audit_timestamp: str
    total_vouchers_checked: int
    unbalanced_vouchers_count: int
    total_gl_debits: float
    total_gl_credits: float
    trial_balance_drift: float
    is_trial_balance_equal: bool
    unbalanced_voucher_ids: List[str] = Field(default_factory=list)
    is_healthy: bool


class FinancialReconciliationReport(BaseModel):
    company_id: str
    audit_timestamp: str
    stock_status: StockReconciliationReport
    gl_status: GlReconciliationReport
    overall_health: str  # HEALTHY, DRIFT_DETECTED
