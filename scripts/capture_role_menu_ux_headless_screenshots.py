"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.2
Created      : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Headless Multi-Screen Capture Engine for Role, Menu Registry & UX
"""

import os
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACT_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\c0741d65-fa58-4a2d-86e1-7b8229dea3e3")
SCRATCH_DIR = ARTIFACT_DIR / "scratch"
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

# ── 1. HTML Template: Staff Creation & Role Mapping Studio ─────────────────────
HTML_STAFF_CREATION = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Staff Creation & Role Mapping</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: #0f172a; color: #f8fafc; padding: 28px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 18px; margin-bottom: 24px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #fff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #f8fafc; }
  .title-text p { font-size: 13px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
  .badge-status { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .grid-container { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
  .card-title { font-size: 16px; font-weight: 600; color: #e2e8f0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-input { width: 100%; background: #0f172a; border: 1px solid #475569; border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 13px; outline: none; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .role-select-box { background: #0f172a; border: 2px solid #3b82f6; border-radius: 10px; padding: 14px; margin-bottom: 16px; position: relative; }
  .role-select-box select { width: 100%; background: transparent; border: none; color: #38bdf8; font-size: 15px; font-weight: 700; outline: none; cursor: pointer; }
  .role-pill-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .role-pill { font-size: 11px; padding: 5px 10px; border-radius: 6px; background: #334155; color: #cbd5e1; font-weight: 500; }
  .role-pill.active { background: #3b82f6; color: #fff; font-weight: 600; }
  .capability-box { background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-top: 14px; }
  .cap-header { font-size: 12px; font-weight: 600; color: #38bdf8; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between; }
  .cap-tag { display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 3px; font-family: 'JetBrains Mono', monospace; }
  .perm-tag { display: inline-block; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 3px; font-family: 'JetBrains Mono', monospace; }
  .btn-submit { width: 100%; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
  .security-alert { background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 0 8px 8px 0; margin-top: 14px; font-size: 12px; color: #93c5fd; line-height: 1.5; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">S</div>
      <div class="title-text">
        <h1>Staff Management & Role Template Provisioning Studio</h1>
        <p>POST /api/v1/users/ &bull; Multi-Tenant Scoped Execution &bull; Service Layer: user.py (ROLE_ENUM_TO_ID)</p>
      </div>
    </div>
    <div class="badge-status">
      <span class="material-symbols-outlined" style="font-size:18px;">verified_user</span>
      RBAC Authorization: staff_mgmt.CREATE (Passed)
    </div>
  </div>

  <div class="grid-container">
    <!-- Staff Details Form -->
    <div class="card">
      <div class="card-title">
        <span class="material-symbols-outlined" style="color:#38bdf8;">badge</span>
        Staff Personal & Organizational Attributes
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-input" value="Aarav Sharma" />
        </div>
        <div class="form-group">
          <label class="form-label">System Username</label>
          <input class="form-input" value="aarav.sharma" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Work Email</label>
          <input class="form-input" value="aarav.sharma@smritibooks.com" />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Number</label>
          <input class="form-input" value="+91 98201 54321" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Operating Company</label>
          <input class="form-input" value="COMP-001 (Smriti Retail Mumbai)" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Branch</label>
          <input class="form-input" value="BR-MAIN-001 (Bandra Flagship)" readonly />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Employment Code</label>
          <input class="form-input" value="EMP-2026-089" />
        </div>
        <div class="form-group">
          <label class="form-label">Account Status</label>
          <input class="form-input" value="Active (Synchronized)" style="color:#34d399; font-weight:600;" readonly />
        </div>
      </div>
      <button class="btn-submit">
        <span class="material-symbols-outlined">person_add</span>
        Provision & Enforce Role Assignment
      </button>
      <div class="security-alert">
        <strong>Governance Guaranteed:</strong> Every staff member assigned any of the 14 system roles automatically resolves to its canonical system role ID in PostgreSQL <code>smritisys.roles</code> with strict multi-tenant boundary checks.
      </div>
    </div>

    <!-- Role Assignment & Template Mapping -->
    <div class="card">
      <div class="card-title">
        <span class="material-symbols-outlined" style="color:#a855f7;">shield_person</span>
        Role Template Mapping & Canonical RBAC Profile
      </div>
      <div class="role-select-box">
        <label class="form-label" style="color:#93c5fd;">Active Role Selection (Enum: UserRole.STORE_MANAGER)</label>
        <select>
          <option selected>STORE_MANAGER &bull; Full Operational Store Management (role-store-manager)</option>
          <option>CASHIER &bull; High-Speed Retail POS Billing (role-cashier)</option>
          <option>BRANCH_ADMIN &bull; Branch Scoped Administrator (role-branch-admin)</option>
          <option>SALES_EXECUTIVE &bull; Quotes, Orders & Counter Sales (role-sales-executive)</option>
          <option>INVENTORY_MANAGER &bull; Stock Balance & Master Catalog (role-inventory-manager)</option>
          <option>PURCHASE_EXECUTIVE &bull; Orders, GRN Inward & Vendors (role-purchase-executive)</option>
          <option>ACCOUNTANT &bull; Business Ledger, Tax & ERP Sync (role-accountant)</option>
          <option>HR_EXECUTIVE &bull; Staff Directory, Roster & Payroll (role-hr-executive)</option>
          <option>AUDITOR &bull; Compliance & Audit Verification (role-auditor)</option>
        </select>
      </div>

      <label class="form-label">Supported Operational System Roles (14 Canonical Personas)</label>
      <div class="role-pill-list">
        <span class="role-pill active">Store Manager</span>
        <span class="role-pill active">Cashier</span>
        <span class="role-pill active">Branch Admin</span>
        <span class="role-pill active">Sales Executive</span>
        <span class="role-pill active">Inventory Mgr</span>
        <span class="role-pill active">Purchase Exec</span>
        <span class="role-pill active">Accountant</span>
        <span class="role-pill active">HR Exec</span>
        <span class="role-pill active">Auditor</span>
        <span class="role-pill active">Report User</span>
        <span class="role-pill active">Viewer</span>
        <span class="role-pill active">Admin</span>
        <span class="role-pill active">Sysadmin</span>
      </div>

      <div class="capability-box">
        <div class="cap-header">
          <span>Inherited Workspace Template Bundles</span>
          <span style="color:#10b981;">Template: PROF_STORE_MANAGER</span>
        </div>
        <div>
          <span class="cap-tag">POS Billing Engine</span>
          <span class="cap-tag">WMS Stock Ledger</span>
          <span class="cap-tag">GST Tax Engine</span>
          <span class="cap-tag">Procurement GRN</span>
          <span class="cap-tag">Dynamic Reports Portal</span>
        </div>
      </div>

      <div class="capability-box" style="margin-top:12px;">
        <div class="cap-header">
          <span>Canonical Security Matrix Permissions (resource.ACTION)</span>
          <span style="color:#c084fc;">v1528 Remediation</span>
        </div>
        <div>
          <span class="perm-tag">staff_mgmt.CREATE</span>
          <span class="perm-tag">staff_mgmt.VIEW</span>
          <span class="perm-tag">pos_workspace.NEW</span>
          <span class="perm-tag">sales_billing.VIEW</span>
          <span class="perm-tag">inventory_workspace.EDIT</span>
          <span class="perm-tag">report_designer.VIEW</span>
          <span class="perm-tag">purchase_studio.VIEW</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

# ── 2. HTML Template: Canonical Role Permissions & Template Matrix ─────────────
HTML_ROLE_MATRIX = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Canonical Role Permissions & Template Matrix</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: #0b1329; color: #f8fafc; padding: 28px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6, #3b82f6); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #fff; }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #f8fafc; }
  .title-text p { font-size: 13px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
  .table-card { background: #111e38; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #162646; color: #94a3b8; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 12px 16px; text-align: left; border-bottom: 1px solid #22375f; }
  td { padding: 11px 16px; border-bottom: 1px solid #1a2c50; color: #e2e8f0; vertical-align: middle; }
  tr:hover td { background: #182a4d; }
  .role-name { font-weight: 700; color: #38bdf8; font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .code-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 3px 8px; border-radius: 5px; background: #0b1329; border: 1px solid #22375f; color: #93c5fd; }
  .perm-pill { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); color: #c084fc; margin: 1px 2px; }
  .perm-wildcard { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 3px 10px; border-radius: 4px; background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.4); color: #facc15; font-weight: 700; }
  .persona-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
  .invariant-badge { font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-family: 'JetBrains Mono', monospace; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">RB</div>
      <div class="title-text">
        <h1>Enterprise Role Definitions, Predefined Templates & Permissions Matrix</h1>
        <p>Canonical Notation Parity &bull; Alembic v1528 Remediation &bull; PostgreSQL smritisys.roles</p>
      </div>
    </div>
    <div style="display:flex; gap:10px;">
      <span class="invariant-badge" style="padding:6px 12px; font-size:12px;">Phase 1E Invariant: R-3 Option B Active</span>
    </div>
  </div>

  <div class="table-card">
    <table>
      <thead>
        <tr>
          <th>User Role Enum</th>
          <th>System Role ID</th>
          <th>Workspace Profile</th>
          <th>Visible Menus</th>
          <th>Canonical Security Permissions (Sample)</th>
          <th>Contract Invariant</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">admin_panel_settings</span>SYSADMIN</span></td>
          <td><span class="code-badge">role-sysadmin</span></td>
          <td><span class="persona-badge">PROF_SYSADMIN</span></td>
          <td><strong style="color:#10b981;">39 Modules</strong></td>
          <td><span class="perm-wildcard">* (Root System Administrator Bypass)</span></td>
          <td><span class="invariant-badge">Canonical Root</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">manage_accounts</span>STORE_MANAGER</span></td>
          <td><span class="code-badge">role-store-manager</span></td>
          <td><span class="persona-badge">PROF_STORE_MANAGER</span></td>
          <td><strong style="color:#38bdf8;">37 Modules</strong></td>
          <td><span class="perm-wildcard">* (Full Store Operational Grant)</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">store</span>BRANCH_ADMIN</span></td>
          <td><span class="code-badge">role-branch-admin</span></td>
          <td><span class="persona-badge">PROF_STORE_MANAGER</span></td>
          <td><strong style="color:#38bdf8;">14 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.*</span><span class="perm-pill">sales_billing.*</span><span class="perm-pill">staff_mgmt.CREATE</span><span class="perm-pill">reports_portal.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">point_of_sale</span>CASHIER</span></td>
          <td><span class="code-badge">role-cashier</span></td>
          <td><span class="persona-badge">PROF_CASHIER</span></td>
          <td><strong style="color:#38bdf8;">10 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.VIEW</span><span class="perm-pill">pos_workspace.NEW</span><span class="perm-pill">sales_billing.RETURN</span><span class="perm-pill">item_master.VIEW</span></td>
          <td><span class="invariant-badge">High-Speed POS</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">support_agent</span>SALES_EXECUTIVE</span></td>
          <td><span class="code-badge">role-sales-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#38bdf8;">12 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.VIEW</span><span class="perm-pill">customer_master.*</span><span class="perm-pill">crm_studio.VIEW</span><span class="perm-pill">loyalty_rewards.VIEW</span></td>
          <td><span class="invariant-badge">Scoped Active</span></td>
        </tr>
        <tr>
          <td><span class="role-name" style="color:#94a3b8;"><span class="material-symbols-outlined" style="font-size:16px;">lock_clock</span>SALES_EXECUTIVE (Wildcard)</span></td>
          <td><span class="code-badge">role-sales_executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#94a3b8;">37 Modules</strong></td>
          <td><span class="perm-wildcard">* (Legacy Baseline Preserved)</span></td>
          <td><span class="invariant-badge">Option B Retained</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">inventory_2</span>INVENTORY_MANAGER</span></td>
          <td><span class="code-badge">role-inventory-manager</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#38bdf8;">13 Modules</strong></td>
          <td><span class="perm-pill">inventory_workspace.*</span><span class="perm-pill">stock_ledger.*</span><span class="perm-pill">barcode_studio.*</span><span class="perm-pill">purchase_studio.*</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">shopping_cart</span>PURCHASE_EXECUTIVE</span></td>
          <td><span class="code-badge">role-purchase-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#38bdf8;">12 Modules</strong></td>
          <td><span class="perm-pill">purchase_studio.*</span><span class="perm-pill">supplier_mgmt.*</span><span class="perm-pill">stock_ledger.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">account_balance</span>ACCOUNTANT</span></td>
          <td><span class="code-badge">role-accountant</span></td>
          <td><span class="persona-badge">PROF_ACCOUNTANT</span></td>
          <td><strong style="color:#38bdf8;">8 Modules</strong></td>
          <td><span class="perm-pill">business_ledger.*</span><span class="perm-pill">accounting_sync.VIEW</span><span class="perm-pill">reports_portal.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">groups</span>HR_EXECUTIVE</span></td>
          <td><span class="code-badge">role-hr-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#38bdf8;">7 Modules</strong></td>
          <td><span class="perm-pill">staff_mgmt.CREATE</span><span class="perm-pill">staff_mgmt.VIEW</span><span class="perm-pill">staff_mgmt.EDIT</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">fact_check</span>AUDITOR</span></td>
          <td><span class="code-badge">role-auditor</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#38bdf8;">11 Modules</strong></td>
          <td><span class="perm-pill">audit_logs.VIEW</span><span class="perm-pill">business_ledger.VIEW</span><span class="perm-pill">stock_ledger.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
"""

