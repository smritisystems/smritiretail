<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Repository Hygiene Audit v1.0

**Audit Date:** 2026-08-15  
**Version Target:** v3.25.0  
**Baseline Commit:** `a26f188b`  

## 1. Executive Summary

This audit records the inventory, classification, and reorganization of root-level artifacts, generated test logs, historical audit reports, and development utility scripts to maintain enterprise repository hygiene and public-facing trust for SMRITI Retail OS v3.25.0.

---

## 2. File Inventory & Classification Matrix

| FILE | CATEGORY | ACTION (KEEP/MOVE/REMOVE) | REASON | RISK |
|---|---|---|---|---|
| `CONSIGNMENT_AUDIT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Consignment module historical audit evidence | NONE |
| `ERP_AUDIT_REPORT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | ERP platform historical audit evidence | NONE |
| `BUSINESS_AUDIT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Business workflow historical audit evidence | NONE |
| `SMRITI_ERP_AUDIT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | ERP audit historical report | NONE |
| `EXISTING_SYSTEM.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Legacy system audit report | NONE |
| `INTERNAL_ROLE.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Role dashboards audit evidence | NONE |
| `MASTER_AUDIT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Master audit master report | NONE |
| `MEASUREMENT.md` | D. ARCHITECTURE / GOVERNANCE DOCUMENTATION | MOVE -> `docs/audits/` | Variant audit evidence | NONE |
| `generate_jwt.py` | K. SECURITY-SENSITIVE UTILITIES / ADMIN | MOVE -> `scripts/admin/` | Developer JWT generator tool | NONE |
| `inspect_test_user.py` | K. SECURITY-SENSITIVE UTILITIES / ADMIN | MOVE -> `scripts/admin/` | User password hash inspection utility | NONE |
| `query_user_details.py` | K. SECURITY-SENSITIVE UTILITIES / ADMIN | MOVE -> `scripts/admin/` | User details query utility | NONE |
| `query_users_root.py` | K. SECURITY-SENSITIVE UTILITIES / ADMIN | MOVE -> `scripts/admin/` | Root user query utility | NONE |
| `route_audit.py` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | Route audit script | NONE |
| `frontend_backend_route_audit2.py` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | Route audit script v2 | NONE |
| `temp_legacy_check.py` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | Legacy route checker script | NONE |
| `temp_route_inventory.py` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | Route inventory tool | NONE |
| `verify_cors.py` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | CORS verification utility | NONE |
| `update_attributes.sql` | F. DEVELOPMENT SCRIPTS | MOVE -> `scripts/dev/` | DDL attribute migration script | NONE |
| `tattly_threads_10_invoices_bundle.html` | E. USER TRAINING DOCUMENTATION / EXPORTS | MOVE -> `exports/` | Demo invoice bundle export | NONE |
| `tattly_threads_10_invoices_export.csv` | E. USER TRAINING DOCUMENTATION / EXPORTS | MOVE -> `exports/` | Demo invoice CSV export | NONE |
| `tattly_threads_10_invoices_export.json` | E. USER TRAINING DOCUMENTATION / EXPORTS | MOVE -> `exports/` | Demo invoice JSON export | NONE |
| `full-tsc-output.txt` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Raw TypeScript compiler log output | NONE |
| `tsc-userprofile-output.txt` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Raw TypeScript compiler log output | NONE |
| `tmp_item_master_debug.txt` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Temporary debug log | NONE |
| `pytest_pie_failure.txt` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Raw test failure output | NONE |
| `repo_commit_check.txt` | I. GIT/AGENT PROCESS ARTIFACTS | REMOVE (Tracked in Git) | Git commit check process artifact | NONE |
| `repo_commit_files.txt` | I. GIT/AGENT PROCESS ARTIFACTS | REMOVE (Tracked in Git) | Git commit files process artifact | NONE |
| `frontend_backend_route_audit.json` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Generated JSON output | NONE |
| `frontend_backend_route_audit2.json` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Generated JSON output | NONE |
| `served_bundle.js` | H. RAW TEST/BUILD OUTPUT | REMOVE (Tracked in Git) | Raw build bundle output | NONE |

---

## 3. Governance Summary
- All historical audit evidence preserved 100% under `docs/audits/`.
- Developer/admin utilities safely organized under `scripts/admin/` and `scripts/dev/`.
- Raw generated test outputs and git process artifacts removed from git tracking and ignored via `.gitignore`.
