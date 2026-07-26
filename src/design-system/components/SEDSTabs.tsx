/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSTabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SEDSTabsProps {
  items: SEDSTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export const SEDSTabs: React.FC<SEDSTabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'underline',
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1 overflow-x-auto border-b border-theme-divider/60 font-mono text-xs select-none ${className}`}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        const tabCls = variant === 'pills'
          ? isActive
            ? 'bg-indigo-600 text-white font-bold rounded-lg px-3 py-1.5 shadow-sm'
            : 'text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover rounded-lg px-3 py-1.5'
          : isActive
            ? 'text-indigo-400 font-bold border-b-2 border-indigo-500 pb-2.5 px-3 -mb-px'
            : 'text-theme-muted hover:text-theme-heading border-b-2 border-transparent pb-2.5 px-3 -mb-px';

        return (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={`inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${tabCls}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                isActive ? 'bg-indigo-500/30 text-indigo-300' : 'bg-theme-surface-3 text-theme-muted'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
