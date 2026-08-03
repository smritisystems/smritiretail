/**
 * Project      : SMRITI Retail OS
 * Module       : Standardized Modal Dialog Component (SLGP-R4 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SmritiDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  maxWidthClass?: string;
}

export const SmritiDialog: React.FC<SmritiDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footerActions,
  maxWidthClass = "max-w-2xl"
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-[var(--sds-dialog-margin)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className={`w-full h-full sm:h-auto ${maxWidthClass} max-h-[calc(100dvh-24px)] bg-theme-surface-1 border border-theme-divider rounded-none sm:rounded-xl shadow-2xl flex flex-col overflow-hidden`}
        >
          {/* Fixed Dialog Header (shrink-0) */}
          <div className="shrink-0 p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-1">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded bg-theme-surface-2 border border-theme-divider text-[var(--c-seef-accent)]">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-theme-heading">{title}</h3>
                {subtitle && <p className="text-xs text-theme-muted">{subtitle}</p>}
              </div>
            </div>

            <button
              onClick={onClose}
              className="min-w-[var(--sds-touch-target-min)] min-h-[var(--sds-touch-target-min)] p-1.5 rounded-md text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2 transition-colors flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Dialog Body (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4">
            {children}
          </div>

          {/* Fixed Dialog Footer Actions (shrink-0) */}
          {footerActions && (
            <div className="shrink-0 p-4 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-end gap-3">
              {footerActions}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
