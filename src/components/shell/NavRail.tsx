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
 * Classification: Navigation Rail (Persistent Global & Contextual Submenus)
 */

import React, { useState } from 'react';
import {
  BusinessContext,
  TransactionState,
  resolveNavigation,
  ContextualMenuItem,
} from './navigationResolver';
import { useLayoutEngine } from '../../layout_engine/layout_store';
import { filterContextualNavigation } from './navigationAccess';

export type NavRailState = 'EXPANDED' | 'COMPACT' | 'HIDDEN';

interface NavRailProps {
  railState: NavRailState;
  activeContext: BusinessContext;
  activeModuleId: string;
  documentId?: string;
  transactionState?: TransactionState;
  userRole?: string;
  isMobileDrawer?: boolean;
  onSelectModule: (moduleId: string) => void;
  onToggleRailState: () => void;
}

export const NavRail: React.FC<NavRailProps> = ({
  railState,
  activeContext,
  activeModuleId,
  documentId,
  transactionState,
  userRole,
  isMobileDrawer = false,
  onSelectModule,
  onToggleRailState,
}) => {
  const [isReportsExpanded, setIsReportsExpanded] = useState(true);
  const [isOtherModulesExpanded, setIsOtherModulesExpanded] = useState(false);
  const [activeSubActionId, setActiveSubActionId] = useState<string>('doc-overview');
  const { resolvedNavigationIds } = useLayoutEngine();

  if (railState === 'HIDDEN') {
    return null;
  }

  const isExpanded = railState === 'EXPANDED';

  // Resolve contextual navigation menu based on active context, document, and transaction state.
  const navData = resolveNavigation({
    context: activeContext,
    workspace: activeModuleId,
    documentId,
    transactionState,
    userRole,
    activeActionId: activeSubActionId,
  });

  const visibleNavigationItems = filterContextualNavigation(
    navData.items,
    activeModuleId,
    resolvedNavigationIds,
  );

  const reportStudios = [
    { id: 'sales_studio', label: 'Sales' },
    { id: 'purchase_studio', label: 'Purchase' },
    { id: 'inventory_studio', label: 'Inventory' },
    { id: 'tax_studio', label: 'Tax & Compliance' },
    { id: 'mis_studio', label: 'MIS & Analytics' },
    { id: 'customer_studio', label: 'Customer' },
    { id: 'merchandise_studio', label: 'Merchandise' },
    { id: 'operations_studio', label: 'Operations' },
  ];

  // Other persistent global categories (excluding current context)
  const otherCategories = (navData.globalCategories || []).filter(
    (c) => c.context !== activeContext && c.context !== 'launchpad',
  );

  const handleSubmenuActionClick = (actionId: string) => {
    setActiveSubActionId(actionId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smriti_contextual_action_selected', {
          detail: {
            actionId,
            documentId,
            transactionState,
            context: activeContext,
          },
        }),
      );
    }
  };

  return (
    <aside
      aria-label="Contextual navigation"
      className={`bg-[#f8f9ff] dark:bg-slate-900 border-r border-[#c5c5d4] dark:border-slate-800 flex flex-col justify-between transition-all duration-200 z-20 h-full select-none shrink-0 ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* Context Badge Header */}
      <div className="p-2.5 border-b border-[#c5c5d4] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#3f51b5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[18px]">{navData.contextIcon}</span>
          </div>
          {isExpanded && (
            <div className="truncate min-w-0">
              <span className="text-[10px] font-bold tracking-wider text-[#757684] dark:text-slate-400 uppercase block leading-tight">
                Active Context
              </span>
              <span className="text-xs font-bold text-[#24389c] dark:text-indigo-400 truncate block leading-tight">
                {navData.contextLabel}
              </span>
            </div>
          )}
        </div>
        {isExpanded && documentId && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-indigo-300 border border-blue-200 dark:border-slate-700 shrink-0 uppercase font-semibold">
            {transactionState || 'DRAFT'}
          </span>
        )}
      </div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-1">
        {visibleNavigationItems.map((item: ContextualMenuItem) => {
          const isActive = activeModuleId === item.id;
          const isDisabled = Boolean(item.disabled);
          const hasSubmenus = Boolean(item.submenus && item.submenus.length > 0);

          return (
            <div key={item.id} className="relative group/navitem">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onSelectModule(item.id);
                  if (item.id === 'report-designer') setIsReportsExpanded((prev) => !prev);
                }}
                title={
                  isDisabled
                    ? `${item.title} (${item.disabledReason || 'Action disabled'})`
                    : !isExpanded
                    ? item.title
                    : undefined
                }
                aria-label={`Open ${item.title}`}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3f51b5] dark:focus-visible:ring-indigo-400 ${
                  isDisabled
                    ? 'opacity-40 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 cursor-not-allowed border border-dashed border-gray-300 dark:border-slate-700'
                    : isActive
                    ? 'bg-[#3f51b5] text-white font-semibold shadow-xs'
                    : item.isNextBestAction
                    ? 'bg-[#abf4ac]/30 text-[#286b33] dark:text-emerald-400 font-semibold border border-[#286b33]/20 dark:border-emerald-500/20 hover:bg-[#abf4ac]/50'
                    : 'text-[#0b1c30] dark:text-slate-200 hover:bg-[#e5eeff] dark:hover:bg-slate-800 hover:text-[#24389c] dark:hover:text-indigo-400'
                } ${!isExpanded ? 'justify-center px-0' : ''}`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] shrink-0 ${
                    isDisabled
                      ? 'text-gray-400 dark:text-slate-500'
                      : isActive
                      ? 'text-white'
                      : item.isNextBestAction
                      ? 'text-[#286b33] dark:text-emerald-400'
                      : 'text-[#3d425f] dark:text-slate-400'
                  }`}
                >
                  {item.icon}
                </span>

                {isExpanded && (
                  <span className="truncate flex-1 text-left">{item.title}</span>
                )}

                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-white text-[#24389c]'
                        : 'bg-[#abf4ac] text-[#002107]'
                    } ${!isExpanded ? 'absolute top-1 right-1 text-[8px] px-1 py-0' : ''}`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>

              {/* Nested Contextual Document Submenu */}
              {hasSubmenus && isExpanded && (
                <div className="ml-6 mt-1 mb-1.5 pl-2.5 border-l-2 border-[#3f51b5]/30 dark:border-indigo-500/30 space-y-0.5">
                  <div className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#757684] dark:text-slate-400 flex items-center justify-between">
                    <span>Document Actions</span>
                    {documentId && <span className="text-[8px] text-indigo-500 truncate max-w-[80px]">{documentId}</span>}
                  </div>
                  {item.submenus!.map((subAction) => {
                    const isSubDisabled = Boolean(subAction.disabled);
                    const isSubActive = activeSubActionId === subAction.id;

                    return (
                      <button
                        key={subAction.id}
                        type="button"
                        disabled={isSubDisabled}
                        onClick={() => handleSubmenuActionClick(subAction.id)}
                        title={
                          isSubDisabled
                            ? `${subAction.title} (${subAction.disabledReason || 'Action unavailable'})`
                            : subAction.title
                        }
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                          isSubDisabled
                            ? 'opacity-35 text-gray-400 dark:text-slate-600 cursor-not-allowed line-through'
                            : isSubActive
                            ? 'bg-[#3f51b5]/15 text-[#24389c] dark:text-indigo-300 font-semibold border border-[#3f51b5]/30'
                            : 'text-[#3d425f] dark:text-slate-300 hover:bg-[#e5eeff] dark:hover:bg-slate-800 hover:text-[#24389c] dark:hover:text-indigo-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px] shrink-0">
                          {subAction.icon}
                        </span>
                        <span className="truncate flex-1">{subAction.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {item.id === 'report-designer' && isActive && isExpanded && isReportsExpanded && (
                <div className="ml-8 mt-1 mb-2 pl-3 border-l border-[#c5c5d4] dark:border-slate-700 space-y-0.5">
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#757684] dark:text-slate-400">
                    Report Studios
                  </div>
                  {reportStudios.map((studio) => (
                    <button
                      key={studio.id}
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('smriti_report_studio_select', {
                            detail: { studioId: studio.id },
                          }),
                        );
                        onSelectModule('report-designer');
                      }}
                      aria-label={`Open ${studio.label} report studio`}
                      className="w-full text-left px-2 py-1.5 rounded-md text-xs text-[#3d425f] dark:text-slate-300 hover:bg-[#e5eeff] dark:hover:bg-slate-800 hover:text-[#24389c] dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3f51b5] dark:focus-visible:ring-indigo-400"
                    >
                      {studio.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Disabled Action Explanation Tooltip */}
              {isDisabled && isExpanded && item.disabledReason && (
                <div className="hidden group-hover/navitem:block absolute left-2 top-full mt-1 bg-gray-900 text-white text-[10px] p-2 rounded-md shadow-lg z-50 max-w-xs">
                  {item.disabledReason}
                </div>
              )}
            </div>
          );
        })}

        {/* Persistent Global Navigation Accordion for Other Categories */}
        {isExpanded && otherCategories.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[#c5c5d4] dark:border-slate-800 space-y-1">
            <button
              type="button"
              onClick={() => setIsOtherModulesExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono font-bold uppercase text-[#757684] dark:text-slate-400 hover:text-[#24389c] dark:hover:text-indigo-300"
            >
              <span>Other Global Modules</span>
              <span className="material-symbols-outlined text-[14px]">
                {isOtherModulesExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOtherModulesExpanded && (
              <div className="space-y-1 pl-1">
                {otherCategories.map((cat) => (
                  <div key={cat.context} className="space-y-0.5">
                    <span className="text-[9px] font-bold text-[#757684] uppercase tracking-wider block px-1.5 pt-1">
                      {cat.label}
                    </span>
                    {cat.workspaces.filter((w) => w.id !== 'launchpad').map((ws) => (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => onSelectModule(ws.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                          activeModuleId === ws.id
                            ? 'bg-[#3f51b5] text-white font-medium'
                            : 'text-[#3d425f] dark:text-slate-300 hover:bg-[#e5eeff] dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{ws.icon}</span>
                        <span className="truncate">{ws.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rail Footer Toggle */}
      <div className="p-2 border-t border-[#c5c5d4] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleRailState}
          aria-label={
            isMobileDrawer
              ? 'Close navigation menu'
              : isExpanded
              ? 'Collapse navigation rail'
              : 'Expand navigation rail'
          }
          title={
            isMobileDrawer
              ? 'Close navigation menu'
              : isExpanded
              ? 'Collapse navigation rail'
              : 'Expand navigation rail'
          }
          aria-expanded={isMobileDrawer ? undefined : isExpanded}
          aria-controls="workspace-navigation"
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-[#3d425f] dark:text-slate-300 hover:bg-[#eff4ff] dark:hover:bg-slate-800 hover:text-[#24389c] dark:hover:text-indigo-400 rounded-md transition-colors font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3f51b5] dark:focus-visible:ring-indigo-400"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isMobileDrawer ? 'close' : isExpanded ? 'chevron_left' : 'chevron_right'}
          </span>
          {isExpanded && <span>{isMobileDrawer ? 'Close Menu' : 'Collapse Menu'}</span>}
        </button>
      </div>
    </aside>
  );
};
