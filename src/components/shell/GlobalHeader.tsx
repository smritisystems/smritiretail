/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.10
 * Created      : 2026-08-16
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Global Shell Header (Classic Enterprise ERP Menu & Regular Search)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useActiveField } from '../../context/ActiveFieldContext.tsx';
import { useDrillDown } from '../drilldown/drilldown_store.tsx';
import { CompanySelector } from '../layout/CompanySelector.tsx';
import { Breadcrumb } from '../../navigation/breadcrumb/index.ts';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLayoutEngine } from '../../layout_engine/layout_store.tsx';
import { UxSwitcherModal } from './UxSwitcherModal.tsx';

interface MenuItemDef {
  id: string;
  label: string;
  icon?: string;
  moduleId?: string;
  children?: { id: string; label: string; moduleId: string; icon?: string }[];
}

const ENTERPRISE_MENU_ITEMS: MenuItemDef[] = [
  { id: "home", label: "Home", icon: "home", moduleId: "launchpad" },
  {
    id: "master",
    label: "Master",
    moduleId: "item-master",
    children: [
      { id: "item-master", label: "Item Master", moduleId: "item-master", icon: "category" },
      { id: "price-revision", label: "Price List & Revisions", moduleId: "price-revision", icon: "sell" },
      { id: "ufe", label: "UOM & Tax Formulas", moduleId: "ufe", icon: "percent" },
      { id: "customer-master", label: "Customers", moduleId: "customer-master", icon: "person" },
      { id: "vendor-360", label: "Suppliers", moduleId: "vendor-360", icon: "local_shipping" },
      { id: "store-directory", label: "Stores & Branches", moduleId: "store-directory", icon: "store" },
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    moduleId: "billing-workspace",
    children: [
      { id: "billing-workspace", label: "POS Billing Desk", moduleId: "billing-workspace", icon: "point_of_sale" },
      { id: "sales", label: "Sales Orders & Dispatch", moduleId: "sales", icon: "receipt_long" },
      { id: "purchase", label: "Purchase Orders", moduleId: "purchase", icon: "shopping_cart" },
      { id: "grn-studio", label: "Goods Receipt Note (GRN)", moduleId: "grn-studio", icon: "inbox" },
      { id: "day-close", label: "Day End / Shift Close", moduleId: "day-close", icon: "lock_clock" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    moduleId: "stock-ledger",
    children: [
      { id: "stock-ledger", label: "Stock Ledger", moduleId: "stock-ledger", icon: "inventory_2" },
      { id: "barcode", label: "Barcode Studio", moduleId: "barcode", icon: "barcode_scanner" },
      { id: "physical-stock", label: "Physical Stock Audit", moduleId: "physical-stock", icon: "fact_check" },
      { id: "inventory", label: "Inventory Dashboard", moduleId: "inventory", icon: "warehouse" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    moduleId: "purchase",
    children: [
      { id: "purchase", label: "Purchase Studio", moduleId: "purchase", icon: "shopping_bag" },
      { id: "grn-studio", label: "Goods Receipt (GRN)", moduleId: "grn-studio", icon: "inbox" },
      { id: "procurement-visual-reports", label: "Purchase Reports", moduleId: "procurement-visual-reports", icon: "query_stats" },
      { id: "approval-matrix", label: "Approval Matrix", moduleId: "approval-matrix", icon: "verified" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    moduleId: "sales",
    children: [
      { id: "billing-workspace", label: "POS Terminal", moduleId: "billing-workspace", icon: "point_of_sale" },
      { id: "sales", label: "Sales Studio & Ledger", moduleId: "sales", icon: "receipt_long" },
      { id: "propos", label: "ProPOS Suite", moduleId: "propos", icon: "terminal" },
      { id: "sales-promotions", label: "Sales Promotions", moduleId: "sales-promotions", icon: "loyalty" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    moduleId: "business-ledger",
    children: [
      { id: "business-ledger", label: "Business Ledger", moduleId: "business-ledger", icon: "menu_book" },
      { id: "ewaybill-management", label: "GST & Compliance", moduleId: "ewaybill-management", icon: "verified_user" },
      { id: "accounting-sync", label: "Tally / ERP Sync", moduleId: "accounting-sync", icon: "sync_alt" },
      { id: "cost-truth", label: "Cost Truth Dashboard", moduleId: "cost-truth", icon: "insights" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    moduleId: "customer-master",
    children: [
      { id: "customer-master", label: "Customers 360", moduleId: "customer-master", icon: "contacts" },
      { id: "vendor-360", label: "Suppliers 360", moduleId: "vendor-360", icon: "badge" },
      { id: "corporate-360", label: "Corporate Accounts", moduleId: "corporate-360", icon: "domain" },
      { id: "crm", label: "CRM Studio", moduleId: "crm", icon: "hub" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    moduleId: "report-designer",
    children: [
      { id: "report-designer", label: "Report Designer", moduleId: "report-designer", icon: "analytics" },
      { id: "visual-reports", label: "BI Visual Dashboards", moduleId: "visual-reports", icon: "bar_chart" },
      { id: "procurement-visual-reports", label: "Procurement Reports", moduleId: "procurement-visual-reports", icon: "pie_chart" },
      { id: "audit-logs", label: "Audit Logs", moduleId: "audit-logs", icon: "history" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    moduleId: "system-parameters",
    children: [
      { id: "data-exchange", label: "Data Management", moduleId: "data-exchange", icon: "swap_horiz" },
      { id: "bulk-import-sheet", label: "Import / Export", moduleId: "bulk-import-sheet", icon: "upload_file" },
      { id: "system-parameters", label: "System Tools", moduleId: "system-parameters", icon: "build" },
      { id: "backup-restore", label: "Backup & Restore", moduleId: "backup-restore", icon: "settings_backup_restore" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    moduleId: "company-profile",
    children: [
      { id: "company-profile", label: "Company Profile", moduleId: "company-profile", icon: "business" },
      { id: "profiles", label: "Store & POS Profiles", moduleId: "profiles", icon: "settings_applications" },
      { id: "staff-management", label: "Staff Management", moduleId: "staff-management", icon: "badge" },
      { id: "security-management", label: "Security & Access", moduleId: "security-management", icon: "security" },
    ],
  },
  {
    id: "help",
    label: "Help",
    moduleId: "wiki",
    children: [
      { id: "wiki", label: "SMRITI Wiki", moduleId: "wiki", icon: "auto_stories" },
      { id: "training", label: "Training Academy", moduleId: "training", icon: "school" },
      { id: "about-smriti", label: "About SMRITI OS", moduleId: "about-smriti", icon: "info" },
    ],
  },
];

interface GlobalHeaderProps {
  activeModuleTitle: string;
  activeModuleId: string;
  onNavigateHome: () => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  onToggleNavRail: () => void;
  isNavRailCollapsed: boolean;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onSelectModule?: (moduleId: string) => void;
  onLogout?: () => void;
  userRole?: string;
  userName?: string;
  storeName?: string;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  activeModuleTitle,
  activeModuleId,
  onNavigateHome,
  onNavigateBack,
  canNavigateBack = false,
  onToggleNavRail,
  isNavRailCollapsed,
  isFocusMode,
  onToggleFocusMode,
  onSelectModule,
  onLogout,
  userRole = 'System Admin',
  userName = 'Jawahar Mallah',
  storeName = 'Main Store (Branch 01)',
}) => {
  const { category: activeCategory, fieldLabel } = useActiveField();
  const { setSearchOpen } = useDrillDown();
  const { theme, toggleTheme, activePreset, setPreset, presets } = useTheme();
  const { uxMode, setUxMode, toggleUxMode } = useLayoutEngine();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUxSubmenuOpen, setIsUxSubmenuOpen] = useState(false);
  const [isUxModalOpen, setIsUxModalOpen] = useState(false);
  const [unreadNotifications] = useState(3);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isMenuCategoryActive = (item: MenuItemDef) => {
    if (item.moduleId === activeModuleId) return true;
    if (item.id === 'home' && (activeModuleId === 'launchpad' || activeModuleId === 'workspaces')) return true;
    return Boolean(item.children?.some((c) => c.moduleId === activeModuleId));
  };

  const notifications = [
    { id: '1', title: 'Low Stock Alert', desc: 'Basmati Rice 5kg below min threshold (2 units left)', time: '10m ago', type: 'warning' },
    { id: '2', title: 'Pending Approval', desc: 'PO-2026-0891 awaits manager sign-off', time: '45m ago', type: 'info' },
    { id: '3', title: 'Shift Reconciled', desc: 'Shift #412 closed cleanly by Operator 04', time: '2h ago', type: 'success' },
  ];

  return (
    <header className="bg-[#24389c] text-white h-13 px-3 flex items-center justify-between border-b border-[#3f51b5] select-none shadow-sm z-30 relative">
      {/* Brand Title */}
      <button
        type="button"
        onClick={onNavigateHome}
        className="flex items-center gap-2 px-2 py-1 hover:bg-[#3f51b5] rounded-md transition-colors text-left shrink-0"
      >
        <div className="w-7 h-7 bg-white text-[#24389c] font-black text-xs flex items-center justify-center rounded-md tracking-tighter shadow-xs">
          S
        </div>
        <div className="hidden sm:block leading-none">
          <span className="font-bold text-sm tracking-wide block">SMRITI</span>
          <span className="text-[9px] text-indigo-200 tracking-wider font-mono">RETAIL OS</span>
        </div>
      </button>

      {/* Classic Mode Enterprise Top Menu Bar */}
      {uxMode === 'classic' ? (
        <nav
          ref={menuRef}
          aria-label="Enterprise Main Menu"
          className="flex-1 flex items-center gap-0.5 ml-2 mr-2 overflow-x-auto no-scrollbar py-0.5"
        >
          {ENTERPRISE_MENU_ITEMS.map((item) => {
            const isActive = isMenuCategoryActive(item);
            const isOpen = activeDropdown === item.id;
            const hasChildren = Boolean(item.children && item.children.length > 0);

            return (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (hasChildren) {
                      setActiveDropdown(isOpen ? null : item.id);
                    } else if (item.moduleId) {
                      setActiveDropdown(null);
                      if (item.moduleId === 'launchpad') {
                        onNavigateHome();
                      } else if (onSelectModule) {
                        onSelectModule(item.moduleId);
                      }
                    }
                  }}
                  onMouseEnter={() => {
                    if (activeDropdown && hasChildren) {
                      setActiveDropdown(item.id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    isActive || isOpen
                      ? 'bg-[#1a2b7b] text-white font-bold shadow-2xs'
                      : 'text-indigo-100 hover:text-white hover:bg-[#3f51b5]/80'
                  }`}
                  aria-expanded={isOpen}
                  aria-haspopup={hasChildren ? 'true' : undefined}
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                </button>

                {/* Dropdown Menu */}
                {isOpen && hasChildren && (
                  <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-50 animate-in fade-in slide-in-from-top-1">
                    {item.children!.map((child) => {
                      const isChildActive = activeModuleId === child.moduleId;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setActiveDropdown(null);
                            if (onSelectModule) onSelectModule(child.moduleId);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                            isChildActive
                              ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
                          }`}
                        >
                          {child.icon && (
                            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">
                              {child.icon}
                            </span>
                          )}
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      ) : (
        /* Regular Mode Left Navigation & Center Search */
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleNavRail}
              title={isNavRailCollapsed ? 'Expand Navigation Rail' : 'Collapse Navigation Rail'}
              className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-white"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isNavRailCollapsed ? 'side_navigation' : 'menu_open'}
              </span>
            </button>

            {/* Separator */}
            <div className="h-4 w-px bg-indigo-400/40 mx-1" />

            {/* Internal Shell Stack Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onNavigateHome}
                title="Go to Fiori Launchpad Home"
                className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">home</span>
              </button>
              {onSelectModule && (
                <button
                  type="button"
                  onClick={() => onSelectModule('dashboard')}
                  title="Open Advanced Business Dashboard"
                  aria-label="Open Advanced Business Dashboard"
                  className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">account_circle</span>
                </button>
              )}
              {canNavigateBack && onNavigateBack && (
                <button
                  type="button"
                  onClick={onNavigateBack}
                  title="Go Back"
                  className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
              )}
            </div>

            {/* Context & Breadcrumb Display */}
            <div className="hidden md:flex items-center ml-2">
              <Breadcrumb onNavigate={onSelectModule} />
            </div>
          </div>

          {/* Center Omni-Search Bar with Active Field Context Badge */}
          <div className="flex-1 max-w-md mx-4 relative hidden sm:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full bg-[#3f51b5]/60 hover:bg-[#3f51b5] text-white text-xs rounded-md pl-8 pr-16 py-1.5 border border-indigo-400/30 hover:border-white transition-all flex items-center justify-between text-left group"
            >
              <span className="material-symbols-outlined absolute left-2.5 text-indigo-300 group-hover:text-white text-[18px]">
                search
              </span>
              <span className="truncate text-indigo-100 group-hover:text-white">
                {activeCategory === "product" ? `Search Products / Barcode (${fieldLabel})...` :
                 activeCategory === "customer" ? `Search Customers / Mobile (${fieldLabel})...` :
                 activeCategory === "supplier" ? `Search Suppliers (${fieldLabel})...` :
                 activeCategory === "invoice" ? `Search Invoices (${fieldLabel})...` :
                 "Omni-Search (Item, Barcode, PO, Invoice, Customer)..."}
              </span>
              <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/20 text-indigo-200">
                Ctrl+K
              </span>
            </button>
          </div>
        </>
      )}

      {/* Right Controls (Focus Mode, Notifications, User Menu) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {uxMode === 'regular' && <CompanySelector />}

        {/* UX Mode Indicator Pill (Toggle button in top bar - Panel 2) */}
        <button
          type="button"
          onClick={toggleUxMode}
          title={`Active UX Mode: ${uxMode === 'regular' ? 'Regular UX (Simple & Guided)' : 'Classic UX (Traditional ERP)'}. Click to switch modes.`}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
            uxMode === 'regular'
              ? 'bg-blue-500/25 text-white border-blue-300/40 hover:bg-blue-500/40 hover:border-white'
              : 'bg-indigo-950/70 text-indigo-100 border-indigo-400/50 hover:bg-indigo-900/80 hover:border-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {uxMode === 'regular' ? 'laptop_mac' : 'desktop_windows'}
          </span>
          <span className="text-[11px] font-medium tracking-wide">
            {uxMode === 'regular' ? 'Regular UX' : 'Classic UX'}
          </span>
        </button>

        {/* Global Theme Quick Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={`Active Preset: ${activePreset.label} (${theme.toUpperCase()}). Click to switch light/dark mode.`}
          className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white flex items-center gap-1.5 text-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            {theme === 'dark' ? 'dark_mode' : 'light_mode'}
          </span>
          <span className="hidden xl:inline text-[11px] font-mono">
            {activePreset.label}
          </span>
        </button>

        {/* Focus Mode Toggle */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          title={isFocusMode ? 'Exit Full Screen Focus Mode' : 'Enter Focus Mode (Full Screen Data Entry)'}
          className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
            isFocusMode ? 'bg-[#abf4ac] text-[#002107] font-semibold' : 'hover:bg-[#3f51b5] text-indigo-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isFocusMode ? 'fullscreen_exit' : 'fullscreen'}
          </span>
          <span className="hidden lg:inline text-[11px]">
            {isFocusMode ? 'Focus Active' : 'Focus Mode'}
          </span>
        </button>

        {/* Notifications Drawer */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsUserMenuOpen(false);
            }}
            title="System Notifications"
            className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white relative"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 bg-[#ba1a1a] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#24389c]">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 text-[#0b1c30] dark:text-slate-100 rounded-xl shadow-xl border border-[#c5c5d4] dark:border-slate-700 py-2 z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-[#c5c5d4] dark:border-slate-700 flex items-center justify-between bg-[#f8f9ff] dark:bg-slate-800">
                <span className="font-semibold text-xs text-[#24389c] dark:text-indigo-400">System Notifications</span>
                <span className="text-[10px] bg-[#3f51b5] text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadNotifications} New
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-2.5 hover:bg-[#eff4ff] dark:hover:bg-slate-800 border-b border-[#c5c5d4]/40 dark:border-slate-800 transition-colors">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#0b1c30] dark:text-slate-200">
                      <span>{n.title}</span>
                      <span className="text-[10px] font-normal text-[#757684] dark:text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-[#454652] dark:text-slate-400 mt-0.5 leading-snug">{n.desc}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-1.5 bg-[#f8f9ff] dark:bg-slate-800 text-center border-t border-[#c5c5d4] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-xs font-medium text-[#24389c] dark:text-indigo-400 hover:underline"
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Session Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen(!isUserMenuOpen);
              setIsNotificationsOpen(false);
            }}
            className="flex items-center gap-1.5 p-1 hover:bg-[#3f51b5] rounded-md transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-[#abf4ac] text-[#002107] font-bold text-xs flex items-center justify-center shadow-xs">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block leading-none pr-1">
              <span className="text-xs font-semibold block">{userName}</span>
              <span className="text-[9px] text-indigo-200">{userRole}</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-indigo-200">arrow_drop_down</span>
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 text-[#0b1c30] dark:text-slate-100 rounded-xl shadow-xl border border-[#c5c5d4] dark:border-slate-700 py-2 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f9ff] dark:bg-slate-800 border-b border-[#c5c5d4] dark:border-slate-700">
                <div className="font-semibold text-sm text-[#24389c] dark:text-indigo-400">{userName}</div>
                <div className="text-xs text-[#454652] dark:text-slate-400">{userRole}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-[#286b33]/10 text-[#286b33] dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-[#286b33]/20 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#286b33] dark:bg-emerald-400" /> Active Shift #412
                </div>
              </div>

              {/* UX Mode Switcher Section (Panel 1 from Reference) */}
              <div className="px-3 py-2 bg-[#f8f9ff]/70 dark:bg-slate-800/60 border-b border-[#c5c5d4]/50 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#757684] dark:text-slate-400 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">tune</span> UX Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsUxModalOpen(true);
                    }}
                    className="text-[10px] text-[#24389c] dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    Compare Modes
                  </button>
                </div>

                <div className="space-y-1">
                  {/* Regular UX Option */}
                  <button
                    type="button"
                    onClick={() => setUxMode('regular')}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-start justify-between transition-colors cursor-pointer border ${
                      uxMode === 'regular'
                        ? 'bg-white dark:bg-slate-800 text-[#24389c] dark:text-indigo-300 font-semibold border-indigo-200 dark:border-indigo-700 shadow-xs'
                        : 'text-[#0b1c30] dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        uxMode === 'regular'
                          ? 'border-[#24389c] bg-[#24389c] text-white'
                          : 'border-slate-400 dark:border-slate-500'
                      }`}>
                        {uxMode === 'regular' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">Regular UX</div>
                        <div className="text-[10px] text-[#757684] dark:text-slate-400 font-normal mt-0.5">
                          Simple, clean and guided
                        </div>
                      </div>
                    </div>
                    {uxMode === 'regular' && (
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </button>

                  {/* Classic UX Option */}
                  <button
                    type="button"
                    onClick={() => setUxMode('classic')}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-start justify-between transition-colors cursor-pointer border ${
                      uxMode === 'classic'
                        ? 'bg-white dark:bg-slate-800 text-[#24389c] dark:text-indigo-300 font-semibold border-indigo-200 dark:border-indigo-700 shadow-xs'
                        : 'text-[#0b1c30] dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        uxMode === 'classic'
                          ? 'border-[#24389c] bg-[#24389c] text-white'
                          : 'border-slate-400 dark:border-slate-500'
                      }`}>
                        {uxMode === 'classic' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">Classic UX</div>
                        <div className="text-[10px] text-[#757684] dark:text-slate-400 font-normal mt-0.5">
                          Traditional, detailed and powerful
                        </div>
                      </div>
                    </div>
                    {uxMode === 'classic' && (
                      <span className="text-[9px] bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Theme & Visual Presets Picker */}
              <div className="px-3 py-2 bg-[#f8f9ff]/50 dark:bg-slate-800/40 border-b border-[#c5c5d4]/50 dark:border-slate-800">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#757684] dark:text-slate-400 font-bold mb-1.5 flex items-center justify-between">
                  <span>Theme Preset</span>
                  <span className="font-semibold text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{activePreset.mode}</span>
                </div>
                <div className="space-y-0.5">
                  {presets.map((p) => {
                    const isAct = p.id === activePreset.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPreset(p.id)}
                        className={`w-full text-left px-2 py-1 rounded-md text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                          isAct
                            ? 'bg-[#3f51b5] text-white font-semibold shadow-2xs'
                            : 'text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" style={{ background: p.swatchAccent }} />
                          <span className="truncate">{p.label}</span>
                        </div>
                        {isAct && <span className="material-symbols-outlined text-[14px]">check</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('user-profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f] dark:text-slate-400">account_circle</span> My Profile Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('menu-manager');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#1e40af] dark:text-indigo-400">compass_calibration</span> Menu Navigation Studio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('profiles');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f] dark:text-slate-400">settings</span> System Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('system-parameters');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3f51b5] dark:text-indigo-400">tune</span> System Parameters Studio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('about-smriti');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f] dark:text-slate-400">info</span> About SMRITI OS
                </button>

                {onLogout && (
                  <div className="pt-1 mt-1 border-t border-[#c5c5d4]/50 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#ba1a1a] dark:text-rose-400 hover:bg-[#ffdad6]/40 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] dark:text-rose-400">logout</span> Log Out Session
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Header Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Logout Session"
            className="p-1.5 hover:bg-[#ba1a1a] rounded-md transition-colors text-indigo-100 hover:text-white cursor-pointer ml-0.5"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        )}
      </div>

      {/* UX Mode Switcher Dialog Modal */}
      <UxSwitcherModal
        isOpen={isUxModalOpen}
        onClose={() => setIsUxModalOpen(false)}
      />
    </header>
  );
};
