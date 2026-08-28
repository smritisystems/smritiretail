"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

# Public API for the SMRITI Government Integration Platform (SGIP)
# Exposed to prevent direct import of internal components from outside the context.

from app.compliance.api.router import router as compliance_router
from app.compliance.connectors.einvoice.connector import EInvoiceConnector
from app.compliance.connectors.ewaybill.connector import EWayBillConnector
from app.compliance.services.einvoice_service import EInvoiceService
from app.compliance.services.ewaybill_service import EWayBillService
from app.compliance.services.retry_worker import ComplianceRetryWorker

__all__ = [
    "compliance_router",
    "EInvoiceConnector",
    "EWayBillConnector",
    "EInvoiceService",
    "EWayBillService",
    "ComplianceRetryWorker",
]

