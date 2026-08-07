/**
 * Project      : SMRITI Retail OS
 * Module       : Module Manifest Registry (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 6.0.0
 */

import { LaunchpadTileManifest } from "../types/launchpadTypes.ts";

class ModuleRegistryImpl {
  private manifests: Map<string, LaunchpadTileManifest> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaultTiles: LaunchpadTileManifest[] = [
      // ════════════════════════════════════════════════════════════════════════
      // OPERATIONS CATEGORY
      // ════════════════════════════════════════════════════════════════════════
      {
        id: "pos-terminal",
        title: "Point of Sale (POS)",
        subtitle: "Quick Checkout & Shift Management",
        category: "Operations",
        iconName: "ShoppingCart",
        permissionScope: "POS_VIEW",
        badge: "Fast Track",
        targetTab: "pos",
        orderIndex: 1
      },
      {
        id: "sales-studio",
        title: "Sales & Invoicing",
        subtitle: "Tax Invoices, Quotations & Deliveries",
        category: "Operations",
        iconName: "Receipt",
        permissionScope: "SALES_VIEW",
        targetTab: "sales",
        orderIndex: 2
      },
      {
        id: "sales-returns",
        title: "Sales Returns",
        subtitle: "Customer Credit Notes & RMA Processing",
        category: "Operations",
        iconName: "RotateCcw",
        permissionScope: "SALES_RETURN",
        targetTab: "sales-returns",
        orderIndex: 3
      },
      {
        id: "purchase-studio",
        title: "Procurement & POs",
        subtitle: "Purchase Orders, GRNs & Vendor Bills",
        category: "Operations",
        iconName: "Briefcase",
        permissionScope: "PURCHASE_VIEW",
        targetTab: "purchase",
        orderIndex: 4
      },
      {
        id: "consignment-studio",
        title: "Consignment Studio",
        subtitle: "Vendor & Outward Consignment Management",
        category: "Operations",
        iconName: "Truck",
        permissionScope: "CONSIGNMENT_VIEW",
        targetTab: "consignment-studio",
        orderIndex: 4.1
      },
      {
        id: "scdm-studio",
        title: "Supply Chain & Distribution",
        subtitle: "Channel Distribution & Inter-Branch Stock Transfers",
        category: "Operations",
        iconName: "Network",
        permissionScope: "SCDM_VIEW",
        targetTab: "scdm-studio",
        orderIndex: 4.2
      },
      {
        id: "ecommerce-studio",
        title: "E-Commerce Studio",
        subtitle: "Online Marketplace Integrations & Storefront Sync",
        category: "Operations",
        iconName: "ShoppingBag",
        permissionScope: "ECOM_VIEW",
        targetTab: "ecommerce-studio",
        orderIndex: 4.3
      },

      // ════════════════════════════════════════════════════════════════════════
      // MASTERS CATEGORY
      // ════════════════════════════════════════════════════════════════════════
      {
        id: "item-master",
        title: "Product Master",
        subtitle: "Inventory SKUs, Pricing & Barcodes",
        category: "Masters",
        iconName: "Package",
        permissionScope: "ITEM_VIEW",
        targetTab: "item-master",
        orderIndex: 5
      },
      {
        id: "customer-master",
        title: "Customer CRM",
        subtitle: "Profiles, Credit Limits & History",
        category: "Masters",
        iconName: "Users",
        permissionScope: "CRM_VIEW",
        targetTab: "customers",
        orderIndex: 6
      },
      {
        id: "suppliers",
        title: "Supplier & Vendor Master",
        subtitle: "Vendor Records, Debits & Performance Analytics",
        category: "Masters",
        iconName: "Building",
        permissionScope: "PURCHASE_VIEW",
        targetTab: "suppliers",
        orderIndex: 6.1
      },
      {
        id: "loyalty",
        title: "Loyalty & Rewards",
        subtitle: "Customer Points, Tiers & Reward Redemption",
        category: "Masters",
        iconName: "Gift",
        permissionScope: "LOYALTY_VIEW",
        targetTab: "loyalty",
        orderIndex: 6.2
      },
      {
        id: "print-studio",
        title: "Barcode Label Hub",
        subtitle: "Direct Thermal & Label Printing",
        category: "Masters",
        iconName: "Printer",
        permissionScope: "PRINT_VIEW",
        targetTab: "print-studio",
        orderIndex: 7
      },
      {
        id: "universal-label-printer",
        title: "Universal Label Printer",
        subtitle: "Apparel Size/Color Pivot Printing",
        category: "Masters",
        iconName: "Printer",
        permissionScope: "PRINT_VIEW",
        targetTab: "universal-label-printer",
        orderIndex: 8
      },

      // ════════════════════════════════════════════════════════════════════════
      // ANALYTICS CATEGORY
      // ════════════════════════════════════════════════════════════════════════
      {
        id: "daily-reports",
        title: "Reports & Analytics",
        subtitle: "Valuation, GST & Daily Summaries",
        category: "Analytics",
        iconName: "FileText",
        permissionScope: "REPORT_VIEW",
        targetTab: "reports",
        orderIndex: 9
      },
      {
        id: "business-ledger",
        title: "Financial Ledger",
        subtitle: "Cash Flow & Double-Entry Ledger",
        category: "Analytics",
        iconName: "DollarSign",
        permissionScope: "ACCOUNTING_VIEW",
        targetTab: "business-ledger",
        orderIndex: 9.1
      },
      {
        id: "stock-ledger",
        title: "Stock Ledger Audit",
        subtitle: "Real-Time Inventory Movement Logs",
        category: "Analytics",
        iconName: "Layers",
        permissionScope: "ITEM_VIEW",
        targetTab: "stock-ledger",
        orderIndex: 9.2
      },
      {
        id: "bi-reporting",
        title: "BI Reporting Studio",
        subtitle: "Custom BI Dashboards & Report Designer",
        category: "Analytics",
        iconName: "BarChart3",
        permissionScope: "REPORT_VIEW",
        targetTab: "bi-reporting",
        orderIndex: 9.3
      },
      {
        id: "dashboard-analytics",
        title: "Executive Dashboard",
        subtitle: "KPI Metrics & Sales Performance",
        category: "Analytics",
        iconName: "TrendingUp",
        permissionScope: "DASHBOARD_VIEW",
        targetTab: "dashboard",
        orderIndex: 10
      },
      {
        id: "ai-assistant-tile",
        title: "AI Assistant",
        subtitle: "Conversational Copilot & Insights",
        category: "Analytics",
        iconName: "Brain",
        permissionScope: "AI_CHAT",
        badge: "Optional AI",
        targetTab: "ai-assistant",
        isAiFeature: true,
        orderIndex: 13
      },

      // ════════════════════════════════════════════════════════════════════════
      // ADMINISTRATION CATEGORY
      // ════════════════════════════════════════════════════════════════════════
      {
        id: "organization-studio",
        title: "Organization Studio",
        subtitle: "Companies, Branches, Warehouses & Licensing",
        category: "Administration",
        iconName: "Building2",
        permissionScope: "SECURITY_ADMIN",
        targetTab: "organization-studio",
        orderIndex: 10.5
      },
      {
        id: "staff-management",
        title: "User & Role RBAC",
        subtitle: "Staff Permissions & Access Control",
        category: "Administration",
        iconName: "ShieldCheck",
        permissionScope: "SECURITY_ADMIN",
        targetTab: "staff",
        orderIndex: 11
      },
      {
        id: "statutory-compliance",
        title: "Statutory & GST Compliance",
        subtitle: "E-Way Bills, GSTR Returns & Tax Configuration",
        category: "Administration",
        iconName: "FileCheck",
        permissionScope: "SYSTEM_ADMIN",
        targetTab: "statutory-compliance",
        orderIndex: 11.1
      },
      {
        id: "audit-logs",
        title: "Audit & Security Logs",
        subtitle: "System Operations & Security Audit Trails",
        category: "Administration",
        iconName: "Lock",
        permissionScope: "SECURITY_ADMIN",
        targetTab: "audit-logs",
        orderIndex: 11.2
      },
      {
        id: "screen-studio",
        title: "Screen & UI Studio",
        subtitle: "No-Code Form & Screen Layout Studio",
        category: "Administration",
        iconName: "Monitor",
        permissionScope: "SYSTEM_ADMIN",
        targetTab: "screen-studio",
        orderIndex: 11.3
      },
      {
        id: "ai-configuration",
        title: "AI Configuration",
        subtitle: "AI Engine, Providers & Rule AI-001",
        category: "Administration",
        iconName: "Bot",
        permissionScope: "AI_CONFIGURATION",
        targetTab: "ai-config",
        orderIndex: 12
      },
      {
        id: "master-settings",
        title: "System Config",
        subtitle: "Company Setup & Application Flags",
        category: "Administration",
        iconName: "Settings",
        permissionScope: "SYSTEM_ADMIN",
        targetTab: "master-management",
        orderIndex: 14
      }
    ];

    defaultTiles.forEach((tile) => this.manifests.set(tile.id, tile));
  }

  public register(manifest: LaunchpadTileManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  public getAll(): LaunchpadTileManifest[] {
    return Array.from(this.manifests.values()).sort(
      (a, b) => (a.orderIndex || 99) - (b.orderIndex || 99)
    );
  }

  public get(id: string): LaunchpadTileManifest | undefined {
    return this.manifests.get(id);
  }
}

export const ModuleRegistry = new ModuleRegistryImpl();
