/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.13
 * Created      : 2026-08-16
 * Modified     : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Navigation Resolver (Persistent Global & Contextual Submenu Engine)
 */

export type BusinessContext =
  | 'launchpad'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'masters'
  | 'reports'
  | 'system';

export type TransactionState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'FINALIZED'
  | 'DISPATCHED'
  | 'POSTED'
  | 'PAID'
  | 'CANCELLED';

export interface ContextualMenuItem {
  id: string;
  title: string;
  icon: string;
  badgeCount?: number;
  isNextBestAction?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  group?: string;
  submenus?: ContextualMenuItem[];
  isContextualAction?: boolean;
  resource?: string;
  action?: string;
}

export interface NavigationQuery {
  context: BusinessContext;
  workspace?: string;
  documentId?: string;
  documentType?: string;
  transactionState?: TransactionState;
  userRole?: string;
  activeActionId?: string;
}

export interface BreadcrumbAncestor {
  id: string;
  label: string;
  icon?: string;
}

export interface ActiveDocumentSelection {
  documentId: string;
  documentType: string;
  transactionState: TransactionState;
  activeActionId?: string;
}

export interface GlobalNavigationCategory {
  context: BusinessContext;
  label: string;
  icon: string;
  workspaces: ContextualMenuItem[];
}

export interface ResolvedNavigation {
  context: BusinessContext;
  contextLabel: string;
  contextIcon: string;
  items: ContextualMenuItem[];
  globalCategories: GlobalNavigationCategory[];
  contextualSubmenu?: ContextualMenuItem[];
  activeDocument?: ActiveDocumentSelection;
  nextBestAction?: ContextualMenuItem;
  breadcrumbAncestors?: BreadcrumbAncestor[];
}

export const LAUNCHPAD_ITEM: ContextualMenuItem = {
  id: 'launchpad',
  title: 'SMRITI Launchpad',
  icon: 'grid_view',
};

export function getAncestorsForContext(context: BusinessContext, isDocumentActive: boolean): BreadcrumbAncestor[] {
  if (context === 'launchpad') return [];
  const home: BreadcrumbAncestor = { id: 'launchpad', label: 'Home', icon: 'home' };
  if (!isDocumentActive) {
    return [home];
  }
  const contextLabels: Record<BusinessContext, string> = {
    sales: 'Sales & Billing',
    purchase: 'Purchase & Procurement',
    inventory: 'Stock & Inventory',
    masters: 'Master Data',
    reports: 'BI Reports',
    system: 'System Governance',
    launchpad: 'Home',
  };
  return [home, { id: context, label: contextLabels[context] || context }];
}

export function buildDocumentContextualSubmenu(
  documentId: string,
  state: TransactionState = 'DRAFT',
  userRole?: string,
  documentType?: string,
): ContextualMenuItem[] {
  const isFinalizedOrPosted = state === 'FINALIZED' || state === 'POSTED';
  const isCancelled = state === 'CANCELLED';
  const isDraft = state === 'DRAFT';
  const isDispatched = state === 'DISPATCHED';

  const isCashier = (userRole || '').toUpperCase() === 'CASHIER';

  const allActions: ContextualMenuItem[] = [
    {
      id: 'doc-overview',
      title: 'Document Overview',
      icon: 'visibility',
      isNextBestAction: true,
      isContextualAction: true,
      resource: 'sales_billing',
      action: 'VIEW',
    },
    {
      id: 'doc-items',
      title: 'Items & Totals',
      icon: 'grid_on',
      isContextualAction: true,
      resource: 'sales_billing',
      action: 'VIEW',
    },
    {
      id: 'doc-stock',
      title: 'Stock & Ledger Impact',
      icon: 'warehouse',
      isContextualAction: true,
      resource: 'stock_ledger',
      action: 'VIEW',
    },
    {
      id: 'doc-verify',
      title: 'Verification & Audit',
      icon: 'fact_check',
      isContextualAction: true,
      resource: 'sales_billing',
      action: 'VERIFY',
      disabled: isFinalizedOrPosted || isCancelled,
      disabledReason: isFinalizedOrPosted
        ? 'Transaction already posted to ledger.'
        : isCancelled
        ? 'Transaction is cancelled.'
        : undefined,
    },
    {
      id: 'doc-dispatch',
      title: 'Prepare Dispatch',
      icon: 'local_shipping',
      isContextualAction: true,
      resource: 'b2b_dispatch',
      action: 'DISPATCH',
      disabled: isDraft || isDispatched || isCancelled,
      disabledReason: isDraft
        ? 'Dispatch unavailable. Missing verified invoice & E-Way Bill.'
        : isDispatched
        ? 'Consignment already dispatched.'
        : isCancelled
        ? 'Transaction is cancelled.'
        : undefined,
    },
    {
      id: 'doc-print',
      title: 'Print / Export PDF',
      icon: 'print',
      isContextualAction: true,
      resource: 'print_studio',
      action: 'PRINT',
    },
    {
      id: 'doc-activity',
      title: 'Activity & Log',
      icon: 'history',
      isContextualAction: true,
      resource: 'audit_logs',
      action: 'VIEW',
    },
  ];

  // RBAC Filtering: If Cashier, exclude unauthorized actions (dispatch)
  if (isCashier) {
    return allActions.filter((a) => a.id !== 'doc-dispatch');
  }

  return allActions;
}

