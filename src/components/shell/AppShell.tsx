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
 * Classification: Application Shell Layer (UX Mode Sensitive NavRail)
 */

import React, { useState, useEffect, useRef } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { NavRail, NavRailState } from './NavRail';
import { BusinessContext, TransactionState } from './navigationResolver';
import { WorkspaceStatusBar } from './WorkspaceStatusBar';
import { BreadcrumbProvider } from '../../navigation/breadcrumb/index.ts';
import { useLayoutEngine } from '../../layout_engine/layout_store.tsx';

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
  if (['sales', 'crm', 'tax-invoice-print', 'ewaybill-management'].includes(moduleId)) {
    return 'sales';
  }
  if (['purchase', 'grn', 'supplier-mgmt', 'vendor-360', 'vendor-master', 'vendors', 'approval-matrix', 'procurement-visual-reports', 'procurement-reports', 'purchase-visual-reports'].includes(moduleId)) {
    return 'purchase';
  }
  if (['stock-ledger', 'barcode', 'inventory', 'terms-engine', 'price-revision'].includes(moduleId)) {
    return 'inventory';
  }
  if (['item-master', 'item-create-grid', 'customer-master', 'masters', 'document-series', 'databridge', 'data-bridge'].includes(moduleId)) {
    return 'masters';
  }
  if (['report-designer', 'visual-reports', 'visual-dashboard', 'business-ledger', 'audit-logs', 'accounting-sync', 'data-exchange'].includes(moduleId)) {
    return 'reports';
  }
  if (['staff-management', 'dev-tracker', 'wiki', 'about-smriti', 'legacy-migration', 'system-parameters', 'parameters-studio', 'sys-params', 'database-manager'].includes(moduleId)) {
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
  const { uxMode, reloadResolvedMenus } = useLayoutEngine();
  const hideNavRailForClassic = uxMode === 'classic' && (
    activeModuleId === 'dashboard' ||
    activeModuleId === 'billing-workspace' ||
    activeModuleId === 'pos' ||
    activeModuleId === 'launchpad' ||
    activeModuleId === 'workspaces'
  );

  const [railState, setRailState] = useState<NavRailState>(() => {
    const saved = localStorage.getItem('smriti_nav_rail_state');
    return (saved === 'EXPANDED' || saved === 'COMPACT') ? saved : 'EXPANDED';
  });
  const [savedRailState, setSavedRailState] = useState<NavRailState>('EXPANDED');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 767,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavigationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (userName?.trim() || userRole?.trim()) {
      void reloadResolvedMenus();
    }
  }, [userName, userRole, reloadResolvedMenus]);

  useEffect(() => {
    const updateViewport = () => {
      const isMobile = window.innerWidth <= 767;
      setIsMobileViewport(isMobile);
      if (!isMobile) setIsMobileNavOpen(false);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const drawer = mobileNavigationRef.current;
    const getFocusableItems = () => Array.from(
      drawer?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);

    const focusFrame = window.requestAnimationFrame(() => {
      const activeNavigationItem = drawer?.querySelector<HTMLElement>('[aria-current="page"]');
      (activeNavigationItem ?? getFocusableItems()[0] ?? drawer)?.focus();
    });

    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableItems = getFocusableItems();
      const first = focusableItems[0];
      const last = focusableItems[focusableItems.length - 1];
      if (!first || !last) {
        event.preventDefault();
        drawer?.focus();
        return;
      }

      const focusIsOutsideDrawer = !drawer?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || focusIsOutsideDrawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || focusIsOutsideDrawer)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleDrawerKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isMobileNavOpen]);

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
    if (isMobileViewport) {
      setIsMobileNavOpen((open) => !open);
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
        setIsMobileNavOpen(false);
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
  const handleNavModuleSelect = (moduleId: string) => {
    onSelectModule(moduleId);
    setIsMobileNavOpen(false);
  };

  return (
    <BreadcrumbProvider
      activeModuleId={activeModuleId}
      userRole={userRole}
      onNavigate={onSelectModule}
    >
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8f9ff] dark:bg-[#121721] text-[#0b1c30] dark:text-[#f8fafc] font-sans antialiased">
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
          showNavigationToggle={!hideNavRailForClassic}
          isMobileViewport={isMobileViewport}
          isMobileNavOpen={isMobileNavOpen}
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
      <div className="flex-1 flex overflow-hidden relative pb-8">
        {/* Hideable Navigation Rail */}
        {!hideNavRailForClassic && railState !== 'HIDDEN' && (
          <>
            {isMobileViewport && isMobileNavOpen && (
              <button
                type="button"
                aria-label="Close navigation drawer"
                aria-hidden="true"
                tabIndex={-1}
                className="fixed left-0 right-0 top-12 bottom-8 z-30 bg-slate-950/40 md:hidden"
                onClick={() => setIsMobileNavOpen(false)}
              />
            )}
            <div
              ref={mobileNavigationRef}
              id="workspace-navigation"
              aria-hidden={isMobileViewport && !isMobileNavOpen}
              role={isMobileViewport && isMobileNavOpen ? 'dialog' : undefined}
              aria-modal={isMobileViewport && isMobileNavOpen ? true : undefined}
              aria-label={isMobileViewport && isMobileNavOpen ? 'Workspace navigation' : undefined}
              tabIndex={isMobileViewport && isMobileNavOpen ? -1 : undefined}
              className={isMobileViewport
                ? `fixed left-0 top-12 bottom-8 z-40 h-auto shadow-2xl ${isMobileNavOpen ? 'block' : 'hidden'}`
                : 'relative h-full shrink-0'}
            >
              <NavRail
                railState={isMobileViewport ? 'EXPANDED' : railState}
                activeContext={resolvedContext}
                activeModuleId={activeModuleId}
                documentId={documentId}
                transactionState={transactionState}
                userRole={userRole}
                isMobileDrawer={isMobileViewport}
                onSelectModule={handleNavModuleSelect}
                onToggleRailState={handleToggleNavRail}
              />
            </div>
          </>
        )}

        {/* Workspace Canvas Area */}
        <main
          aria-hidden={isMobileViewport && isMobileNavOpen ? true : undefined}
          className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8f9ff] dark:bg-[#121721] relative"
        >
          {children}
        </main>
      </div>
      <div aria-hidden={isMobileViewport && isMobileNavOpen ? true : undefined}>
        <WorkspaceStatusBar
          activeModuleTitle={activeModuleTitle}
          userName={userName}
          userRole={userRole}
        />
      </div>
      </div>
    </BreadcrumbProvider>
  );
};
