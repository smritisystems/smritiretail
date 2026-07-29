/**
 * Project      : SMRITI Business OS
 * Component    : SEDSCard (SMRITI Enterprise Design System Card)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";

export interface SEDSCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

export const SEDSCard: React.FC<SEDSCardProps> = ({
  title,
  subtitle,
  headerAction,
  footer,
  badge,
  icon: Icon,
  className = "",
  onClick,
  children,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-lg p-5 font-sans transition-all flex flex-col justify-between ${
        onClick ? "cursor-pointer hover:border-blue-500/50 hover:shadow-xl" : ""
      } ${className}`}
    >
      <div>
        {(title || Icon || badge || headerAction) && (
          <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-theme-divider/60">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="w-9 h-9 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Icon size={18} />
                </div>
              )}
              <div>
                {title && <h3 className="text-sm font-bold text-theme-body tracking-tight">{title}</h3>}
                {subtitle && <p className="text-xs text-theme-muted mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {badge}
              {headerAction}
            </div>
          </div>
        )}

        <div className="text-xs text-theme-body leading-relaxed">{children}</div>
      </div>

      {footer && <div className="mt-4 pt-3 border-t border-theme-divider/60">{footer}</div>}
    </div>
  );
};
