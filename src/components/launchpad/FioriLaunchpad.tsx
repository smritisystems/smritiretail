/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from 'react';

interface FioriLaunchpadProps {
  onSelectModule: (moduleId: string) => void;
}

interface TileData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  metric?: string;
  metricLabel?: string;
  badgeType?: 'info' | 'warning' | 'success' | 'primary';
  group: string;
}

const LAUNCHPAD_TILES: TileData[] = [
  // Core Operations
  {
    id: 'sales',
    title: 'Sales Billing',
    subtitle: 'Invoice creation, quick barcode entry & checkout',
    icon: 'point_of_sale',
    metric: '₹ 1,42,850',
    metricLabel: "Today's Billing",
    badgeType: 'success',
    group: 'Retail Operations',
  },
  {
    id: 'pos',
    title: 'POS Terminal',
    subtitle: 'Touchscreen cashier mode & drawer reconciliation',
    icon: 'receipt_long',
    metric: '184',
    metricLabel: 'Bills Issued',
    badgeType: 'primary',
    group: 'Retail Operations',
  },
  {
    id: 'purchase',
    title: 'Purchase Orders',
    subtitle: 'Vendor PO creation, approval workflow & grid paste',
    icon: 'shopping_cart',
    metric: '3 Pending',
    metricLabel: 'Approval Queue',
    badgeType: 'warning',
    group: 'Retail Operations',
  },
  {
    id: 'grn',
    title: 'Goods Receipt (GRN)',
    subtitle: 'Inward inventory receiving, batch & expiry check',
    icon: 'local_shipping',
    metric: '12 Receipts',
    metricLabel: 'This Week',
    badgeType: 'info',
    group: 'Retail Operations',
  },

  // Master Data & Inventory
  {
    id: 'item_master',
    title: 'Item Master',
    subtitle: 'Dynamic product catalog, HSN/GST rates & attributes',
    icon: 'inventory_2',
    metric: '4,892',
    metricLabel: 'Active SKUs',
    badgeType: 'primary',
    group: 'Master Data & Stock',
  },
  {
    id: 'inventory',
    title: 'Stock Ledger',
    subtitle: 'Real-time stock movement, variance & batch tracking',
    icon: 'warehouse',
    metric: '14 Alerts',
    metricLabel: 'Low Stock Items',
    badgeType: 'warning',
    group: 'Master Data & Stock',
  },
  {
    id: 'suppliers',
    title: 'Supplier Directory',
    subtitle: 'Vendor profiles, GSTIN lookup & payment ledgers',
    icon: 'storefront',
    metric: '86 Vendors',
    metricLabel: 'Active Suppliers',
    badgeType: 'info',
    group: 'Master Data & Stock',
  },
  {
    id: 'crm',
    title: 'Customer 360 & Loyalty',
    subtitle: 'Customer ledger, loyalty points & purchase history',
    icon: 'badge',
    metric: '1,240',
    metricLabel: 'Members Enrolled',
    badgeType: 'success',
    group: 'Master Data & Stock',
  },

  // Intelligence & System
  {
    id: 'reports',
    title: 'Reports & Analytics',
    subtitle: 'GST returns, daily sales summary & margin reports',
    icon: 'analytics',
    metric: 'FastAPI v1',
    metricLabel: 'System of Record',
    badgeType: 'primary',
    group: 'System & Analytics',
  },
  {
    id: 'dev_tracker',
    title: 'Dev Intelligence',
    subtitle: 'Task tracker, API logs & system diagnostics',
    icon: 'bug_report',
    metric: 'v3.17.0',
    metricLabel: 'System Build',
    badgeType: 'info',
    group: 'System & Analytics',
  },
  {
    id: 'system',
    title: 'System Governance',
    subtitle: 'User roles, menu permissions & audit trail logs',
    icon: 'admin_panel_settings',
    metric: 'Protected',
    metricLabel: 'RBAC Enforcement',
    badgeType: 'success',
    group: 'System & Analytics',
  },
];

export const FioriLaunchpad: React.FC<FioriLaunchpadProps> = ({ onSelectModule }) => {
  const groups = Array.from(new Set(LAUNCHPAD_TILES.map((t) => t.group)));

  return (
    <div className="flex-1 bg-[#f8f9ff] overflow-y-auto p-4 md:p-6 space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#24389c] to-[#3f51b5] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            SMRITI Retail OS Launchpad
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 mt-1 max-w-xl">
            Unified application launcher and operational workspace for SMRITI Retail OS.
          </p>
        </div>

        {/* Quick KPI Summary Box */}
        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/20 self-start md:self-auto">
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-xs text-indigo-200 uppercase font-semibold text-[10px]">Today Sales</div>
            <div className="text-base font-bold text-white">₹ 1.42L</div>
          </div>
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-xs text-indigo-200 uppercase font-semibold text-[10px]">Open Shift</div>
            <div className="text-base font-bold text-[#abf4ac]">#412</div>
          </div>
          <div className="text-center px-3">
            <div className="text-xs text-indigo-200 uppercase font-semibold text-[10px]">System</div>
            <div className="text-base font-bold text-white">v3.17.0</div>
          </div>
        </div>
      </div>

      {/* Grouped Tiles */}
      {groups.map((groupName) => {
        const tiles = LAUNCHPAD_TILES.filter((t) => t.group === groupName);

        return (
          <section key={groupName} className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#c5c5d4] pb-1.5">
              <h2 className="text-sm font-bold text-[#3d425f] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3f51b5]" />
                {groupName}
              </h2>
              <span className="text-xs text-[#757684] font-medium">{tiles.length} Workspaces</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onSelectModule(tile.id)}
                  className="group bg-white hover:bg-[#eff4ff] border border-[#c5c5d4] hover:border-[#3f51b5] rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  {/* Decorative Subtle Accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#3f51b5] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Icon & Title Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[#f8f9ff] group-hover:bg-[#3f51b5] text-[#24389c] group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                        <span className="material-symbols-outlined text-[22px]">{tile.icon}</span>
                      </div>

                      {tile.metric && (
                        <div className="text-right">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              tile.badgeType === 'success'
                                ? 'bg-[#abf4ac]/40 text-[#286b33] border border-[#286b33]/20'
                                : tile.badgeType === 'warning'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-[#e5eeff] text-[#24389c] border border-[#3f51b5]/20'
                            }`}
                          >
                            {tile.metric}
                          </span>
                          {tile.metricLabel && (
                            <div className="text-[9px] text-[#757684] mt-0.5 font-medium">
                              {tile.metricLabel}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-[#0b1c30] group-hover:text-[#24389c] transition-colors mt-1">
                      {tile.title}
                    </h3>
                    <p className="text-xs text-[#454652] mt-1 leading-snug line-clamp-2">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Tile Footer Link Indicator */}
                  <div className="mt-4 pt-2 border-t border-[#c5c5d4]/40 flex items-center justify-between text-xs text-[#3f51b5] font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Open Workspace</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