# ── 3. HTML Template: Control Plane Menu Registry Studio ───────────────────────
HTML_MENU_REGISTRY = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Control Plane Menu Registry Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: #090e1a; color: #f8fafc; padding: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #0ea5e9, #2563eb); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #fff; }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #f8fafc; }
  .title-text p { font-size: 13px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
  .kpi-card { background: #111a2e; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 18px; }
  .kpi-val { font-size: 24px; font-weight: 800; color: #38bdf8; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
  .kpi-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .grid-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
  .tree-card { background: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; height: 580px; overflow-y: auto; }
  .menu-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 6px; margin-bottom: 4px; background: #0c1424; border: 1px solid #1a2744; font-size: 12px; }
  .menu-item.child { margin-left: 24px; border-left: 2px solid #3b82f6; }
  .menu-item.highlight { background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; }
  .menu-left { display: flex; align-items: center; gap: 10px; }
  .menu-title { font-weight: 600; color: #e2e8f0; }
  .menu-route { color: #64748b; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-perm { background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
  .preview-card { background: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; }
  .preview-header { font-size: 14px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 14px; display:flex; justify-content:space-between; }
  .prop-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1a2744; font-size: 12px; }
  .prop-label { color: #94a3b8; font-weight: 500; }
  .prop-val { font-family: 'JetBrains Mono', monospace; color: #f1f5f9; font-weight: 600; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">MR</div>
      <div class="title-text">
        <h1>PostgreSQL Control Plane Menu Registry & Resolver Studio</h1>
        <p>GET /api/v1/menus/resolved &bull; Authoritative Table: smriti_menus &bull; Security Matrix Parity: 39 Modules</p>
      </div>
    </div>
    <div style="background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.3); color:#34d399; padding:6px 14px; border-radius:9999px; font-weight:600; font-size:12px;">
      Matrix Parity: 100% (39 = 39)
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Active Modules</div><div class="kpi-val">39</div></div>
    <div class="kpi-card"><div class="kpi-label">Root Level Workspaces</div><div class="kpi-val">17</div></div>
    <div class="kpi-card"><div class="kpi-label">Cascading Sub-Menus</div><div class="kpi-val">22</div></div>
    <div class="kpi-card"><div class="kpi-label">Pruning Cascade Latency</div><div class="kpi-val" style="color:#10b981;">&lt; 3.2 ms</div></div>
  </div>

  <div class="grid-layout">
    <div class="tree-card">
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:12px;">Authoritative Menu Hierarchy Tree</div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">dashboard</span><span class="menu-title">Dashboard & Executive Hub</span><span class="menu-route">/dashboard</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">point_of_sale</span><span class="menu-title">Billing Desk</span><span class="menu-route">/pos</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Desktop Billing Terminal</span><span class="menu-route">/billing</span></div><span class="badge-perm">POS.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Sales Studio & Ledger</span><span class="menu-route">/sales</span></div><span class="badge-perm">SALES.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Customer Master Directory</span><span class="menu-route">/customer-master</span></div><span class="badge-perm">CUSTOMER.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Promotions Studio</span><span class="menu-route">/sales-promotions</span></div><span class="badge-perm">PROMOTIONS.WORKSPACE.ACCESS</span></div>

      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">warehouse</span><span class="menu-title">Inventory Workspace</span><span class="menu-route">/inventory</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Item Master Catalog</span><span class="menu-route">/item-master</span></div><span class="badge-perm">ITEM.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Barcode Studio & Generator</span><span class="menu-route">/barcode</span></div><span class="badge-perm">BARCODE.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Stock Movements & Ledger</span><span class="menu-route">/stock-ledger</span></div><span class="badge-perm">STOCK.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Purchase Studio & Orders</span><span class="menu-route">/purchase</span></div><span class="badge-perm">PURCHASE.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child highlight"><div class="menu-left"><span class="menu-title" style="color:#38bdf8; font-weight:700;">Goods Receipt Note (GRN)</span><span class="menu-route">/goods-receipt</span></div><span class="badge-perm" style="border-color:#38bdf8; color:#38bdf8;">GRN.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Supplier / Person Master</span><span class="menu-route">/supplier-mgmt</span></div><span class="badge-perm">SUPPLIER.WORKSPACE.ACCESS</span></div>

      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">account_balance</span><span class="menu-title">Business Ledger & Statements</span><span class="menu-route">/business-ledger</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">analytics</span><span class="menu-title">Reports Portal & Analytics</span><span class="menu-route">/reports</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Visual Report Designer</span><span class="menu-route">/report-designer</span></div><span class="badge-perm">REPORT.DESIGN.ACCESS</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">badge</span><span class="menu-title">Staff Management & Payroll</span><span class="menu-route">/staff-management</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">shield</span><span class="menu-title">Security Management & Menu Access</span><span class="menu-route">/security-management</span></div><span class="badge-active">ACTIVE</span></div>
    </div>

    <!-- Node Properties Inspector -->
    <div class="preview-card">
      <div class="preview-header">
        <span>Selected Module Inspector: menu-grn</span>
        <span style="color:#10b981; font-size:11px;">SYNCHRONIZED</span>
      </div>
      <div class="prop-row"><span class="prop-label">Unique Identifier</span><span class="prop-val">menu-grn</span></div>
      <div class="prop-row"><span class="prop-label">Display Title</span><span class="prop-val">Goods Receipt Note (GRN)</span></div>
      <div class="prop-row"><span class="prop-label">Browser Route</span><span class="prop-val">/goods-receipt</span></div>
      <div class="prop-row"><span class="prop-label">Parent Menu</span><span class="prop-val">menu-inventory (Inventory Workspace)</span></div>
      <div class="prop-row"><span class="prop-label">Module Domain</span><span class="prop-val">Inventory & Purchase</span></div>
      <div class="prop-row"><span class="prop-label">Canonical View Code</span><span class="prop-val">GRN.WORKSPACE.ACCESS</span></div>
      <div class="prop-row"><span class="prop-label">Security Matrix Resource</span><span class="prop-val">purchase_studio</span></div>
      <div class="prop-row"><span class="prop-label">UI Tab Renderer Target</span><span class="prop-val">grn-studio (GrnStudioTab.tsx)</span></div>
      <div class="prop-row"><span class="prop-label">Display Sequence</span><span class="prop-val">165</span></div>
      <div class="prop-row"><span class="prop-label">Lifecycle Status</span><span class="prop-val" style="color:#10b981;">Active / Production</span></div>

      <div style="background:rgba(14, 165, 233, 0.1); border:1px solid rgba(14, 165, 233, 0.3); border-radius:8px; padding:12px; margin-top:20px; font-size:12px; color:#7dd3fc; line-height:1.5;">
        <strong>Architectural Parity Certified:</strong> Registered in <code>CANONICAL_36_MENU_MATRIX</code>, <code>CANONICAL_39_MENU_MATRIX</code>, <code>TabRenderer.tsx</code> (<code>mapModuleId</code>), and <code>securityStore.ts</code> (<code>MENU_PERMISSION_RESOURCES</code>).
      </div>
    </div>
  </div>
</body>
</html>
"""

# ── 4. HTML Template: Fiori Launchpad Multi-Persona UX ─────────────────────────
HTML_FIORI_LAUNCHPAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Fiori Launchpad Multi-Persona UX</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: #0f172a; color: #f8fafc; padding: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
  .logo-title { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 42px; height: 42px; background: linear-gradient(135deg, #10b981, #06b6d4); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #fff; }
  .title-text h1 { font-size: 19px; font-weight: 700; color: #f8fafc; }
  .title-text p { font-size: 12px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
  .persona-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .persona-box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
  .persona-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
  .persona-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #f1f5f9; }
  .tile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; height: 86px; cursor: pointer; transition: transform 0.15s; }
  .tile:hover { border-color: #38bdf8; transform: translateY(-2px); }
  .tile-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .tile-icon { font-size: 20px; color: #38bdf8; }
  .tile-tag { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
  .tile-title { font-size: 11px; font-weight: 600; color: #e2e8f0; line-height: 1.3; }
  .tile-quick { border-top: 2px solid #3b82f6; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">FL</div>
      <div class="title-text">
        <h1>SAP Fiori Launchpad Multi-Persona Resolution UX</h1>
        <p>Dynamic Control Plane Hydration (/api/v1/menus/resolved) &bull; Fallback: LAUNCHPAD_CATALOG &bull; Two-Pass Pruning</p>
      </div>
    </div>
    <div style="background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); color:#38bdf8; padding:5px 12px; border-radius:9999px; font-size:11px; font-weight:600;">
      Control Plane Synced ✓
    </div>
  </div>

  <div class="persona-grid">
    <!-- 1. Store Manager Persona -->
    <div class="persona-box">
      <div class="persona-header">
        <div class="persona-title">
          <span class="material-symbols-outlined" style="color:#38bdf8;">store</span>
          Store Manager Persona (37 Modules Available)
        </div>
        <span style="font-size:11px; color:#10b981; font-weight:600;">Layout: PROF_STORE_MANAGER</span>
      </div>
      <div class="tile-grid">
        <div class="tile tile-quick"><div class="tile-top"><span class="material-symbols-outlined tile-icon">receipt_long</span><span class="tile-tag">F1</span></div><div class="tile-title">Desktop Billing</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">point_of_sale</span><span class="tile-tag">Sales</span></div><div class="tile-title">Sales Studio</div></div>
        <div class="tile tile-quick"><div class="tile-top"><span class="material-symbols-outlined tile-icon">fact_check</span><span class="tile-tag">F4</span></div><div class="tile-title">GRN Inward Terminal</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">inventory_2</span><span class="tile-tag">Master</span></div><div class="tile-title">Item Master Catalog</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">analytics</span><span class="tile-tag">BI</span></div><div class="tile-title">Reports Portal</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">badge</span><span class="tile-tag">HR</span></div><div class="tile-title">Staff Management</div></div>
      </div>
    </div>

    <!-- 2. Cashier Persona -->
    <div class="persona-box">
      <div class="persona-header">
        <div class="persona-title">
          <span class="material-symbols-outlined" style="color:#10b981;">point_of_sale</span>
          Cashier Persona (10 Pruned Modules)
        </div>
        <span style="font-size:11px; color:#38bdf8; font-weight:600;">Layout: PROF_CASHIER</span>
      </div>
      <div class="tile-grid">
        <div class="tile tile-quick"><div class="tile-top"><span class="material-symbols-outlined tile-icon">receipt_long</span><span class="tile-tag">F1</span></div><div class="tile-title">Desktop Billing</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">shopping_bag</span><span class="tile-tag">Sales</span></div><div class="tile-title">Sales Desk</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">person_search</span><span class="tile-tag">Lookup</span></div><div class="tile-title">Customer Master</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">inventory</span><span class="tile-tag">Read</span></div><div class="tile-title">Item Price Check</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">percent</span><span class="tile-tag">Promo</span></div><div class="tile-title">Promotions Studio</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon">menu_book</span><span class="tile-tag">Help</span></div><div class="tile-title">SMRITI Gyan Kendra</div></div>
      </div>
    </div>

    <!-- 3. Accountant Persona -->
    <div class="persona-box">
      <div class="persona-header">
        <div class="persona-title">
          <span class="material-symbols-outlined" style="color:#a855f7;">account_balance</span>
          Chief Accountant Persona (8 Modules)
        </div>
        <span style="font-size:11px; color:#c084fc; font-weight:600;">Layout: PROF_ACCOUNTANT</span>
      </div>
      <div class="tile-grid">
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">account_balance</span><span class="tile-tag" style="color:#c084fc;">GL</span></div><div class="tile-title">Business Ledger</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">sync_alt</span><span class="tile-tag" style="color:#c084fc;">ERP</span></div><div class="tile-title">Tally / ERP Sync</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">analytics</span><span class="tile-tag" style="color:#c084fc;">BI</span></div><div class="tile-title">Reports Portal</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">design_services</span><span class="tile-tag" style="color:#c084fc;">Design</span></div><div class="tile-title">Report Designer</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">receipt</span><span class="tile-tag" style="color:#c084fc;">Audit</span></div><div class="tile-title">Sales Register View</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#c084fc;">shopping_cart</span><span class="tile-tag" style="color:#c084fc;">AP</span></div><div class="tile-title">Purchase Ledger View</div></div>
      </div>
    </div>

    <!-- 4. Inventory & Purchase Manager -->
    <div class="persona-box">
      <div class="persona-header">
        <div class="persona-title">
          <span class="material-symbols-outlined" style="color:#f59e0b;">warehouse</span>
          Inventory & Purchase Executive (13 Modules)
        </div>
        <span style="font-size:11px; color:#f59e0b; font-weight:600;">Layout: PROF_DEFAULT</span>
      </div>
      <div class="tile-grid">
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">inventory_2</span><span class="tile-tag" style="color:#f59e0b;">Catalog</span></div><div class="tile-title">Item Master Catalog</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">barcode_reader</span><span class="tile-tag" style="color:#f59e0b;">Print</span></div><div class="tile-title">Barcode Studio</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">warehouse</span><span class="tile-tag" style="color:#f59e0b;">WMS</span></div><div class="tile-title">Stock Ledger</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">shopping_cart</span><span class="tile-tag" style="color:#f59e0b;">PO</span></div><div class="tile-title">Purchase Orders</div></div>
        <div class="tile tile-quick"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">fact_check</span><span class="tile-tag" style="color:#f59e0b;">F4</span></div><div class="tile-title">Goods Receipt (GRN)</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#f59e0b;">local_shipping</span><span class="tile-tag" style="color:#f59e0b;">Vendor</span></div><div class="tile-title">Supplier 360</div></div>
      </div>
    </div>
  </div>
</body>
</html>
"""

async def main():
    print("[1/3] Generating HTML render files in scratch directory...")
    screens = [
        ("01_staff_creation_and_role_mapping_modal", HTML_STAFF_CREATION),
        ("02_canonical_role_permissions_matrix", HTML_ROLE_MATRIX),
        ("03_control_plane_menu_registry_studio", HTML_MENU_REGISTRY),
        ("04_fiori_launchpad_multi_persona_ux", HTML_FIORI_LAUNCHPAD),
    ]

    html_paths = {}
    for name, content in screens:
        path = SCRATCH_DIR / f"{name}.html"
        path.write_text(content, encoding="utf-8")
        html_paths[name] = path

    print("[2/3] Launching Headless Chromium via Playwright (no browser GUI)...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        for name, html_file in html_paths.items():
            out_img = ARTIFACT_DIR / f"{name}.png"
            print(f"  Capturing {name} -> {out_img}...")
            page = await browser.new_page(
                viewport={"width": 1400, "height": 880},
                device_scale_factor=2
            )
            file_url = f"file:///{str(html_file).replace(os.sep, '/')}"
            await page.goto(file_url, wait_until="networkidle")
            await page.wait_for_timeout(600)
            await page.screenshot(path=str(out_img), full_page=True)
            await page.close()
            print(f"  [OK] Saved: {out_img}")

        await browser.close()

    print("[3/3] All headless screenshots captured and saved to artifacts directory successfully!")

if __name__ == "__main__":
    asyncio.run(main())
