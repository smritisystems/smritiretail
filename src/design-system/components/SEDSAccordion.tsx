/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SEDSAccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface SEDSAccordionProps {
  items: SEDSAccordionItem[];
  defaultExpandedIds?: string[];
  allowMultiple?: boolean;
  className?: string;
}

export const SEDSAccordion: React.FC<SEDSAccordionProps> = ({
  items,
  defaultExpandedIds = [],
  allowMultiple = false,
  className = '',
}) => {
  const [expandedIds, setExpandedIds] = useState<string[]>(defaultExpandedIds);

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setExpandedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setExpandedIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className={`divide-y divide-theme-divider/60 border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1 font-mono text-xs ${className}`}>
      {items.map((item) => {
        const isExpanded = expandedIds.includes(item.id);

        return (
          <div key={item.id} className="transition-colors">
            <button
              type="button"
              disabled={item.disabled}
              onClick={() => !item.disabled && toggleItem(item.id)}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-theme-heading hover:bg-theme-surface-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
            >
              <div className="flex items-center gap-2.5">
                <span>{item.title}</span>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    {item.badge}
                  </span>
                )}
              </div>
              <ChevronDown
                size={15}
                className={`text-theme-muted transition-transform duration-200 shrink-0 ${
                  isExpanded ? 'rotate-180 text-indigo-400' : ''
                }`}
              />
            </button>

            {isExpanded && (
              <div className="p-4 border-t border-theme-divider/40 bg-theme-surface-2/40 animate-in fade-in duration-200">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
