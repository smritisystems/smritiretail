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

import React, { useState } from 'react';
import { useActiveField } from '../../context/ActiveFieldContext.tsx';
import { useDrillDown } from '../drilldown/drilldown_store.tsx';
import { CompanySelector } from '../layout/CompanySelector.tsx';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadNotifications] = useState(3);

  const notifications = [
    { id: '1', title: 'Low Stock Alert', desc: 'Basmati Rice 5kg below min threshold (2 units left)', time: '10m ago', type: 'warning' },
    { id: '2', title: 'Pending Approval', desc: 'PO-2026-0891 awaits manager sign-off', time: '45m ago', type: 'info' },
    { id: '3', title: 'Shift Reconciled', desc: 'Shift #412 closed cleanly by Operator 04', time: '2h ago', type: 'success' },
  ];

  return (
    <header className="bg-[#24389c] text-white h-13 px-3 flex items-center justify-between border-b border-[#3f51b5] select-none shadow-sm z-30 relative">
      {/* Left Navigation & Brand Controls */}
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

        {/* Brand Title */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-2 py-1 hover:bg-[#3f51b5] rounded-md transition-colors text-left"
        >
          <div className="w-7 h-7 bg-white text-[#24389c] font-black text-xs flex items-center justify-center rounded-md tracking-tighter shadow-xs">
            S
          </div>
          <div className="hidden sm:block leading-none">
            <span className="font-bold text-sm tracking-wide block">SMRITI</span>
            <span className="text-[9px] text-indigo-200 tracking-wider font-mono">RETAIL OS</span>
          </div>
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
        <div className="hidden md:flex items-center text-xs text-indigo-200 gap-1.5 ml-2 font-medium">
          <span className="text-indigo-300">{storeName}</span>
          <span>/</span>
          <span className="text-white font-semibold">{activeModuleTitle}</span>
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

      {/* Right Controls (Focus Mode, Notifications, User Menu) */}
      <div className="flex items-center gap-1.5">
        <CompanySelector />

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
            <div className="absolute right-0 mt-2 w-80 bg-white text-[#0b1c30] rounded-xl shadow-xl border border-[#c5c5d4] py-2 z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-[#c5c5d4] flex items-center justify-between bg-[#f8f9ff]">
                <span className="font-semibold text-xs text-[#24389c]">System Notifications</span>
                <span className="text-[10px] bg-[#3f51b5] text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadNotifications} New
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-2.5 hover:bg-[#eff4ff] border-b border-[#c5c5d4]/40 transition-colors">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#0b1c30]">
                      <span>{n.title}</span>
                      <span className="text-[10px] font-normal text-[#757684]">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-[#454652] mt-0.5 leading-snug">{n.desc}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-1.5 bg-[#f8f9ff] text-center border-t border-[#c5c5d4]">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-xs font-medium text-[#24389c] hover:underline"
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
            <div className="absolute right-0 mt-2 w-64 bg-white text-[#0b1c30] rounded-xl shadow-xl border border-[#c5c5d4] py-2 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f9ff] border-b border-[#c5c5d4]">
                <div className="font-semibold text-sm text-[#24389c]">{userName}</div>
                <div className="text-xs text-[#454652]">{userRole}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-[#286b33]/10 text-[#286b33] px-2 py-0.5 rounded-md border border-[#286b33]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#286b33]" /> Active Shift #412
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('user-profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] hover:bg-[#eff4ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f]">account_circle</span> My Profile Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('menu-manager');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] hover:bg-[#eff4ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#1e40af]">compass_calibration</span> Menu Navigation Studio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('profiles');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] hover:bg-[#eff4ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f]">settings</span> System Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectModule) onSelectModule('about-smriti');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] hover:bg-[#eff4ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#3d425f]">info</span> About SMRITI OS
                </button>

                {onLogout && (
                  <div className="pt-1 mt-1 border-t border-[#c5c5d4]/50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]/40 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">logout</span> Log Out Session
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
    </header>
  );
};
