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

import React, { useState, useEffect } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { NavRail, NavRailState } from './NavRail';
import { BusinessContext, TransactionState } from './navigationResolver';

interface AppShellProps {
  activeModuleId: string;
  activeModuleTitle: string;
  activeContext?: BusinessContext;
  documentId?: string;
  transactionState?: TransactionState;
  onSelectModule: (moduleId: string) => void;
  navigationHistory?: string[];
  onNavigateBack?: () => void;
  onNavigateHome: () => void;
  onLogout?: () => void;
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}

const mapModuleToContext = (moduleId: string): BusinessContext => {
  if (['sales', 'pos', 'crm', 'create-tax-invoice', 'tax-invoice-print'].includes(moduleId)) {
    return 'sales';
  }
  if (['purchase', 'grn', 'supplier-mgmt', 'approval-matrix'].includes(moduleId)) {
    return 'purchase';
  }
  if (['stock-ledger', 'barcode', 'inventory', 'terms-engine'].includes(moduleId)) {
    return 'inventory';
  }
  if (['item-master', 'item-create-grid', 'customer-master', 'masters', 'document-series'].includes(moduleId)) {
    return 'masters';
  }
  if (['report-designer', 'business-ledger', 'audit-logs', 'accounting-sync', 'data-exchange'].includes(moduleId)) {
    return 'reports';
  }
  if (['staff-management', 'dev-tracker', 'wiki', 'about-smriti'].includes(moduleId)) {
    return 'system';
  }
  return 'launchpad';
};

export const AppShell: React.FC<AppShellProps> = ({
  activeModuleId,
  activeModuleTitle,
  activeContext,
  documentId,
  transactionState,
  onSelectModule,
  navigationHistory = [],
  onNavigateBack,
  onNavigateHome,
  onLogout,
  userName,
  userRole,
  children,
}) => {
  const [railState, setRailState] = useState<NavRailState>(() => {
    const saved = localStorage.getItem('smriti_nav_rail_state');
    return (saved === 'EXPANDED' || saved === 'COMPACT') ? saved : 'EXPANDED';
  });
  const [savedRailState, setSavedRailState] = useState<NavRailState>('EXPANDED');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  useEffect(() => {
    if (railState !== 'HIDDEN') {
      localStorage.setItem('smriti_nav_rail_state', railState);
    }
  }, [railState]);

  const handleToggleNavRail = () => {
    if (isFocusMode) {
      setIsFocusMode(false);
      setRailState(savedRailState === 'HIDDEN' ? 'EXPANDED' : savedRailState);
      return;
    }
    setRailState((prev) => {
      const next = prev === 'EXPANDED' ? 'COMPACT' : 'EXPANDED';
      localStorage.setItem('smriti_nav_rail_state', next);
      return next;
    });
  };

  const handleToggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      if (next) {
        setSavedRailState(railState);
        setRailState('HIDDEN');
      } else {
        setRailState(savedRailState === 'HIDDEN' ? 'EXPANDED' : savedRailState);
      }
      return next;
    });
  };

  const resolvedContext = activeContext || mapModuleToContext(activeModuleId);
  const canNavigateBack = navigationHistory.length > 1;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8f9ff] text-[#0b1c30] font-sans antialiased">
      {/* Global Header */}
      {!isFocusMode ? (
        <GlobalHeader
          activeModuleId={activeModuleId}
          activeModuleTitle={activeModuleTitle}
          onNavigateHome={onNavigateHome}
          onNavigateBack={onNavigateBack}
          canNavigateBack={canNavigateBack}
          onToggleNavRail={handleToggleNavRail}
          isNavRailCollapsed={railState === 'COMPACT' || railState === 'HIDDEN'}
          isFocusMode={isFocusMode}
          onToggleFocusMode={handleToggleFocusMode}
          onSelectModule={onSelectModule}
          onLogout={onLogout}
          userName={userName}
          userRole={userRole}
        />
      ) : (
        /* Focus Mode Compact Header Bar */
        <div className="bg-[#24389c] text-white h-9 px-3 flex items-center justify-between border-b border-[#3f51b5] text-xs font-medium z-30 select-none">
          <div className="flex items-center gap-2">
            <span className="bg-[#abf4ac] text-[#002107] text-[10px] font-bold px-2 py-0.5 rounded-md">
              FOCUS MODE
            </span>
            <span className="font-semibold">{activeModuleTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs text-indigo-200 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">home</span> Home
            </button>
            <button
              type="button"
              onClick={handleToggleFocusMode}
              className="bg-[#3f51b5] hover:bg-indigo-600 text-white text-xs px-2.5 py-0.5 rounded-md flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">fullscreen_exit</span> Exit Focus
            </button>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Hideable Navigation Rail */}
        <NavRail
          railState={railState}
          activeContext={resolvedContext}
          activeModuleId={activeModuleId}
          documentId={documentId}
          transactionState={transactionState}
          userRole={userRole}
          onSelectModule={onSelectModule}
          onToggleRailState={handleToggleNavRail}
        />

        {/* Workspace Canvas Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8f9ff] relative">
          {children}
        </main>
      </div>
    </div>
  );
};