export function isActionPermittedForRole(
  role: string,
  resource: string,
  action: string
): boolean {
  const normRole = (role || '').toUpperCase();
  if (normRole === 'SYSADMIN' || normRole === 'ADMINISTRATOR' || normRole === 'ADMIN') {
    return true;
  }
  if (normRole === 'CASHIER') {
    if (action === 'DISPATCH' || resource === 'b2b_dispatch' || resource === 'system') {
      return false;
    }
    return true;
  }
  return true;
}

export function getGlobalNavigationCategories(): GlobalNavigationCategory[] {
  return [
    {
      context: 'sales',
      label: 'Sales & Billing',
      icon: 'point_of_sale',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'billing-workspace', title: 'Billing Workspace', icon: 'point_of_sale', isNextBestAction: true },
        { id: 'sales-promotions', title: 'Promotions Studio', icon: 'percent' },
        { id: 'crm', title: 'Customer 360', icon: 'badge' },
        { id: 'tax-invoice-print', title: 'Statutory A4 Print', icon: 'print' },
        { id: 'b2b-dispatch-studio', title: 'B2B Dispatch Studio', icon: 'local_shipping' },
        { id: 'reports', title: 'Sales Analytics', icon: 'analytics' },
      ],
    },
    {
      context: 'purchase',
      label: 'Purchase & Procurement',
      icon: 'shopping_cart',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'purchase', title: 'Purchase Orders', icon: 'shopping_cart', isNextBestAction: true },
        { id: 'grn', title: 'Goods Receipt (GRN)', icon: 'local_shipping' },
        { id: 'supplier-mgmt', title: 'Vendor 360 Workspace', icon: 'local_shipping' },
        { id: 'approval-matrix', title: 'PO Approval Matrix', icon: 'rule' },
        { id: 'stock-ledger', title: 'Stock Ledger Impact', icon: 'warehouse' },
        { id: 'reports', title: 'Procurement BI', icon: 'analytics' },
      ],
    },
    {
      context: 'inventory',
      label: 'Stock & Inventory',
      icon: 'warehouse',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'stock-ledger', title: 'Stock Ledger', icon: 'warehouse', isNextBestAction: true },
        { id: 'item-master', title: 'Item Master Catalog', icon: 'inventory_2' },
        { id: 'price-revision', title: 'Price Revision Studio', icon: 'trending_up' },
        { id: 'barcode', title: 'PRN Label Designer', icon: 'barcode_reader' },
        { id: 'terms-engine', title: 'Stock Policy Engine', icon: 'gavel' },
        { id: 'reports', title: 'Valuation & Aging', icon: 'analytics' },
      ],
    },
    {
      context: 'masters',
      label: 'Master Data & Catalog',
      icon: 'inventory_2',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'item-master', title: 'Item Master (Browse)', icon: 'inventory_2' },
        { id: 'price-revision', title: 'Price Revision Studio', icon: 'trending_up' },
        { id: 'item-create-grid', title: 'Create Items (Excel Grid)', icon: 'grid_on' },
        { id: 'databridge', title: 'SMRITI DataBridge', icon: 'dataset', isNextBestAction: true },
        { id: 'sales-promotions', title: 'Promotions Studio', icon: 'percent' },
        { id: 'customer-master', title: 'Customer Master', icon: 'person_search' },
        { id: 'supplier-mgmt', title: 'Vendor 360 Workspace', icon: 'local_shipping' },
        { id: 'masters', title: 'Master Registry', icon: 'tune' },
        { id: 'document-series', title: 'Document Series Prefix', icon: 'tag' },
      ],
    },
    {
      context: 'reports',
      label: 'BI Reports & Analytics',
      icon: 'analytics',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'report-designer', title: 'Report Designer Studio', icon: 'analytics', isNextBestAction: true },
        { id: 'business-ledger', title: 'Business Ledger', icon: 'menu_book' },
        { id: 'audit-logs', title: 'Audit Trail Logs', icon: 'history' },
        { id: 'accounting-sync', title: 'Accounting Sync Engine', icon: 'sync' },
        { id: 'data-exchange', title: 'Data Exchange & Export', icon: 'file_download' },
      ],
    },
    {
      context: 'system',
      label: 'System Governance',
      icon: 'admin_panel_settings',
      workspaces: [
        LAUNCHPAD_ITEM,
        { id: 'system-parameters', title: 'System Parameters Studio', icon: 'tune' },
        { id: 'database-manager', title: 'Database Manager (DB Studio)', icon: 'storage' },
        { id: 'masters', title: 'System Master Registry', icon: 'tune' },
        { id: 'staff-management', title: 'Staff & Role Governance', icon: 'group' },
        { id: 'store-directory', title: 'Store & Branch Directory', icon: 'storefront' },
        { id: 'muster-roll', title: 'Muster Roll & Wages', icon: 'view_timeline' },
        { id: 'dev-tracker', title: 'Dev Intelligence Center', icon: 'bug_report' },
        { id: 'wiki', title: 'System Documentation Wiki', icon: 'import_contacts' },
        { id: 'about-smriti', title: 'About SMRITI OS', icon: 'info' },
      ],
    },
    {
      context: 'launchpad',
      label: 'Fiori Launchpad',
      icon: 'grid_view',
      workspaces: [LAUNCHPAD_ITEM],
    },
  ];
}

