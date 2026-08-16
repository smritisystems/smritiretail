/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type BusinessContext =
  | 'launchpad'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'masters'
  | 'reports'
  | 'system';

export type TransactionState = 'DRAFT' | 'SUBMITTED' | 'FINALIZED' | 'DISPATCHED';

export interface ContextualMenuItem {
  id: string;
  title: string;
  icon: string;
  badgeCount?: number;
  isNextBestAction?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  group?: string;
}

export interface NavigationQuery {
  context: BusinessContext;
  workspace?: string;
  documentId?: string;
  transactionState?: TransactionState;
  userRole?: string;
}

export interface ResolvedNavigation {
  context: BusinessContext;
  contextLabel: string;
  contextIcon: string;
  items: ContextualMenuItem[];
  nextBestAction?: ContextualMenuItem;
}

const LAUNCHPAD_ITEM: ContextualMenuItem = {
  id: 'dashboard',
  title: 'SMRITI Launchpad',
  icon: 'grid_view',
};

export function resolveNavigation(query: NavigationQuery): ResolvedNavigation {
  const role = query.userRole || 'System Admin';
  const state = query.transactionState || 'DRAFT';
  const isDocumentActive = Boolean(query.documentId);

  // Document-level contextual navigation when viewing a specific transaction (e.g. PO-00125, INV-00125)
  if (isDocumentActive && query.documentId) {
    const docPrefix = query.documentId.split('-')[0] || 'DOC';
    return {
      context: query.context,
      contextLabel: `${docPrefix} ${query.documentId}`,
      contextIcon: 'article',
      items: [
        LAUNCHPAD_ITEM,
        { id: 'doc-overview', title: 'Document Overview', icon: 'visibility', isNextBestAction: true },
        { id: 'doc-items', title: 'Itemized Grid', icon: 'grid_on' },
        { id: 'doc-stock', title: 'Stock & Ledger Impact', icon: 'warehouse' },
        {
          id: 'doc-verify',
          title: 'Verification & Audit',
          icon: 'fact_check',
          disabled: state === 'FINALIZED',
          disabledReason: state === 'FINALIZED' ? 'Transaction already posted to ledger.' : undefined,
        },
        {
          id: 'doc-dispatch',
          title: 'Prepare Dispatch',
          icon: 'local_shipping',
          disabled: state === 'DRAFT',
          disabledReason: state === 'DRAFT' ? 'Dispatch unavailable. Missing verified invoice & E-Way Bill.' : undefined,
        },
        { id: 'doc-print', title: 'Print / Export PDF', icon: 'print' },
        { id: 'doc-activity', title: 'Activity & Log', icon: 'history' },
      ],
      nextBestAction: {
        id: 'doc-overview',
        title: 'View Stock Impact',
        icon: 'warehouse',
      },
    };
  }

  switch (query.context) {
    case 'sales':
      return {
        context: 'sales',
        contextLabel: 'Sales & Billing',
        contextIcon: 'point_of_sale',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'sales', title: 'Sales Billing', icon: 'point_of_sale', isNextBestAction: true },
          { id: 'pos', title: 'POS Touch Terminal', icon: 'receipt_long', badgeCount: 2 },
          { id: 'crm', title: 'Customer 360', icon: 'badge' },
          { id: 'create-tax-invoice', title: 'Tax Invoice Builder', icon: 'description' },
          { id: 'tax-invoice-print', title: 'Statutory A4 Print', icon: 'print' },
          { id: 'reports', title: 'Sales Analytics', icon: 'analytics' },
        ],
        nextBestAction: {
          id: 'sales',
          title: 'Open Sales Billing',
          icon: 'point_of_sale',
        },
      };

    case 'purchase':
      return {
        context: 'purchase',
        contextLabel: 'Purchase & Procurement',
        contextIcon: 'shopping_cart',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'purchase', title: 'Purchase Orders', icon: 'shopping_cart', isNextBestAction: true },
          { id: 'grn', title: 'Goods Receipt (GRN)', icon: 'local_shipping' },
          { id: 'supplier-mgmt', title: 'Supplier Directory', icon: 'storefront' },
          { id: 'approval-matrix', title: 'PO Approval Matrix', icon: 'rule' },
          { id: 'inventory', title: 'Stock Ledger Impact', icon: 'warehouse' },
          { id: 'reports', title: 'Procurement BI', icon: 'analytics' },
        ],
        nextBestAction: {
          id: 'purchase',
          title: 'Create Purchase Order',
          icon: 'add_shopping_cart',
        },
      };

    case 'inventory':
      return {
        context: 'inventory',
        contextLabel: 'Stock & Inventory',
        contextIcon: 'warehouse',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'stock-ledger', title: 'Stock Ledger', icon: 'warehouse', isNextBestAction: true },
          { id: 'item-master', title: 'Item Master Catalog', icon: 'inventory_2' },
          { id: 'barcode', title: 'PRN Label Designer', icon: 'barcode_reader' },
          { id: 'terms-engine', title: 'Stock Policy Engine', icon: 'gavel' },
          { id: 'reports', title: 'Valuation & Aging', icon: 'analytics' },
        ],
        nextBestAction: {
          id: 'stock-ledger',
          title: 'View Stock Movement',
          icon: 'insights',
        },
      };

    case 'masters':
      return {
        context: 'masters',
        contextLabel: 'Master Data & Catalog',
        contextIcon: 'inventory_2',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'item-master', title: 'Item Master (Browse)', icon: 'inventory_2' },
          { id: 'item-create-grid', title: 'Create Items (Excel Grid)', icon: 'grid_on', isNextBestAction: true },
          { id: 'customer-master', title: 'Customer Master', icon: 'person_search' },
          { id: 'supplier-mgmt', title: 'Supplier Master', icon: 'storefront' },
          { id: 'masters', title: 'Master Registry', icon: 'tune' },
          { id: 'document-series', title: 'Document Series Prefix', icon: 'tag' },
        ],
        nextBestAction: {
          id: 'item-create-grid',
          title: 'Open Excel Bulk Grid',
          icon: 'grid_on',
        },
      };

    case 'reports':
      return {
        context: 'reports',
        contextLabel: 'BI Reports & Analytics',
        contextIcon: 'analytics',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'report-designer', title: 'Report Designer Studio', icon: 'analytics', isNextBestAction: true },
          { id: 'business-ledger', title: 'Business Ledger', icon: 'menu_book' },
          { id: 'audit-logs', title: 'Audit Trail Logs', icon: 'history' },
          { id: 'accounting-sync', title: 'Accounting Sync Engine', icon: 'sync' },
          { id: 'data-exchange', title: 'Data Exchange & Export', icon: 'file_download' },
        ],
        nextBestAction: {
          id: 'report-designer',
          title: 'Launch BI Studio',
          icon: 'analytics',
        },
      };

    case 'system':
      return {
        context: 'system',
        contextLabel: 'System Governance',
        contextIcon: 'admin_panel_settings',
        items: [
          LAUNCHPAD_ITEM,
          { id: 'masters', title: 'System Master Registry', icon: 'tune' },
          { id: 'staff-management', title: 'Staff & Role Governance', icon: 'group' },
          { id: 'dev-tracker', title: 'Dev Intelligence Center', icon: 'bug_report' },
          { id: 'wiki', title: 'System Documentation Wiki', icon: 'import_contacts' },
          { id: 'about-smriti', title: 'About SMRITI OS', icon: 'info' },
        ],
        nextBestAction: {
          id: 'dev-tracker',
          title: 'Check Diagnostics',
          icon: 'speed',
        },
      };

    case 'launchpad':
    default:
      return {
        context: 'launchpad',
        contextLabel: 'Fiori Launchpad',
        contextIcon: 'grid_view',
        items: [
          LAUNCHPAD_ITEM,
        ],
        nextBestAction: {
          id: 'dashboard',
          title: 'Fiori Launchpad',
          icon: 'grid_view',
        },
      };
  }
}
