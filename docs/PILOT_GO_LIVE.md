<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Commercial Pilot Go-Live Runbook

**Version:** v3.29.0  
**Target Release:** Commercial Pilot Release  
**Branch:** `smritiNX`  
**Classification:** Internal & Field Operations  

---

## 1. Executive Summary & Scope

This runbook provides the definitive, step-by-step operating procedure for deploying and running SMRITI Retail OS in commercial pilot retail environments. It covers environment configuration, database migration, operator provisioning, daily checkout operations, non-destructive backup/recovery, and emergency escalation.

**Supported Pilot Modules (18 Core Workspaces):**
- **Operations:** SMRITI Launchpad, Staff & HR Management, User Profile, About SMRITI.
- **Sales & POS:** Billing Desk (POS), Sales Studio, Create Tax Invoice (B2B), POS Profiles & Counters, Customer Master.
- **Inventory & Sourcing:** Item Master & Catalog, Supplier Directory, Purchase Studio, Stock Movement Ledger.
- **Documents & Data:** Barcode Studio, Document Series Engine, Commercial Terms Engine, Approval Matrix, Security & Audit Logs.

*Note: All other 15 secondary modules remain in Preview/Staging mode per [PHASE1_PILOT.md](PHASE1_PILOT.md).*

---

## 2. Environment Variables & Pre-Flight Checklist

Before launching services, verify that all mandatory environment variables are populated on the host server:

| Variable Name | Required Scope | Description / Example |
|---|---|---|
| `DATABASE_URL` | Backend / Alembic | `postgresql+asyncpg://postgres:<SECRET>@localhost:5432/smritisys` |
| `FASTAPI_BASE_URL` | Frontend / Express Proxy | `http://localhost:8000` (or `http://python-core:8000` in Docker) |
| `JWT_SECRET_KEY` | Backend | High-entropy 256-bit cryptographic secret for token signing |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | `480` (8 hours for retail cashier shifts) |
| `INTERNAL_SERVICE_KEY` | Backend & Gateway | Shared secret for internal service-to-service communication |
| `SUPER_ADMIN_PASSWORD` | Initialization only | Temporary bootstrap password (must be rotated upon first login) |

---

## 3. Database Initialization & Migration Procedure

### Step 3.1. Verify Database Reachability
```bash
# Verify connection to PostgreSQL control plane
psql -U postgres -h localhost -d smritisys -c "SELECT version();"
```

### Step 3.2. Execute Alembic Migrations to HEAD
```bash
# Navigate to backend directory
cd backend

# Set Python path to backend root
$env:PYTHONPATH="F:\SMRITRretailNX\backend"   # Windows PowerShell
# or: export PYTHONPATH="/path/to/backend"     # Linux / macOS

# Check current revision
alembic current

# Upgrade all schemas to HEAD (minimum required: v1338_company_isolated_barcodes)
alembic upgrade head
```

### Step 3.3. Verify Product Variant Integrity
```sql
-- In the operational company database (e.g. smriti001):
SELECT count(*) AS total_products, 
       count(CASE WHEN variant_id IS NULL THEN 1 END) AS null_variant_ids 
FROM products;
-- Expected output: null_variant_ids must be exactly 0.
```

---

## 4. Operator Provisioning & Role-Based Access Control (RBAC)

### Step 4.1. Role Assignment Architecture
SMRITI enforces **deny-by-default** access control:
- **CASHIER**: Access restricted to `pos`, `item-master`, `stock-ledger`, `create-tax-invoice`, `barcode`. Administrative workspaces are hidden.
- **MANAGER**: Operational oversight including `purchase`, `supplier-mgmt`, `crm`, `staff-management`, `audit-logs`.
- **SYSADMIN**: Full access to all 33 workspaces, company database settings, and system configuration.

### Step 4.2. Provisioning Cashier Accounts
1. Log in as `SYSADMIN` or `MANAGER`.
2. Open **Staff & HR Management** (`/api/v1/users/`).
3. Create operator account with explicit role `CASHIER` and assign authorized `branch_id`.
4. Ensure no unassigned or blank roles exist.

---

## 5. Daily Store Operational Happy Path

