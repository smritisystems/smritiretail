<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS Operations & Management Guide

This document describes daily operational tasks, logging configurations, log rotations, and monitoring protocols for SMRITI Retail OS.

---

## 1. Logging Infrastructure

SMRITI utilizes Python standard `logging` with structured formatting:
* **Log Location:** Log files are saved under `/var/log/smriti/` in production containers.
* **Log Levels:**
  * `INFO`: Normal operational events (successful logins, transaction settlements).
  * `WARNING`: Non-fatal errors (failed authentications, invalid API requests).
  * `ERROR`: Critical failures (database connection dropouts, external API timeouts).

---

## 2. Shift Reconciliation Procedures

For point-of-sale (POS) operations:
1. **Opening Shift:** Cashier logs in, specifies the register opening float amount, and opens a new shift.
2. **Billing:** Transactions are processed.
3. **Closing Shift:** Manager audits the closing cash register total, validates physical currency count, and commits shift reconciliation to the SQL ledger.

---

## 3. System Doctor Utility
SMRITI includes a diagnostic module `/backend/app/tests/test_system_doctor.py` that queries system disk limits, PostgreSQL connection integrity, and database migration health. Run this module daily to identify infrastructure warnings before POS outages occur.
