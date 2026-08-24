<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : ? SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- Audit & Governance Artifact
-->

# SMRITI RETAIL OS ? DATA MIGRATION EXCEPTIONS REPORT

**Date:** 2026-08-17  
**Scope:** Multi-Company Data Split & Anomaly Identification

---

## 1. Exception Inventory

| Source Table | Record ID / Key | Company Discriminator | Description | Resolution Strategy |
|---|---|---|---|---|
| `pricing_groups` | `pg-retail` | `comp-default` | `Retail Price` | Default company template pricing tier ? retained as central default / copied to Company DB as needed. |
| `pricing_groups` | `pg-distributor` | `comp-default` | `Distributor Price` | Default company template pricing tier ? retained as central default / copied to Company DB as needed. |
| `pricing_groups` | `pg-vip` | `comp-default` | `VIP Price` | Default company template pricing tier ? retained as central default / copied to Company DB as needed. |
| `pricing_groups` | `pg-employee` | `comp-default` | `Employee Price` | Default company template pricing tier ? retained as central default / copied to Company DB as needed. |
| `pricing_groups` | `pg-festival` | `comp-default` | `Festival Price` | Default company template pricing tier ? retained as central default / copied to Company DB as needed. |
| `document_series` | `SER-d931d90e` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-5e37df92` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-dd50bd88` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-5fb55b14` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-5cd8a191` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-1444886e` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-8400dcb5` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-9a4fa587` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-ca5e9e15` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-09896f8a` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-836f7617` | `None` | `Sales Invoice (SI-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `document_series` | `SER-9f73abc6` | `None` | `Purchase Order (PO-{FY}-)` | Global default numbering sequence templates ? instantiated per company. |
| `numbering_audit_logs` | `NAL-7fd91bb4` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-93988265` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-020180a3` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-f3e43f06` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-3681c285` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-c9b81666` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-fb3eb397` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-3fc90c2c` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-ea59a08d` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-bf1078bf` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-c68b6e0d` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |
| `numbering_audit_logs` | `NAL-1407c7ad` | `None` | `CREATE (-)` | Bootstrap numbering audit history for system initialization. |

---

## 2. Summary & Disposition

1. **Unassigned / NULL Company Records:**
   - `document_series` (12 rows): Retained in `smritisys` as master series templates; company-specific series reside in `smriti001` / `smriti002`.
   - `numbering_audit_logs` (12 rows): Retained in `smritisys` as historical initialization log.
2. **Template Company Records (`comp-default`):**
   - `pricing_groups` (5 rows): Retained in `smritisys` as standard pricing tiers (Standard, Wholesale, Retail, VIP, Staff).
3. **Orphan Records:**
   - 0 orphan transactional rows detected across `sales_invoices`, `purchase_orders`, `stock_movements`.
