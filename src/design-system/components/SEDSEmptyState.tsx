/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { Inbox } from 'lucide-react';

export interface SEDSEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SEDSEmptyState: React.FC<SEDSEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-theme-divider/70 bg-theme-surface-1/40 font-mono text-xs select-none ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-theme-surface-2 border border-theme-divider flex items-center justify-center text-theme-muted mb-3.5 shadow-sm">
        {icon || <Inbox size={22} className="text-theme-muted" />}
      </div>
      <h3 className="text-sm font-bold text-theme-heading tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs text-theme-muted max-w-sm mt-1 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
