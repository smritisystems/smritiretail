"""Register admin menu and security management workspaces in the canonical menu registry."""

from alembic import op
import sqlalchemy as sa


revision = "v1449_seed_admin_menu_workspaces"
down_revision = "v1448_barcode_audit_soft_delete_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "smriti_menus" not in inspector.get_table_names():
        return
    op.execute(
        """
        INSERT INTO smriti_menus
            (id, uuid, company_id, title, route, module, parent_id, sequence, permission, is_active, is_deleted, created_at, modified_at)
        VALUES
            ('menu-dashboard', 'menu-dashboard-canonical-uuid', NULL, 'Dashboard & Executive Hub', '/dashboard', 'Dashboard & Operations', NULL, 10, 'DASHBOARD.ACCESS', true, false, NOW(), NOW()),
            ('menu-user-profile', 'menu-user-profile-canonical-uuid', NULL, 'My Profile Dashboard', '/user-profile', 'Dashboard & Operations', NULL, 20, 'PROFILE.ACCESS', true, false, NOW(), NOW()),
            ('menu-wiki', 'menu-wiki-canonical-uuid', NULL, 'SMRITI Gyan Kendra', '/wiki', 'System & Knowledge Base', NULL, 30, 'WIKI.ACCESS', true, false, NOW(), NOW()),
            ('menu-about-smriti', 'menu-about-smriti-canonical-uuid', NULL, 'About SMRITI Retail OS', '/about-smriti', 'System & Knowledge Base', NULL, 40, 'ABOUT.ACCESS', true, false, NOW(), NOW()),
            ('menu-dev-tracker', 'menu-dev-tracker-canonical-uuid', NULL, 'Dev Intelligence Center', '/dev-tracker', 'System & Knowledge Base', NULL, 50, 'SYSTEM.DEV', true, false, NOW(), NOW()),
            ('menu-pos', 'menu-pos-canonical-uuid', NULL, 'Billing Desk (Universal POS)', '/pos', 'Sales & POS', NULL, 60, 'POS.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-sales', 'menu-sales-canonical-uuid', NULL, 'Sales Studio & Ledger', '/sales', 'Sales & POS', 'menu-pos', 70, 'SALES.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-customer-master', 'menu-customer-master-canonical-uuid', NULL, 'Customer Master Directory', '/customer-master', 'Sales & POS', 'menu-pos', 80, 'CUSTOMER.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-crm', 'menu-crm-canonical-uuid', NULL, 'CRM & Engagement Studio', '/crm', 'Sales & POS', 'menu-pos', 90, 'CRM.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-loyalty', 'menu-loyalty-canonical-uuid', NULL, 'Loyalty & Rewards Studio', '/loyalty', 'Sales & POS', 'menu-pos', 100, 'LOYALTY.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-profiles', 'menu-profiles-canonical-uuid', NULL, 'POS Terminal Profiles', '/profiles', 'Sales & POS', 'menu-pos', 110, 'TERMINALS.MANAGE', true, false, NOW(), NOW()),
            ('menu-inventory', 'menu-inventory-canonical-uuid', NULL, 'Inventory Workspace', '/inventory', 'Inventory & Purchase', NULL, 120, 'INVENTORY.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-item-master', 'menu-item-master-canonical-uuid', NULL, 'Item Master Catalog', '/item-master', 'Inventory & Purchase', 'menu-inventory', 130, 'ITEM.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-barcode', 'menu-barcode-canonical-uuid', NULL, 'Barcode Studio & Generator', '/barcode', 'Inventory & Purchase', 'menu-inventory', 140, 'BARCODE.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-stock-ledger', 'menu-stock-ledger-canonical-uuid', NULL, 'Stock Movements & Ledger', '/stock-ledger', 'Inventory & Purchase', 'menu-inventory', 150, 'STOCK.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-purchase', 'menu-purchase-canonical-uuid', NULL, 'Purchase Studio & Orders', '/purchase', 'Inventory & Purchase', 'menu-inventory', 160, 'PURCHASE.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-supplier-mgmt', 'menu-supplier-mgmt-canonical-uuid', NULL, 'Supplier / Person Master', '/supplier-mgmt', 'Inventory & Purchase', 'menu-inventory', 170, 'SUPPLIER.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-business-ledger', 'menu-business-ledger-canonical-uuid', NULL, 'Business Ledger & Statements', '/business-ledger', 'Accounts', NULL, 180, 'ACCOUNTS.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-accounting-sync', 'menu-accounting-sync-canonical-uuid', NULL, 'Tally / ERP Accounting Sync', '/accounting-sync', 'Accounts', NULL, 190, 'ACCOUNTS.SYNC.EXECUTE', true, false, NOW(), NOW()),
            ('menu-reports', 'menu-reports-canonical-uuid', NULL, 'Reports Portal & Analytics', '/reports', 'Reports', NULL, 200, 'REPORT.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-report-designer', 'menu-report-designer-canonical-uuid', NULL, 'Visual Report Designer', '/report-designer', 'Reports', 'menu-reports', 210, 'REPORT.DESIGN.ACCESS', true, false, NOW(), NOW()),
            ('menu-masters', 'menu-masters-canonical-uuid', NULL, 'Configuration & Governance Hub', '/masters', 'Configuration & Governance', NULL, 220, 'CONFIG.GOVERNANCE.ACCESS', true, false, NOW(), NOW()),
            ('menu-ufe', 'menu-ufe-canonical-uuid', NULL, 'Universal Field Explorer (UFE)', '/ufe', 'Configuration & Governance', 'menu-masters', 230, 'UFE.ACCESS', true, false, NOW(), NOW()),
            ('menu-formulas', 'menu-formulas-canonical-uuid', NULL, 'Formula & KPI Registry', '/formulas', 'Configuration & Governance', 'menu-masters', 240, 'FORMULA.MANAGE', true, false, NOW(), NOW()),
            ('menu-psv', 'menu-psv-canonical-uuid', NULL, 'Channel Visibility Matrix (PSV)', '/psv', 'Configuration & Governance', 'menu-masters', 250, 'PSV.MANAGE', true, false, NOW(), NOW()),
            ('menu-document-series', 'menu-document-series-canonical-uuid', NULL, 'Numbering Engine & Series', '/document-series', 'Configuration & Governance', 'menu-masters', 260, 'NUMBERING.MANAGE', true, false, NOW(), NOW()),
            ('menu-print-studio', 'menu-print-studio-canonical-uuid', NULL, 'Print Studio & Template Designer', '/print-studio', 'Configuration & Governance', 'menu-masters', 270, 'PRINT.MANAGE', true, false, NOW(), NOW()),
            ('menu-print-history', 'menu-print-history-canonical-uuid', NULL, 'Print Audit & History Logs', '/print-history', 'Configuration & Governance', 'menu-masters', 280, 'PRINT.LOG.ACCESS', true, false, NOW(), NOW()),
            ('menu-terms-engine', 'menu-terms-engine-canonical-uuid', NULL, 'Terms & Conditions Engine', '/terms-engine', 'Configuration & Governance', 'menu-masters', 290, 'TERMS.MANAGE', true, false, NOW(), NOW()),
            ('menu-data-exchange', 'menu-data-exchange-canonical-uuid', NULL, 'Data Exchange & Migration Hub', '/data-exchange', 'Configuration & Governance', 'menu-masters', 300, 'DATA.IMPORT.ACCESS', true, false, NOW(), NOW()),
            ('menu-staff-management', 'menu-staff-management-canonical-uuid', NULL, 'Staff Management & Payroll', '/staff-management', 'Administration', NULL, 310, 'STAFF.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-approval-matrix', 'menu-approval-matrix-canonical-uuid', NULL, 'Approval Matrix Governance', '/approval-matrix', 'Administration', NULL, 320, 'APPROVAL.MANAGE', true, false, NOW(), NOW()),
            ('menu-company-setup', 'menu-company-setup-canonical-uuid', NULL, 'Company Setup & Branch Config', '/company-setup', 'Administration', NULL, 330, 'COMPANY.SETUP.ACCESS', true, false, NOW(), NOW()),
            ('menu-audit-logs', 'menu-audit-logs-canonical-uuid', NULL, 'System Audit Trail & Security Logs', '/audit-logs', 'Administration', NULL, 340, 'AUDIT.WORKSPACE.ACCESS', true, false, NOW(), NOW()),
            ('menu-manager', 'menu-manager-canonical-uuid', NULL, 'Menu Manager & Navigation Studio', '/menu-manager', 'Administration', NULL, 350, 'NAVIGATION.MANAGE', true, false, NOW(), NOW()),
            ('menu-security', 'menu-security-canonical-uuid', NULL, 'Security Management & Menu Access', '/security-management', 'Administration', NULL, 360, 'SECURITY.MENU.ACCESS', true, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            route = EXCLUDED.route,
            module = EXCLUDED.module,
            sequence = EXCLUDED.sequence,
            permission = EXCLUDED.permission,
            is_active = true,
            is_deleted = false
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM smriti_menus WHERE id IN ('menu-manager', 'menu-security')")