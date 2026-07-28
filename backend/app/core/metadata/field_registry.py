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

field_registry.py — SMRITI Change Studio (SCS v4.0) Central Field Catalog
Conforms to Level 1 SMRITI Architecture Constitution (ADR-014 & AOP-008).
"""

FIELD_REGISTRY = {
    "sales_invoice.sales_person_id": {
        "cr_id": "CR-2026-1615",
        "change_type": "new_field",
        "risk_level": "LOW",
        "module": "Sales",
        "entity": "SalesInvoice",
        "table": "sales_invoices",
        "column": "sales_person_id",
        "data_type": "VARCHAR(50)",
        "added_in_version": "v5.7.1",
        "author": "Jawahar Ramkripal Mallah",
        "status": "ACTIVE",
        "impacted_layers": [
            "database", "migration", "model", "repository", "service",
            "api", "ui", "global_search", "reports", "excel_exchange",
            "print_framework", "test_suite"
        ],
        "validation_regex": None,
        "is_searchable": True,
        "is_exportable": True,
    }
}
