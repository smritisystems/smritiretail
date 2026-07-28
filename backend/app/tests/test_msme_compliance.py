"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import date, timedelta
from decimal import Decimal
from app.core.msme_compliance import calculate_msme_payment_status, MSMEPaymentStatus

def test_msme_delayed_payment_interest_calculation():
    inv_date = date.today() - timedelta(days=60)
    status = MSMEPaymentStatus(
        invoice_number="INV-MSME-001",
        supplier_name="ABC Micro Supplier",
        supplier_msme_registration="UDYAM-UP-00-1234567",
        invoice_date=inv_date,
        invoice_amount=Decimal("100000.00"),
        payment_due_date=inv_date + timedelta(days=45),
        payment_date=None,  # Unpaid, overdue by 15 days
        has_written_agreement=True
    )

    result = calculate_msme_payment_status(status)
    assert result.is_overdue is True
    assert result.days_overdue == 15
    assert result.interest_amount > Decimal("0.00")
