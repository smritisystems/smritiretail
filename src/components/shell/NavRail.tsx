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
import {
  BusinessContext,
  TransactionState,
  resolveNavigation,
  ContextualMenuItem,
} from './navigationResolver';

export type NavRailState = 'EXPANDED' | 'COMPACT' | 'HIDDEN';

interface NavRailProps {
  railState: NavRailState;
  activeContext: BusinessContext;
  activeModuleId: string;
  documentId?: string;
  transactionState?: TransactionState;
  userRole?: string;
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
  onSelectModule,
  onToggleRailState,
}) => {
  if (railState === 'HIDDEN') {
    return null;
  }

  const isExpanded = railState === 'EXPANDED';

  // Resolve contextual navigation menu based on active context, document, transaction state, and role
  const navData = resolveNavigation({
    context: activeContext,
    workspace: activeModuleId,
    documentId,
    transactionState,
    userRole,
  });

  return (
    <aside
      className={`bg-[#f8f9ff] border-r border-[#c5c5d4] flex flex-col justify-between transition-all duration-200 z-20 h-[calc(100vh-52px)] select-none shrink-0 ${
        isExpanded ? 'w-56' : 'w-14'
      }`}
    >
      {/* Context Badge Header */}
      <div className="p-2.5 border-b border-[#c5c5d4] bg-white flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#3f51b5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          <span className="material-symbols-outlined text-[18px]">{navData.contextIcon}</span>
        </div>
        {isExpanded && (
          <div className="truncate min-w-0">
            <span className="text-[10px] font-bold tracking-wider text-[#757684] uppercase block leading-tight">
              Active Context
            </span>
            <span className="text-xs font-bold text-[#24389c] truncate block leading-tight">
              {navData.contextLabel}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-1">
        {navData.items.map((item: ContextualMenuItem) => {
          const isActive = activeModuleId === item.id;
          const isDisabled = Boolean(item.disabled);

          return (
            <div key={item.id} className="relative group/navitem">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelectModule(item.id)}
                title={
                  isDisabled
                    ? `${item.title} (${item.disabledReason || 'Action disabled'})`
                    : !isExpanded
                    ? item.title
                    : undefined
                }
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all relative ${
                  isDisabled
                    ? 'opacity-40 bg-gray-100 text-gray-500 cursor-not-allowed border border-dashed border-gray-300'
                    : isActive
                    ? 'bg-[#3f51b5] text-white font-semibold shadow-xs'
                    : item.isNextBestAction
                    ? 'bg-[#abf4ac]/30 text-[#286b33] font-semibold border border-[#286b33]/20 hover:bg-[#abf4ac]/50'
                    : 'text-[#0b1c30] hover:bg-[#e5eeff] hover:text-[#24389c]'
                } ${!isExpanded ? 'justify-center px-0' : ''}`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] shrink-0 ${
                    isDisabled
                      ? 'text-gray-400'
                      : isActive
                      ? 'text-white'
                      : item.isNextBestAction
                      ? 'text-[#286b33]'
                      : 'text-[#3d425f]'
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

              {/* Disabled Action Explanation Tooltip */}
              {isDisabled && isExpanded && item.disabledReason && (
                <div className="hidden group-hover/navitem:block absolute left-2 top-full mt-1 bg-gray-900 text-white text-[10px] p-2 rounded-md shadow-lg z-50 max-w-xs">
                  {item.disabledReason}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rail Footer Toggle */}
      <div className="p-2 border-t border-[#c5c5d4] bg-white flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleRailState}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-[#3d425f] hover:bg-[#eff4ff] hover:text-[#24389c] rounded-md transition-colors font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isExpanded ? 'chevron_left' : 'chevron_right'}
          </span>
          {isExpanded && <span>Collapse Menu</span>}
        </button>
      </div>
    </aside>
  );
};
