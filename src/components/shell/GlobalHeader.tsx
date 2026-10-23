/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-08-16
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Global Shell Header (Classic Enterprise ERP Menu & Regular Search)
 */

import React, { useState, useCallback } from 'react';
import { useActiveField } from '../../context/ActiveFieldContext.tsx';
import { useDrillDown } from '../drilldown/drilldown_store.tsx';
import { CompanySelector } from '../layout/CompanySelector.tsx';
import { Breadcrumb } from '../../navigation/breadcrumb/index.ts';
import { EnterpriseMenuBar, ENTERPRISE_MENU_ITEMS, type MenuItemDef } from './EnterpriseMenuBar.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLayoutEngine } from '../../layout_engine/layout_store.tsx';
import { UxSwitcherModal } from './UxSwitcherModal.tsx';
import { useOptionalNotifications } from '../../notifications/notification_store.tsx';
export { ENTERPRISE_MENU_ITEMS, type MenuItemDef };

interface GlobalHeaderProps {
  activeModuleTitle: string;
  activeModuleId: string;
  onNavigateHome: () => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  onToggleNavRail: () => void;
  isNavRailCollapsed: boolean;
  showNavigationToggle?: boolean;
  isMobileViewport?: boolean;
  isMobileNavOpen?: boolean;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onSelectModule?: (moduleId: string) => void;
  onLogout?: () => void;
  userRole?: string;
  userName?: string;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  activeModuleTitle,
  activeModuleId,
  onNavigateHome,
  onNavigateBack,
  canNavigateBack = false,
  onToggleNavRail,
  isNavRailCollapsed,
  showNavigationToggle = true,
  isMobileViewport = false,
  isMobileNavOpen = false,
  isFocusMode,
  onToggleFocusMode,
  onSelectModule,
  onLogout,
  userRole,
  userName,
}) => {
  const { category: activeCategory, fieldLabel } = useActiveField();
  const { setSearchOpen } = useDrillDown();
  const { theme, toggleTheme, activePreset, setPreset, presets } = useTheme();
  const { uxMode, resolvedNavigationIds } = useLayoutEngine();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useOptionalNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUxModalOpen, setIsUxModalOpen] = useState(false);
  const displayUserName = userName?.trim() || 'Account';
  const displayUserRole = userRole?.trim() || 'Signed in';
  const closeUxModal = useCallback(() => setIsUxModalOpen(false), []);

  return (
    <header className="bg-[#24389c] text-white h-12 px-3 flex items-center justify-between border-b border-[#3f51b5] select-none shadow-sm z-30 relative shrink-0">
      {/* Brand Title */}
      <button
        type="button"
        onClick={onNavigateHome}
        aria-label="Go to SMRITI home"
        className="flex items-center gap-2 px-2 py-1 hover:bg-[#3f51b5] rounded-md transition-colors text-left shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <div className="w-7 h-7 bg-white text-[#24389c] font-black text-xs flex items-center justify-center rounded-md tracking-tighter shadow-xs">
          S
        </div>
        <div className="hidden sm:block leading-none">
          <span className="font-bold text-sm tracking-wide block">SMRITI</span>
          <span className="text-[9px] text-indigo-200 tracking-wider font-mono">RETAIL OS</span>
        </div>
      </button>

      {showNavigationToggle && (
        <button
          type="button"
          onClick={onToggleNavRail}
          title={isMobileViewport ? (isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu') : (isNavRailCollapsed ? 'Expand Navigation Rail' : 'Collapse Navigation Rail')}
          aria-label={isMobileViewport ? (isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu') : (isNavRailCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail')}
          aria-controls="workspace-navigation"
          aria-expanded={isMobileViewport ? isMobileNavOpen : !isNavRailCollapsed}
          className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-white shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isMobileViewport ? 'menu' : isNavRailCollapsed ? 'side_navigation' : 'menu_open'}
          </span>
        </button>
      )}

      {/* Classic Mode Enterprise Top Menu Bar */}
      {uxMode === 'classic' ? (
        <EnterpriseMenuBar
          activeModuleId={activeModuleId}
          onNavigateHome={onNavigateHome}
          onSelectModule={onSelectModule}
          resolvedNavigationIds={resolvedNavigationIds}
        />
      ) : (
        /* Regular Mode Left Navigation & Center Search */
        <>
          <div className="hidden sm:flex min-w-0 items-center gap-2">
            {/* Separator */}
            <div className="h-4 w-px bg-indigo-400/40 mx-1" />

            {/* Internal Shell Stack Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onNavigateHome}
                title="Go to Fiori Launchpad Home"
                aria-label="Go to home"
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
                aria-label="Go back"
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
        {(uxMode === 'classic' || isMobileViewport) && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Open global search"
            title="Open global search"
            className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
        )}

        <CompanySelector />

        {/* Single entry point for changing workspace presentation */}
        <button
          type="button"
          onClick={() => setIsUxModalOpen(true)}
          aria-label={`Workspace style: ${uxMode === 'regular' ? 'Regular' : 'Classic'}. Change workspace style`}
          title={`Workspace style: ${uxMode === 'regular' ? 'Regular' : 'Classic'}`}
          className="px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-300/40 hover:bg-[#3f51b5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <span className="material-symbols-outlined text-[16px]">
            {uxMode === 'regular' ? 'laptop_mac' : 'desktop_windows'}
          </span>
          <span className="hidden sm:inline text-[11px] font-medium tracking-wide">Workspace style</span>
        </button>

        {/* Global Theme Quick Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={`Active Preset: ${activePreset.label} (${theme.toUpperCase()}). Click to switch light/dark mode.`}
          className="hidden md:flex p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white items-center gap-1.5 text-xs cursor-pointer"
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
          className={`hidden md:flex p-1.5 rounded-md transition-colors items-center gap-1 text-xs ${
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
            aria-label={`Session activity${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="dialog"
            title="Activity in this session"
            className="p-1.5 hover:bg-[#3f51b5] rounded-md transition-colors text-indigo-100 hover:text-white relative"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#ba1a1a] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#24389c]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div role="dialog" aria-label="Activity in this session" className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 text-[#0b1c30] dark:text-slate-100 rounded-xl shadow-xl border border-[#c5c5d4] dark:border-slate-700 py-2 z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-[#c5c5d4] dark:border-slate-700 flex items-center justify-between bg-[#f8f9ff] dark:bg-slate-800">
                <span className="font-semibold text-xs text-[#24389c] dark:text-indigo-400">Activity in this session</span>
                {unreadCount > 0 && <span className="text-[10px] bg-[#3f51b5] text-white px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-[#757684] dark:text-slate-400">No activity in this session.</p>
                ) : notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markAsRead(n.id)}
                    aria-label={`${n.read ? '' : 'Unread: '}${n.title}. ${n.message}`}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[#eff4ff] dark:hover:bg-slate-800 border-b border-[#c5c5d4]/40 dark:border-slate-800 transition-colors ${n.read ? '' : 'bg-blue-50/60 dark:bg-slate-800/60'}`}
                  >
                    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[#0b1c30] dark:text-slate-200">
                      <span className="truncate">{n.title}</span>
                      <span className="shrink-0 text-[10px] font-normal text-[#757684] dark:text-slate-400">{n.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </span>
                    <span className="block text-[11px] text-[#454652] dark:text-slate-400 mt-0.5 leading-snug">{n.message}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-1.5 bg-[#f8f9ff] dark:bg-slate-800 text-center border-t border-[#c5c5d4] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    markAllAsRead();
                    setIsNotificationsOpen(false);
                  }}
                  disabled={unreadCount === 0}
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
            aria-label={`Open account menu for ${displayUserName}`}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="dialog"
            className="flex items-center gap-1.5 p-1 hover:bg-[#3f51b5] rounded-md transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-[#abf4ac] text-[#002107] font-bold text-xs flex items-center justify-center shadow-xs">
              {displayUserName.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block leading-none pr-1">
              <span className="text-xs font-semibold block">{displayUserName}</span>
              <span className="text-[9px] text-indigo-200">{displayUserRole}</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-indigo-200">arrow_drop_down</span>
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div role="dialog" aria-label="Account options" className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 text-[#0b1c30] dark:text-slate-100 rounded-xl shadow-xl border border-[#c5c5d4] dark:border-slate-700 py-2 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f9ff] dark:bg-slate-800 border-b border-[#c5c5d4] dark:border-slate-700">
                <div className="font-semibold text-sm text-[#24389c] dark:text-indigo-400">{displayUserName}</div>
                <div className="text-xs text-[#454652] dark:text-slate-400">{displayUserRole}</div>
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

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onToggleFocusMode();
                }}
                className="w-full px-4 py-2 text-left text-xs text-[#0b1c30] dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#3d425f] dark:text-slate-400">fullscreen</span>
                Enter Focus Mode
              </button>

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
            className="hidden md:inline-flex p-1.5 hover:bg-[#ba1a1a] rounded-md transition-colors text-indigo-100 hover:text-white cursor-pointer ml-0.5"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        )}
      </div>

      {/* UX Mode Switcher Dialog Modal */}
      <UxSwitcherModal
        isOpen={isUxModalOpen}
        onClose={closeUxModal}
      />
    </header>
  );
};
