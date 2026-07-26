/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface SEDSBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface SEDSBreadcrumbProps {
  items: SEDSBreadcrumbItem[];
  showHome?: boolean;
  onHomeClick?: () => void;
  className?: string;
}

export const SEDSBreadcrumb: React.FC<SEDSBreadcrumbProps> = ({
  items,
  showHome = true,
  onHomeClick,
  className = '',
}) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 font-mono text-[11px] text-theme-muted select-none ${className}`}>
      {showHome && (
        <>
          <button
            onClick={onHomeClick}
            className="hover:text-theme-heading transition-colors p-0.5 rounded"
            title="Launchpad Home"
          >
            <Home size={13} />
          </button>
          <ChevronRight size={12} className="opacity-40 shrink-0" />
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="hover:text-theme-heading transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-theme-heading font-semibold' : ''}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight size={12} className="opacity-40 shrink-0" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
