/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { motion } from "motion/react";

export interface SmritiEmptyStateProps {
  /** Lucide icon element or any React node */
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Primary call-to-action button */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary / link action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Extra className for the wrapper */
  className?: string;
}

export const SmritiEmptyState: React.FC<SmritiEmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center select-none ${className}`}
    >
      {/* Icon halo */}
      <div className="mb-5 flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-surface-2 border border-theme-divider text-theme-muted shadow-inner">
        <span className="text-3xl [&>svg]:w-7 [&>svg]:h-7">{icon}</span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-theme-primary font-display mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-xs text-theme-muted leading-relaxed max-w-xs mb-6">
          {description}
        </p>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center mt-1">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20"
            >
              {primaryAction.icon && (
                <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">
                  {primaryAction.icon}
                </span>
              )}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-xs font-semibold text-theme-muted hover:text-theme-primary underline underline-offset-2 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
