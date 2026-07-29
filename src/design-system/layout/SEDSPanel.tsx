/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS Layout Primitive (Status: Stable)
 */

import React from 'react';

export interface SEDSPanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'surface-1' | 'surface-2' | 'surface-3';
  padding?: 'none' | 'compact' | 'comfortable';
  className?: string;
  children: React.ReactNode;
}

export const SEDSPanel: React.FC<SEDSPanelProps> = ({
  title,
  subtitle,
  actions,
  variant = 'surface-1',
  padding = 'comfortable',
  className = '',
  children,
}) => {
  const bgCls = {
    'surface-1': 'bg-theme-surface-1',
    'surface-2': 'bg-theme-surface-2',
    'surface-3': 'bg-theme-surface-3',
  }[variant];

  const padCls = {
    none: 'p-0',
    compact: 'p-3',
    comfortable: 'p-5',
  }[padding];

  return (
    <div className={`rounded-xl border border-theme-divider ${bgCls} ${padCls} ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-theme-divider/60">
          <div>
            {title && typeof title === 'string' ? (
              <h3 className="text-sm font-bold text-theme-heading tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && typeof subtitle === 'string' ? (
              <p className="text-xs text-theme-muted mt-0.5">{subtitle}</p>
            ) : (
              subtitle
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
