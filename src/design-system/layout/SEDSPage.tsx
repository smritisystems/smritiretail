/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS Layout Primitive (Status: Stable)
 */

import React from 'react';

export interface SEDSPageProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const SEDSPage: React.FC<SEDSPageProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = '',
  children,
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {(title || subtitle || breadcrumbs || actions) && (
        <div className="space-y-2 border-b border-theme-divider/60 pb-4">
          {breadcrumbs && <div>{breadcrumbs}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {title && typeof title === 'string' ? (
                <h1 className="text-xl sm:text-2xl font-bold font-display text-theme-heading tracking-tight">{title}</h1>
              ) : (
                title
              )}
              {subtitle && typeof subtitle === 'string' ? (
                <p className="text-xs sm:text-sm text-theme-muted mt-1 leading-relaxed">{subtitle}</p>
              ) : (
                subtitle
              )}
            </div>
            {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
          </div>
        </div>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
};