export function resolveNavigation(query: NavigationQuery): ResolvedNavigation {
  const state: TransactionState = query.transactionState || 'DRAFT';
  const isDocumentActive = Boolean(query.documentId);
  const normRole = (query.userRole || '').toUpperCase();

  let globalCategories = getGlobalNavigationCategories();
  if (normRole === 'CASHIER') {
    globalCategories = globalCategories.filter((c) => c.context !== 'system');
  }

  // Find the base category for the query context
  const activeCategory =
    globalCategories.find((c) => c.context === query.context) ||
    globalCategories[0];

  // Clone the workspaces for active category
  let items: ContextualMenuItem[] = activeCategory.workspaces.map((w) => ({ ...w }));

  if (normRole === 'CASHIER') {
    items = items.filter(
      (item) => item.id !== 'system' && item.id !== 'database-manager' && item.id !== 'b2b-dispatch-studio'
    );
  }

  let contextualSubmenu: ContextualMenuItem[] | undefined = undefined;
  let activeDocument: ActiveDocumentSelection | undefined = undefined;

  // If a document/transaction is active, compute contextual actions and NEST them beneath active workspace
  if (isDocumentActive && query.documentId) {
    const docPrefix = query.documentId.split('-')[0] || 'DOC';
    contextualSubmenu = buildDocumentContextualSubmenu(
      query.documentId,
      state,
      query.userRole,
      query.documentType,
    );

    activeDocument = {
      documentId: query.documentId,
      documentType: query.documentType || (query.context === 'purchase' ? 'PurchaseOrder' : 'SalesInvoice'),
      transactionState: state,
      activeActionId: query.activeActionId || 'doc-overview',
    };

    // Determine target parent workspace
    const targetWorkspaceId = query.workspace || (query.context === 'purchase' ? 'purchase' : 'billing-workspace');

    // Attach nested submenus to the target parent workspace
    items = items.map((item) => {
      if (item.id === targetWorkspaceId) {
        return {
          ...item,
          submenus: contextualSubmenu,
        };
      }
      return item;
    });

    const nextAction = contextualSubmenu.find((a) => !a.disabled && a.isNextBestAction) || contextualSubmenu[0];

    return {
      context: query.context,
      contextLabel: `${docPrefix} ${query.documentId}`,
      contextIcon: 'article',
      items,
      globalCategories,
      contextualSubmenu,
      activeDocument,
      nextBestAction: nextAction,
      breadcrumbAncestors: getAncestorsForContext(query.context, true),
    };
  }

  // Non-document standard contextual navigation
  const nextBest = items.find((i) => i.isNextBestAction) || items[0];

  return {
    context: query.context,
    contextLabel: activeCategory.label,
    contextIcon: activeCategory.icon,
    items,
    globalCategories,
    contextualSubmenu: undefined,
    activeDocument: undefined,
    nextBestAction: nextBest,
    breadcrumbAncestors: getAncestorsForContext(query.context, false),
  };
}
