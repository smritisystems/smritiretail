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
Source Module: Headless Multi-Screen Capture Engine with Enterprise Light & Multi-Theme Support
"""

import os
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACT_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\c0741d65-fa58-4a2d-86e1-7b8229dea3e3")
SCRATCH_DIR = ARTIFACT_DIR / "scratch"
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

# ── 1. HTML Template: Staff Creation & Role Mapping Studio (Enterprise Light) ──
HTML_STAFF_CREATION = """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Staff Creation & Role Mapping</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
  body { background: #F5F6F7; color: #1D2D3E; padding: 28px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D1D9E2; padding-bottom: 18px; margin-bottom: 24px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #0070F2, #0056B3); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #FFFFFF; box-shadow: 0 4px 12px rgba(0, 112, 242, 0.25); }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #1D2D3E; }
  .title-text p { font-size: 13px; color: #556B82; font-family: 'JetBrains Mono', monospace; }
  .theme-chip { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 20px; padding: 6px 14px; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #1D2D3E; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .theme-dot { width: 10px; height: 10px; border-radius: 50%; background: #0070F2; }
  .badge-status { background: #E8F8F0; color: #107C41; border: 1px solid #A3E0BF; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .grid-container { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; }
  .card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 14px; padding: 22px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04); }
  .card-title { font-size: 16px; font-weight: 600; color: #1D2D3E; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; }
  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 12px; font-weight: 600; color: #556B82; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-input { width: 100%; background: #FAFBFD; border: 1px solid #D1D9E2; border-radius: 8px; padding: 10px 14px; color: #1D2D3E; font-size: 13px; outline: none; transition: border-color 0.2s; }
  .form-input:focus { border-color: #0070F2; background: #FFFFFF; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .role-select-box { background: #F0F7FF; border: 2px solid #0070F2; border-radius: 10px; padding: 14px; margin-bottom: 16px; position: relative; }
  .role-select-box select { width: 100%; background: transparent; border: none; color: #0056B3; font-size: 14px; font-weight: 700; outline: none; cursor: pointer; }
  .role-pill-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .role-pill { font-size: 11px; padding: 5px 11px; border-radius: 6px; background: #F0F4F8; color: #556B82; font-weight: 600; border: 1px solid #D1D9E2; }
  .role-pill.active { background: #0070F2; color: #FFFFFF; border-color: #0070F2; }
  .capability-box { background: #FAFBFD; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-top: 14px; }
  .cap-header { font-size: 12px; font-weight: 700; color: #0070F2; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between; }
  .cap-tag { display: inline-block; background: #E8F2FE; color: #0070F2; border: 1px solid #B9D7FB; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 3px; font-family: 'JetBrains Mono', monospace; }
  .perm-tag { display: inline-block; background: #F3E8FF; color: #7E22CE; border: 1px solid #E9D5FF; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 3px; font-family: 'JetBrains Mono', monospace; }
  .btn-submit { width: 100%; background: linear-gradient(135deg, #0070F2, #0056B3); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0, 112, 242, 0.3); }
  .security-alert { background: #F0F7FF; border-left: 4px solid #0070F2; padding: 12px 14px; border-radius: 0 8px 8px 0; margin-top: 14px; font-size: 12px; color: #0056B3; line-height: 1.5; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">S</div>
      <div class="title-text">
        <h1>Staff Management & Role Template Provisioning Studio</h1>
        <p>POST /api/v1/users/ &bull; Service: user.py (ROLE_ENUM_TO_ID) &bull; Theme: Enterprise Light (SAP Fiori Horizon)</p>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="theme-chip">
        <span class="theme-dot"></span>
        Theme: Enterprise Light (Default)
      </div>
      <div class="badge-status">
        <span class="material-symbols-outlined" style="font-size:18px;">verified_user</span>
        RBAC: staff_mgmt.CREATE (Passed)
      </div>
    </div>
  </div>

  <div class="grid-container">
    <!-- Staff Details Form -->
    <div class="card">
      <div class="card-title">
        <span class="material-symbols-outlined" style="color:#0070F2;">badge</span>
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
          <input class="form-input" value="Active (Synchronized)" style="color:#107C41; font-weight:700;" readonly />
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
        <span class="material-symbols-outlined" style="color:#7E22CE;">shield_person</span>
        Role Template Mapping & Canonical RBAC Profile
      </div>
      <div class="role-select-box">
        <label class="form-label" style="color:#0056B3;">Active Role Selection (Enum: UserRole.STORE_MANAGER)</label>
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
          <span style="color:#107C41;">Template: PROF_STORE_MANAGER</span>
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
          <span style="color:#7E22CE;">v1528 Remediation</span>
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

# ── 2. HTML Template: Canonical Role Permissions Matrix (Enterprise Light) ──────
HTML_ROLE_MATRIX = """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Canonical Role Permissions & Template Matrix</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
  body { background: #F5F6F7; color: #1D2D3E; padding: 28px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D1D9E2; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #0070F2, #7E22CE); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #FFFFFF; }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #1D2D3E; }
  .title-text p { font-size: 13px; color: #556B82; font-family: 'JetBrains Mono', monospace; }
  .table-card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #F0F4F8; color: #556B82; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 12px 16px; text-align: left; border-bottom: 1px solid #D1D9E2; }
  td { padding: 11px 16px; border-bottom: 1px solid #E2E8F0; color: #1D2D3E; vertical-align: middle; }
  tr:hover td { background: #F8FAFD; }
  .role-name { font-weight: 700; color: #0070F2; font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .code-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 3px 8px; border-radius: 5px; background: #F0F4F8; border: 1px solid #D1D9E2; color: #0056B3; font-weight: 600; }
  .perm-pill { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #F3E8FF; border: 1px solid #E9D5FF; color: #7E22CE; margin: 1px 2px; }
  .perm-wildcard { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 3px 10px; border-radius: 4px; background: #FEF3C7; border: 1px solid #FDE68A; color: #92400E; font-weight: 700; }
  .persona-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: #E8F2FE; color: #0070F2; border: 1px solid #B9D7FB; }
  .invariant-badge { font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 4px; background: #E8F8F0; color: #107C41; border: 1px solid #A3E0BF; font-family: 'JetBrains Mono', monospace; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">RB</div>
      <div class="title-text">
        <h1>Enterprise Role Definitions, Predefined Templates & Permissions Matrix</h1>
        <p>Canonical Notation Parity &bull; Alembic v1528 Remediation &bull; Theme: Enterprise Light (Default)</p>
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
          <td><strong style="color:#107C41;">39 Modules</strong></td>
          <td><span class="perm-wildcard">* (Root System Administrator Bypass)</span></td>
          <td><span class="invariant-badge">Canonical Root</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">manage_accounts</span>STORE_MANAGER</span></td>
          <td><span class="code-badge">role-store-manager</span></td>
          <td><span class="persona-badge">PROF_STORE_MANAGER</span></td>
          <td><strong style="color:#0070F2;">37 Modules</strong></td>
          <td><span class="perm-wildcard">* (Full Store Operational Grant)</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">store</span>BRANCH_ADMIN</span></td>
          <td><span class="code-badge">role-branch-admin</span></td>
          <td><span class="persona-badge">PROF_STORE_MANAGER</span></td>
          <td><strong style="color:#0070F2;">14 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.*</span><span class="perm-pill">sales_billing.*</span><span class="perm-pill">staff_mgmt.CREATE</span><span class="perm-pill">reports_portal.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">point_of_sale</span>CASHIER</span></td>
          <td><span class="code-badge">role-cashier</span></td>
          <td><span class="persona-badge">PROF_CASHIER</span></td>
          <td><strong style="color:#0070F2;">10 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.VIEW</span><span class="perm-pill">pos_workspace.NEW</span><span class="perm-pill">sales_billing.RETURN</span><span class="perm-pill">item_master.VIEW</span></td>
          <td><span class="invariant-badge">High-Speed POS</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">support_agent</span>SALES_EXECUTIVE</span></td>
          <td><span class="code-badge">role-sales-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#0070F2;">12 Modules</strong></td>
          <td><span class="perm-pill">pos_workspace.VIEW</span><span class="perm-pill">customer_master.*</span><span class="perm-pill">crm_studio.VIEW</span><span class="perm-pill">loyalty_rewards.VIEW</span></td>
          <td><span class="invariant-badge">Scoped Active</span></td>
        </tr>
        <tr>
          <td><span class="role-name" style="color:#556B82;"><span class="material-symbols-outlined" style="font-size:16px;">lock_clock</span>SALES_EXECUTIVE (Wildcard)</span></td>
          <td><span class="code-badge">role-sales_executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#556B82;">37 Modules</strong></td>
          <td><span class="perm-wildcard">* (Legacy Baseline Preserved)</span></td>
          <td><span class="invariant-badge">Option B Retained</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">inventory_2</span>INVENTORY_MANAGER</span></td>
          <td><span class="code-badge">role-inventory-manager</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#0070F2;">13 Modules</strong></td>
          <td><span class="perm-pill">inventory_workspace.*</span><span class="perm-pill">stock_ledger.*</span><span class="perm-pill">barcode_studio.*</span><span class="perm-pill">purchase_studio.*</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">shopping_cart</span>PURCHASE_EXECUTIVE</span></td>
          <td><span class="code-badge">role-purchase-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#0070F2;">12 Modules</strong></td>
          <td><span class="perm-pill">purchase_studio.*</span><span class="perm-pill">supplier_mgmt.*</span><span class="perm-pill">stock_ledger.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">account_balance</span>ACCOUNTANT</span></td>
          <td><span class="code-badge">role-accountant</span></td>
          <td><span class="persona-badge">PROF_ACCOUNTANT</span></td>
          <td><strong style="color:#0070F2;">8 Modules</strong></td>
          <td><span class="perm-pill">business_ledger.*</span><span class="perm-pill">accounting_sync.VIEW</span><span class="perm-pill">reports_portal.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">groups</span>HR_EXECUTIVE</span></td>
          <td><span class="code-badge">role-hr-executive</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#0070F2;">7 Modules</strong></td>
          <td><span class="perm-pill">staff_mgmt.CREATE</span><span class="perm-pill">staff_mgmt.VIEW</span><span class="perm-pill">staff_mgmt.EDIT</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
        <tr>
          <td><span class="role-name"><span class="material-symbols-outlined" style="font-size:16px;">fact_check</span>AUDITOR</span></td>
          <td><span class="code-badge">role-auditor</span></td>
          <td><span class="persona-badge">PROF_DEFAULT</span></td>
          <td><strong style="color:#0070F2;">11 Modules</strong></td>
          <td><span class="perm-pill">audit_logs.VIEW</span><span class="perm-pill">business_ledger.VIEW</span><span class="perm-pill">stock_ledger.VIEW</span><span class="perm-pill">report_designer.VIEW</span></td>
          <td><span class="invariant-badge">Canonical System</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
"""

# ── 3. HTML Template: Control Plane Menu Registry Studio (Enterprise Light) ────
HTML_MENU_REGISTRY = """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Control Plane Menu Registry Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
  body { background: #F5F6F7; color: #1D2D3E; padding: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D1D9E2; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #0070F2, #0284C7); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #FFFFFF; }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #1D2D3E; }
  .title-text p { font-size: 13px; color: #556B82; font-family: 'JetBrains Mono', monospace; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
  .kpi-card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 10px; padding: 14px 18px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
  .kpi-val { font-size: 24px; font-weight: 800; color: #0070F2; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
  .kpi-label { font-size: 11px; text-transform: uppercase; color: #556B82; font-weight: 700; }
  .grid-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
  .tree-card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 12px; padding: 18px; height: 580px; overflow-y: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .menu-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 6px; margin-bottom: 4px; background: #FAFBFD; border: 1px solid #E2E8F0; font-size: 12px; }
  .menu-item.child { margin-left: 24px; border-left: 2px solid #0070F2; }
  .menu-item.highlight { background: #E8F2FE; border: 1px solid #0070F2; }
  .menu-left { display: flex; align-items: center; gap: 10px; }
  .menu-title { font-weight: 600; color: #1D2D3E; }
  .menu-route { color: #556B82; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .badge-active { background: #E8F8F0; color: #107C41; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-perm { background: #F3E8FF; color: #7E22CE; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
  .preview-card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .preview-header { font-size: 14px; font-weight: 700; color: #0070F2; border-bottom: 1px solid #E2E8F0; padding-bottom: 10px; margin-bottom: 14px; display:flex; justify-content:space-between; }
  .prop-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F0F4F8; font-size: 12px; }
  .prop-label { color: #556B82; font-weight: 500; }
  .prop-val { font-family: 'JetBrains Mono', monospace; color: #1D2D3E; font-weight: 600; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">MR</div>
      <div class="title-text">
        <h1>PostgreSQL Control Plane Menu Registry & Resolver Studio</h1>
        <p>GET /api/v1/menus/resolved &bull; Table: smriti_menus &bull; Security Parity: 39 Modules &bull; Enterprise Light</p>
      </div>
    </div>
    <div style="background:#E8F8F0; border:1px solid #A3E0BF; color:#107C41; padding:6px 14px; border-radius:9999px; font-weight:700; font-size:12px;">
      Matrix Parity: 100% (39 = 39)
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Active Modules</div><div class="kpi-val">39</div></div>
    <div class="kpi-card"><div class="kpi-label">Root Level Workspaces</div><div class="kpi-val">17</div></div>
    <div class="kpi-card"><div class="kpi-label">Cascading Sub-Menus</div><div class="kpi-val">22</div></div>
    <div class="kpi-card"><div class="kpi-label">Pruning Cascade Latency</div><div class="kpi-val" style="color:#107C41;">&lt; 3.2 ms</div></div>
  </div>

  <div class="grid-layout">
    <div class="tree-card">
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#556B82; margin-bottom:12px;">Authoritative Menu Hierarchy Tree</div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">dashboard</span><span class="menu-title">Dashboard & Executive Hub</span><span class="menu-route">/dashboard</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">point_of_sale</span><span class="menu-title">Billing Desk</span><span class="menu-route">/pos</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Desktop Billing Terminal</span><span class="menu-route">/billing</span></div><span class="badge-perm">POS.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Sales Studio & Ledger</span><span class="menu-route">/sales</span></div><span class="badge-perm">SALES.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Customer Master Directory</span><span class="menu-route">/customer-master</span></div><span class="badge-perm">CUSTOMER.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Promotions Studio</span><span class="menu-route">/sales-promotions</span></div><span class="badge-perm">PROMOTIONS.WORKSPACE.ACCESS</span></div>

      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">warehouse</span><span class="menu-title">Inventory Workspace</span><span class="menu-route">/inventory</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Item Master Catalog</span><span class="menu-route">/item-master</span></div><span class="badge-perm">ITEM.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Barcode Studio & Generator</span><span class="menu-route">/barcode</span></div><span class="badge-perm">BARCODE.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Stock Movements & Ledger</span><span class="menu-route">/stock-ledger</span></div><span class="badge-perm">STOCK.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Purchase Studio & Orders</span><span class="menu-route">/purchase</span></div><span class="badge-perm">PURCHASE.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child highlight"><div class="menu-left"><span class="menu-title" style="color:#0070F2; font-weight:700;">Goods Receipt Note (GRN)</span><span class="menu-route">/goods-receipt</span></div><span class="badge-perm" style="border-color:#0070F2; color:#0070F2;">GRN.WORKSPACE.ACCESS</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Supplier / Person Master</span><span class="menu-route">/supplier-mgmt</span></div><span class="badge-perm">SUPPLIER.WORKSPACE.ACCESS</span></div>

      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">account_balance</span><span class="menu-title">Business Ledger & Statements</span><span class="menu-route">/business-ledger</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">analytics</span><span class="menu-title">Reports Portal & Analytics</span><span class="menu-route">/reports</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item child"><div class="menu-left"><span class="menu-title">Visual Report Designer</span><span class="menu-route">/report-designer</span></div><span class="badge-perm">REPORT.DESIGN.ACCESS</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">badge</span><span class="menu-title">Staff Management & Payroll</span><span class="menu-route">/staff-management</span></div><span class="badge-active">ACTIVE</span></div>
      <div class="menu-item"><div class="menu-left"><span class="material-symbols-outlined" style="font-size:16px; color:#0070F2;">shield</span><span class="menu-title">Security Management & Menu Access</span><span class="menu-route">/security-management</span></div><span class="badge-active">ACTIVE</span></div>
    </div>

    <!-- Node Properties Inspector -->
    <div class="preview-card">
      <div class="preview-header">
        <span>Selected Module Inspector: menu-grn</span>
        <span style="color:#107C41; font-size:11px;">SYNCHRONIZED</span>
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
      <div class="prop-row"><span class="prop-label">Lifecycle Status</span><span class="prop-val" style="color:#107C41;">Active / Production</span></div>

      <div style="background:#F0F7FF; border:1px solid #B9D7FB; border-radius:8px; padding:12px; margin-top:20px; font-size:12px; color:#0056B3; line-height:1.5;">
        <strong>Architectural Parity Certified:</strong> Registered in <code>CANONICAL_36_MENU_MATRIX</code>, <code>CANONICAL_39_MENU_MATRIX</code>, <code>TabRenderer.tsx</code> (<code>mapModuleId</code>), and <code>securityStore.ts</code> (<code>MENU_PERMISSION_RESOURCES</code>).
      </div>
    </div>
  </div>
</body>
</html>
"""

# ── 4. HTML Template: Fiori Launchpad Multi-Persona UX (Enterprise Light) ──────
HTML_FIORI_LAUNCHPAD = """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Fiori Launchpad Multi-Persona UX</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
  body { background: #F5F6F7; color: #1D2D3E; padding: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D1D9E2; padding-bottom: 14px; margin-bottom: 18px; }
  .logo-title { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 42px; height: 42px; background: linear-gradient(135deg, #0070F2, #0284C7); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #FFFFFF; }
  .title-text h1 { font-size: 19px; font-weight: 700; color: #1D2D3E; }
  .title-text p { font-size: 12px; color: #556B82; font-family: 'JetBrains Mono', monospace; }
  .persona-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .persona-btn { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: #556B82; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .persona-btn.active { background: #0070F2; color: #FFFFFF; border-color: #0070F2; box-shadow: 0 2px 8px rgba(0, 112, 242, 0.3); }
  .launchpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .persona-column { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 14px; padding: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
  .col-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px; }
  .col-title { font-size: 14px; font-weight: 700; color: #1D2D3E; display: flex; align-items: center; gap: 8px; }
  .col-count { font-size: 11px; font-weight: 700; background: #E8F2FE; color: #0070F2; padding: 2px 8px; border-radius: 9999px; }
  .tiles-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tile { background: #FAFBFD; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 115px; cursor: pointer; transition: all 0.2s; }
  .tile:hover { border-color: #0070F2; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 112, 242, 0.1); }
  .tile-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .tile-icon { font-size: 22px; }
  .tile-tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #F0F4F8; color: #556B82; }
  .tile-title { font-size: 12px; font-weight: 600; color: #1D2D3E; line-height: 1.3; }
  .tile-quick { border-left: 3px solid #0070F2; }
  .tile-kpi { grid-column: span 2; height: 80px; background: linear-gradient(135deg, #F0F7FF, #E8F2FE); border: 1px solid #B9D7FB; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-radius: 10px; }
  .kpi-num { font-size: 22px; font-weight: 800; color: #0070F2; font-family: 'JetBrains Mono', monospace; }
  .kpi-text { font-size: 11px; font-weight: 600; color: #556B82; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">FL</div>
      <div class="title-text">
        <h1>SAP Fiori Launchpad &bull; Dynamic Multi-Persona Workspace</h1>
        <p>Client Component: FioriLaunchpad.tsx &bull; Theme: Enterprise Light (Default) &bull; API: /api/v1/menus/resolved</p>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="background:#FFFFFF; border:1px solid #D1D9E2; border-radius:20px; padding:6px 14px; font-size:12px; font-weight:600; color:#1D2D3E; display:flex; align-items:center; gap:8px;">
        <span style="width:10px; height:10px; border-radius:50%; background:#0070F2;"></span>
        Enterprise Light Preset
      </div>
    </div>
  </div>

  <div class="persona-tabs">
    <div class="persona-btn active"><span class="material-symbols-outlined" style="font-size:18px;">manage_accounts</span>Store Manager (PROF_STORE_MANAGER)</div>
    <div class="persona-btn"><span class="material-symbols-outlined" style="font-size:18px;">point_of_sale</span>POS Cashier (PROF_CASHIER)</div>
    <div class="persona-btn"><span class="material-symbols-outlined" style="font-size:18px;">warehouse</span>Inventory Specialist (PROF_INVENTORY)</div>
  </div>

  <div class="launchpad-grid">
    <!-- Store Manager Column -->
    <div class="persona-column">
      <div class="col-header">
        <div class="col-title"><span class="material-symbols-outlined" style="color:#0070F2;">manage_accounts</span>Store Manager Launchpad</div>
        <div class="col-count">37 Tiles</div>
      </div>
      <div class="tiles-container">
        <div class="tile-kpi"><div><div class="kpi-num">₹ 4,82,900</div><div class="kpi-text">Today's Revenue</div></div><span class="material-symbols-outlined" style="font-size:32px; color:#0070F2;">trending_up</span></div>
        <div class="tile tile-quick"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#0070F2;">point_of_sale</span><span class="tile-tag" style="color:#0070F2;">F1</span></div><div class="tile-title">Quick POS Desk</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#0070F2;">receipt_long</span><span class="tile-tag">Sales</span></div><div class="tile-title">Sales Studio</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#0070F2;">inventory_2</span><span class="tile-tag">WMS</span></div><div class="tile-title">Stock Ledger</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#0070F2;">badge</span><span class="tile-tag">HR</span></div><div class="tile-title">Staff Provisioning</div></div>
      </div>
    </div>

    <!-- POS Cashier Column -->
    <div class="persona-column">
      <div class="col-header">
        <div class="col-title"><span class="material-symbols-outlined" style="color:#107C41;">point_of_sale</span>Cashier Fast Terminal</div>
        <div class="col-count">10 Tiles</div>
      </div>
      <div class="tiles-container">
        <div class="tile-kpi" style="background:linear-gradient(135deg, #F2FDF5, #E8F8F0); border-color:#A3E0BF;"><div><div class="kpi-num" style="color:#107C41;">184 Bills</div><div class="kpi-text">Shift Volume</div></div><span class="material-symbols-outlined" style="font-size:32px; color:#107C41;">shopping_bag</span></div>
        <div class="tile tile-quick" style="border-left-color:#107C41;"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#107C41;">point_of_sale</span><span class="tile-tag" style="color:#107C41;">F1</span></div><div class="tile-title">Desktop Billing</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#107C41;">payments</span><span class="tile-tag">F2</span></div><div class="tile-title">Day Shift Drawer</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#107C41;">keyboard_return</span><span class="tile-tag">F3</span></div><div class="tile-title">Return & Refund</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#107C41;">person_search</span><span class="tile-tag">CRM</span></div><div class="tile-title">Customer Lookup</div></div>
      </div>
    </div>

    <!-- Inventory Column -->
    <div class="persona-column">
      <div class="col-header">
        <div class="col-title"><span class="material-symbols-outlined" style="color:#E9730C;">warehouse</span>Inventory Specialist</div>
        <div class="col-count">13 Tiles</div>
      </div>
      <div class="tiles-container">
        <div class="tile-kpi" style="background:linear-gradient(135deg, #FFF9F2, #FEEFD8); border-color:#FCD34D;"><div><div class="kpi-num" style="color:#E9730C;">1,240 SKUs</div><div class="kpi-text">Active Items</div></div><span class="material-symbols-outlined" style="font-size:32px; color:#E9730C;">qr_code_scanner</span></div>
        <div class="tile tile-quick" style="border-left-color:#E9730C;"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#E9730C;">barcode_scanner</span><span class="tile-tag" style="color:#E9730C;">Item</span></div><div class="tile-title">Item Master</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#E9730C;">shopping_cart</span><span class="tile-tag" style="color:#E9730C;">PO</span></div><div class="tile-title">Purchase Orders</div></div>
        <div class="tile tile-quick" style="border-left-color:#E9730C;"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#E9730C;">fact_check</span><span class="tile-tag" style="color:#E9730C;">F4</span></div><div class="tile-title">Goods Receipt (GRN)</div></div>
        <div class="tile"><div class="tile-top"><span class="material-symbols-outlined tile-icon" style="color:#E9730C;">local_shipping</span><span class="tile-tag" style="color:#E9730C;">Vendor</span></div><div class="tile-title">Supplier 360</div></div>
      </div>
    </div>
  </div>
</body>
</html>
"""

# ── 5. HTML Template: SMRITI Theme Presets Architecture Showcase ───────────────
HTML_THEME_PRESETS_SHOWCASE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMRITI Retail OS — Theme Engine & Preset Architecture</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
  body { background: #F5F6F7; color: #1D2D3E; padding: 28px; }
  .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D1D9E2; padding-bottom: 18px; margin-bottom: 24px; }
  .logo-title { display: flex; align-items: center; gap: 14px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #0070F2, #7E22CE); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #FFFFFF; }
  .title-text h1 { font-size: 20px; font-weight: 700; color: #1D2D3E; }
  .title-text p { font-size: 13px; color: #556B82; font-family: 'JetBrains Mono', monospace; }
  .grid-presets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; }
  .preset-card { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 12px; padding: 16px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .preset-card.is-default { border: 2px solid #0070F2; }
  .badge-default { position: absolute; top: -10px; right: 12px; background: #0070F2; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
  .swatch-box { width: 100%; height: 60px; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #E2E8F0; }
  .swatch-accent { width: 24px; height: 24px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  .preset-name { font-size: 13px; font-weight: 700; color: #1D2D3E; margin-bottom: 4px; }
  .preset-desc { font-size: 11px; color: #556B82; line-height: 1.4; margin-bottom: 8px; min-height: 44px; }
  .preset-tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }

  .comparison-box { background: #FFFFFF; border: 1px solid #D1D9E2; border-radius: 14px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
  .comp-title { font-size: 15px; font-weight: 700; color: #1D2D3E; margin-bottom: 14px; border-bottom: 1px solid #E2E8F0; padding-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .split-view { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .theme-panel-light { background: #F5F6F7; border: 1px solid #D1D9E2; border-radius: 10px; padding: 16px; color: #1D2D3E; }
  .theme-panel-dark { background: #121721; border: 1px solid #2D3A52; border-radius: 10px; padding: 16px; color: #F8FAFC; }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-icon">TP</div>
      <div class="title-text">
        <h1>SMRITI Theme Architecture & Canonical Preset System</h1>
        <p>Engine: ThemeContext.tsx &bull; Config: theme_presets.ts &bull; Canonical Default: Enterprise Light</p>
      </div>
    </div>
    <div style="background:#E8F2FE; border:1px solid #B9D7FB; color:#0070F2; padding:6px 14px; border-radius:9999px; font-weight:700; font-size:12px;">
      Default Preset: enterprise-light
    </div>
  </div>

  <div class="grid-presets">
    <!-- Preset 1: Enterprise Light (DEFAULT) -->
    <div class="preset-card is-default">
      <span class="badge-default">SYSTEM DEFAULT</span>
      <div class="swatch-box" style="background:#F5F6F7;"><div class="swatch-accent" style="background:#0070F2;"></div></div>
      <div class="preset-name">Enterprise Light</div>
      <div class="preset-desc">SAP Fiori Morning Horizon light workspace — ideal for office, admin & B2B ERP desktop use.</div>
      <span class="preset-tag" style="background:#E8F2FE; color:#0070F2;">mode: light</span>
      <span class="preset-tag" style="background:#F0F4F8; color:#556B82;">density: comfortable</span>
    </div>

    <!-- Preset 2: Enterprise Dark -->
    <div class="preset-card">
      <div class="swatch-box" style="background:#121721;"><div class="swatch-accent" style="background:#0070F2;"></div></div>
      <div class="preset-name">Enterprise Dark</div>
      <div class="preset-desc">Deep navy dark mode — designed for low-light management consoles and night shifts.</div>
      <span class="preset-tag" style="background:#1E293B; color:#93C5FD;">mode: dark</span>
      <span class="preset-tag" style="background:#F0F4F8; color:#556B82;">density: comfortable</span>
    </div>

    <!-- Preset 3: POS Night Mode -->
    <div class="preset-card">
      <div class="swatch-box" style="background:#0D1B2A;"><div class="swatch-accent" style="background:#10B981;"></div></div>
      <div class="preset-name">POS Night Mode</div>
      <div class="preset-desc">Compact emerald dark — anti-glare optimised for supermarket touch POS cashier screens.</div>
      <span class="preset-tag" style="background:#064E3B; color:#34D399;">mode: dark</span>
      <span class="preset-tag" style="background:#F0F4F8; color:#556B82;">density: compact</span>
    </div>

    <!-- Preset 4: Retail Day -->
    <div class="preset-card">
      <div class="swatch-box" style="background:#FFFAF5;"><div class="swatch-accent" style="background:#E9730C;"></div></div>
      <div class="preset-name">Retail Day</div>
      <div class="preset-desc">Spacious amber light — high-legibility touch displays and shop-floor kiosk monitors.</div>
      <span class="preset-tag" style="background:#FFF9F2; color:#E9730C;">mode: light</span>
      <span class="preset-tag" style="background:#F0F4F8; color:#556B82;">density: spacious</span>
    </div>

    <!-- Preset 5: High Contrast -->
    <div class="preset-card">
      <div class="swatch-box" style="background:#0A0A0A;"><div class="swatch-accent" style="background:#FACC15;"></div></div>
      <div class="preset-name">High Contrast</div>
      <div class="preset-desc">WCAG AA+ yellow-on-black — maximum visibility for visual accessibility and audit environments.</div>
      <span class="preset-tag" style="background:#000000; color:#FACC15;">mode: dark</span>
      <span class="preset-tag" style="background:#F0F4F8; color:#556B82;">density: comfortable</span>
    </div>
  </div>

  <div class="comparison-box">
    <div class="comp-title">
      <span class="material-symbols-outlined" style="color:#0070F2;">contrast</span>
      Side-by-Side Look & Feel: Enterprise Light (Default) vs Enterprise Dark
    </div>
    <div class="split-view">
      <!-- Light View -->
      <div class="theme-panel-light">
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#0070F2; margin-bottom:8px;">Canonical Enterprise Light (Active System Default)</div>
        <div style="background:#FFFFFF; border:1px solid #D1D9E2; border-radius:8px; padding:12px; margin-bottom:10px;">
          <div style="font-weight:700; font-size:13px; color:#1D2D3E; margin-bottom:4px;">Invoice #INV-2026-1049 &bull; ₹ 14,890.00</div>
          <div style="font-size:11px; color:#556B82;">Customer: Reliance Supermart Ltd &bull; Status: Settled</div>
        </div>
        <div style="font-size:11px; color:#556B82; line-height:1.5;">
          • Background: <code>#F5F6F7</code> (Fiori Base)<br>
          • Cards/Surfaces: <code>#FFFFFF</code> (Clean White)<br>
          • Typography: <code>#1D2D3E</code> on <code>#556B82</code><br>
          • Primary Accent: <code>#0070F2</code> (SMRITI Royal Blue)
        </div>
      </div>

      <!-- Dark View -->
      <div class="theme-panel-dark">
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#38BDF8; margin-bottom:8px;">Optional Enterprise Dark (Night Shifts & POS)</div>
        <div style="background:#1A2232; border:1px solid #2D3A52; border-radius:8px; padding:12px; margin-bottom:10px;">
          <div style="font-weight:700; font-size:13px; color:#F8FAFC; margin-bottom:4px;">Invoice #INV-2026-1049 &bull; ₹ 14,890.00</div>
          <div style="font-size:11px; color:#94A3B8;">Customer: Reliance Supermart Ltd &bull; Status: Settled</div>
        </div>
        <div style="font-size:11px; color:#94A3B8; line-height:1.5;">
          • Background: <code>#121721</code> (Navy Deep Base)<br>
          • Cards/Surfaces: <code>#1A2232</code> (Navy Surface)<br>
          • Typography: <code>#F8FAFC</code> on <code>#94A3B8</code><br>
          • Primary Accent: <code>#0070F2</code> / <code>#10B981</code> (POS Emerald)
        </div>
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
        ("05_smriti_theme_presets_architecture", HTML_THEME_PRESETS_SHOWCASE),
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

    print("[3/3] All headless screenshots in Enterprise Light captured successfully!")

if __name__ == "__main__":
    asyncio.run(main())
