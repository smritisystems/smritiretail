"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from dataclasses import dataclass

PERMISSION_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class PermissionDefinition:
    code: str
    module: str
    resource: str
    action: str
    scope: str
    description: str
    category: str  # Platform, Security, Business, Reporting, Audit


# Central manifest definitions
MANIFEST: list[PermissionDefinition] = [
    # --- PLATFORM MODULE ---
    PermissionDefinition(
        code="SYSTEM.CONFIG",
        module="System",
        resource="Configuration",
        action="Manage",
        scope="GLOBAL",
        description="Allows editing global system parameters and configurations",
        category="Platform"
    ),
    PermissionDefinition(
        code="LICENSE.MANAGE",
        module="System",
        resource="License",
        action="Manage",
        scope="GLOBAL",
        description="Allows managing product licensing and activation keys",
        category="Platform"
    ),
    PermissionDefinition(
        code="DEVELOPER.DEBUG",
        module="System",
        resource="DeveloperTools",
        action="Access",
        scope="GLOBAL",
        description="Allows access to developer/debugging tools",
        category="Platform"
    ),
    PermissionDefinition(
        code="API.MANAGE",
        module="System",
        resource="APIKey",
        action="Manage",
        scope="GLOBAL",
        description="Allows managing external API access credentials",
        category="Platform"
    ),
    # --- SECURITY MODULE ---
    PermissionDefinition(
        code="SECURITY.MANAGE_ROLES",
        module="Security",
        resource="Role",
        action="Manage",
        scope="GLOBAL",
        description="Allows creating, modifying, and deleting system roles",
        category="Security"
    ),
    PermissionDefinition(
        code="SECURITY.MANAGE_POLICIES",
        module="Security",
        resource="Policy",
        action="Manage",
        scope="GLOBAL",
        description="Allows creating, modifying, and deleting access policies",
        category="Security"
    ),
    PermissionDefinition(
        code="SECURITY.VIEW_SETTINGS",
        module="Security",
        resource="Settings",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing security settings and auditing logs",
        category="Security"
    ),
    # --- SALES MODULE ---
    PermissionDefinition(
        code="SALES.CREATE",
        module="Sales",
        resource="Invoice",
        action="Create",
        scope="OWN_BRANCH",
        description="Allows creating sales invoices",
        category="Business"
    ),
    PermissionDefinition(
        code="SALES.UPDATE",
        module="Sales",
        resource="Invoice",
        action="Update",
        scope="OWN_BRANCH",
        description="Allows editing/updating sales invoices and quotations",
        category="Business"
    ),
    PermissionDefinition(
        code="SALES.APPROVE",
        module="Sales",
        resource="Invoice",
        action="Approve",
        scope="OWN_BRANCH",
        description="Allows approving sales invoices",
        category="Business"
    ),
    PermissionDefinition(
        code="SALES.VIEW",
        module="Sales",
        resource="Invoice",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing sales invoices and logs",
        category="Business"
    ),
    PermissionDefinition(
        code="SALES.DELETE",
        module="Sales",
        resource="Invoice",
        action="Delete",
        scope="OWN_BRANCH",
        description="Allows voiding/deleting sales invoices",
        category="Business"
    ),
    # --- PURCHASE MODULE ---
    PermissionDefinition(
        code="PURCHASE.CREATE",
        module="Purchase",
        resource="PurchaseOrder",
        action="Create",
        scope="OWN_BRANCH",
        description="Allows creating purchase orders",
        category="Business"
    ),
    PermissionDefinition(
        code="PURCHASE.UPDATE",
        module="Purchase",
        resource="PurchaseOrder",
        action="Update",
        scope="OWN_BRANCH",
        description="Allows editing/updating purchase orders",
        category="Business"
    ),
    PermissionDefinition(
        code="PURCHASE.APPROVE",
        module="Purchase",
        resource="PurchaseOrder",
        action="Approve",
        scope="OWN_BRANCH",
        description="Allows approving purchase orders",
        category="Business"
    ),
    PermissionDefinition(
        code="PURCHASE.VIEW",
        module="Purchase",
        resource="PurchaseOrder",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing purchase orders and receipts",
        category="Business"
    ),
    PermissionDefinition(
        code="PURCHASE.DELETE",
        module="Purchase",
        resource="PurchaseOrder",
        action="Delete",
        scope="OWN_BRANCH",
        description="Allows deleting purchase orders",
        category="Business"
    ),
    # --- INVENTORY/ITEM MODULE ---
    PermissionDefinition(
        code="ITEM.CREATE",
        module="Inventory",
        resource="Product",
        action="Create",
        scope="ALL_BRANCHES",
        description="Allows creating item catalog records",
        category="Business"
    ),
    PermissionDefinition(
        code="ITEM.VIEW",
        module="Inventory",
        resource="Product",
        action="View",
        scope="ALL_BRANCHES",
        description="Allows viewing item catalog records",
        category="Business"
    ),
    PermissionDefinition(
        code="ITEM.UPDATE",
        module="Inventory",
        resource="Product",
        action="Update",
        scope="ALL_BRANCHES",
        description="Allows editing item catalog records",
        category="Business"
    ),
    PermissionDefinition(
        code="ITEM.DELETE",
        module="Inventory",
        resource="Product",
        action="Delete",
        scope="ALL_BRANCHES",
        description="Allows deleting item catalog records",
        category="Business"
    ),
    # --- CRM MODULE ---
    PermissionDefinition(
        code="CRM.MANAGE_CUSTOMERS",
        module="CRM",
        resource="Customer",
        action="Manage",
        scope="OWN_BRANCH",
        description="Allows adding, updating, and removing customers",
        category="Business"
    ),
    PermissionDefinition(
        code="CRM.VIEW_LOYALTY",
        module="CRM",
        resource="Loyalty",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing loyalty points and rewards stats",
        category="Business"
    ),
    # --- POS MODULE ---
    PermissionDefinition(
        code="POS.CHECKOUT",
        module="POS",
        resource="Terminal",
        action="Checkout",
        scope="OWN_BRANCH",
        description="Allows processing retail sales checkouts at POS terminal",
        category="Business"
    ),
    PermissionDefinition(
        code="POS.OPEN_SHIFT",
        module="POS",
        resource="Shift",
        action="Open",
        scope="OWN_BRANCH",
        description="Allows opening a new POS shift and cash drawer register",
        category="Business"
    ),
    PermissionDefinition(
        code="POS.CLOSE_SHIFT",
        module="POS",
        resource="Shift",
        action="Close",
        scope="OWN_BRANCH",
        description="Allows closing and reconciling an active POS shift",
        category="Business"
    ),
    # --- REPORT MODULE ---
    PermissionDefinition(
        code="REPORT.VIEW",
        module="Reports",
        resource="Report",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing business reports",
        category="Reporting"
    ),
    PermissionDefinition(
        code="REPORT.EXPORT",
        module="Reports",
        resource="Report",
        action="Export",
        scope="OWN_BRANCH",
        description="Allows exporting business reports to CSV/Excel",
        category="Reporting"
    ),
    # --- RECOVERY MODULES ---
    PermissionDefinition(
        code="BACKUP.SYSTEM.RUN",
        module="System",
        resource="SystemBackup",
        action="Backup",
        scope="GLOBAL",
        description="Allows taking root system backups",
        category="Platform"
    ),
    PermissionDefinition(
        code="RESTORE.SYSTEM.RUN",
        module="System",
        resource="SystemRestore",
        action="Restore",
        scope="GLOBAL",
        description="Allows restoring root system from backups",
        category="Platform"
    ),
    PermissionDefinition(
        code="BACKUP.COMPANY.RUN",
        module="System",
        resource="CompanyBackup",
        action="Backup",
        scope="COMPANY",
        description="Allows taking company-scoped database backups",
        category="Business"
    ),
    PermissionDefinition(
        code="RESTORE.COMPANY.RUN",
        module="System",
        resource="CompanyRestore",
        action="Restore",
        scope="COMPANY",
        description="Allows restoring company-scoped database backups",
        category="Business"
    ),
    # --- USER MANAGEMENT ---
    PermissionDefinition(
        code="USER.MANAGE",
        module="Security",
        resource="User",
        action="Manage",
        scope="COMPANY",
        description="Allows managing employee and user accounts",
        category="Security"
    ),
    PermissionDefinition(
        code="ROLE.MANAGE",
        module="Security",
        resource="Role",
        action="Manage",
        scope="COMPANY",
        description="Allows managing role configurations",
        category="Security"
    ),
    PermissionDefinition(
        code="POLICY.MANAGE",
        module="Security",
        resource="Policy",
        action="Manage",
        scope="COMPANY",
        description="Allows managing access policy maps",
        category="Security"
    ),
    PermissionDefinition(
        code="PERMISSION.MANAGE",
        module="Security",
        resource="Permission",
        action="Manage",
        scope="COMPANY",
        description="Allows managing security permission records",
        category="Security"
    ),
    PermissionDefinition(
        code="COMPANY.MANAGE",
        module="System",
        resource="Company",
        action="Manage",
        scope="GLOBAL",
        description="Allows managing corporate registration records",
        category="Platform"
    ),
    PermissionDefinition(
        code="BRANCH.MANAGE",
        module="System",
        resource="Branch",
        action="Manage",
        scope="COMPANY",
        description="Allows managing business branch locations",
        category="Platform"
    ),
    PermissionDefinition(
        code="DEPARTMENT.MANAGE",
        module="System",
        resource="Department",
        action="Manage",
        scope="COMPANY",
        description="Allows managing organizational departments",
        category="Platform"
    ),
    PermissionDefinition(
        code="SUPPLIER.MANAGE",
        module="Purchase",
        resource="Supplier",
        action="Manage",
        scope="COMPANY",
        description="Allows managing purchasing suppliers",
        category="Business"
    ),
    PermissionDefinition(
        code="ACCOUNT.MANAGE",
        module="Finance",
        resource="Account",
        action="Manage",
        scope="COMPANY",
        description="Allows managing chart of accounts",
        category="Business"
    ),
    PermissionDefinition(
        code="PAYMENT.MANAGE",
        module="Finance",
        resource="Payment",
        action="Manage",
        scope="COMPANY",
        description="Allows managing payment modes",
        category="Business"
    ),
    # --- WORKFLOW MODULES ---
    PermissionDefinition(
        code="WORKFLOW.CONFIG",
        module="System",
        resource="Workflow",
        action="Configure",
        scope="COMPANY",
        description="Allows configuring document approval workflows",
        category="Platform"
    ),
    PermissionDefinition(
        code="APPROVAL.LIMIT",
        module="System",
        resource="ApprovalLimit",
        action="Configure",
        scope="COMPANY",
        description="Allows defining financial approval limits",
        category="Platform"
    ),
    PermissionDefinition(
        code="MENU.MANAGE",
        module="Security",
        resource="Menu",
        action="Configure",
        scope="GLOBAL",
        description="Allows modifying dynamic system menu items",
        category="Security"
    ),
    PermissionDefinition(
        code="DASHBOARD.VIEW",
        module="Core",
        resource="Dashboard",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing store statistics dashboard",
        category="Reporting"
    ),
    PermissionDefinition(
        code="SETTINGS.VIEW",
        module="Core",
        resource="Settings",
        action="View",
        scope="OWN_BRANCH",
        description="Allows viewing general application settings",
        category="Platform"
    ),
    PermissionDefinition(
        code="AUDIT.VIEW",
        module="Security",
        resource="AuditLog",
        action="View",
        scope="COMPANY",
        description="Allows viewing immutable audit trail logs",
        category="Audit"
    ),
]


def validate_manifest() -> None:
    """
    Validate the manifest to ensure consistency and prevent coding drift.
    """
    codes: set[str] = set()
    allowed_scopes = {"GLOBAL", "COMPANY", "ALL_BRANCHES", "OWN_BRANCH", "OWN_DOCUMENT"}
    allowed_categories = {"Platform", "Security", "Business", "Reporting", "Audit"}

    for definition in MANIFEST:
        # Check duplicate code
        if definition.code in codes:
            raise ValueError(f"Duplicate permission code found in manifest: {definition.code}")
        codes.add(definition.code)

        # Check description
        if not definition.description or len(definition.description.strip()) < 5:
            raise ValueError(f"Invalid or missing description for permission code: {definition.code}")

        # Check valid scope
        if definition.scope not in allowed_scopes:
            raise ValueError(f"Invalid scope '{definition.scope}' for permission code: {definition.code}")

        # Check valid category
        if definition.category not in allowed_categories:
            raise ValueError(f"Invalid category '{definition.category}' for permission code: {definition.code}")


# Run validation immediately on module load to guarantee schema safety
validate_manifest()