```mermaid
graph LR
    A[1. Cashier Login] --> B[2. Tenant & Branch Select]
    B --> C[3. Open Shift & Cash Float]
    C --> D[4. POS Barcode Scan & Cart]
    D --> E[5. Multi-Tender Payment]
    E --> F[6. Print Receipt / Tax Invoice]
    F --> G[7. Shift Close & Cash Reconciliation]
```

### Step 5.1. Cashier Shift Opening
1. Cashier logs in at `/login` with credentials.
2. If multi-tenant operator, select Company (`Tattly Threads - COMP-001`).
3. Click **Billing Desk (POS)** from Launchpad quick actions.
4. Enter starting cash drawer float and confirm shift open.

### Step 5.2. Checkout & Barcode Scanning
- Scan items with handheld barcode scanner or search by name/SKU in item lookup.
- Apply customer lookup via phone number (Customer Master / CRM).
- Tender payment (Cash, UPI, Card, Credit).
- Complete transaction: receipt prints automatically and stock ledger decrements in real time.

### Step 5.3. B2B Statutory Tax Invoice Creation
1. Open **Create Tax Invoice (B2B)** (`create-tax-invoice`).
2. Select Customer GSTIN (auto-resolves Place of Supply and Reverse Charge flags).
3. Populate line items; HSN tax breakdown and Indian currency words format automatically.
4. Export/Print certified A4 PDF invoice.

### Step 5.4. End-of-Day Shift Reconciliation
1. Close cash register shift: system prompts for actual counted cash, card totals, and UPI summaries.
2. Review shift variance report.
3. Verify immutable movement log in **Stock Movement Ledger** (`stock-ledger`).

---

## 6. Backup, Snapshot & Non-Destructive Rollback Strategy

### Step 6.1. Pre-Deployment Database Snapshot (Mandatory Before Upgrades)
```bash
# Create timestamped snapshot of control plane and company databases
pg_dump -U postgres -h localhost -F c -b -v -f "backup_smritisys_$(date +%Y%m%d_%H%M%S).dump" smritisys
pg_dump -U postgres -h localhost -F c -b -v -f "backup_smriti001_$(date +%Y%m%d_%H%M%S).dump" smriti001
```

### Step 6.2. Non-Destructive Rollback Protocol
> [!IMPORTANT]
> **NEVER** run destructive `alembic downgrade` commands on live transactional data. If a rollback is required:
1. Stop backend and frontend service processes.
2. Checkout the previous stable Git commit or tag (e.g. `git checkout v3.28.0`).
3. Restore the pre-deployment database dump using `pg_restore`:
   ```bash
   pg_restore -U postgres -h localhost -d smriti001 --clean "backup_smriti001_<TIMESTAMP>.dump"
   ```
4. Restart application services and verify login and stock balance integrity.

---

## 7. Field Hardware Pairing & Diagnostics

| Hardware Device | Connection Type | Diagnostic Verification Command / Action |
|---|---|---|
| **Thermal Barcode Printer** | Raw TCP Port 9100 / USB | Open **Barcode Studio & Printing** → Check IP in Printer Settings → Click **Test Print Label**. |
| **Receipt Printer** | USB / Virtual COM | Trigger test receipt print from POS settings; verify paper cut. |
| **Cash Drawer** | RJ11 to Receipt Printer | Verify cash drawer kicks open on cash tender confirmation. |
| **Barcode Scanner** | USB HID / Bluetooth Keyboard | Scan sample barcode into search input; verify Enter/CR termination. |

---

## 8. Emergency Support & Escalation Matrix

In the event of an operational anomaly, data mismatch, or hardware failure during pilot operations:

- **Level 1 (Store Supervisor):** Restart browser session, verify network connectivity to `http://localhost:8000`, check physical printer paper roll.
- **Level 2 (Systems Architect):**
  - **Chief Systems Architect:** Jawahar Ramkripal Mallah
  - **Email:** `support@smritibooks.com` | `founder@aitdl.com`
  - **Websites:** [smritibooks.com](https://smritibooks.com) | [erpnbook.com](https://erpnbook.com) | [aitdl.com](https://aitdl.com)
  - **Phone:** +91 9324117007
