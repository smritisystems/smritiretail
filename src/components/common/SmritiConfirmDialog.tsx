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

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, Info, ShieldAlert, X, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// ─── SmritiConfirmDialog ────────────────────────────────────────────────────

export type ConfirmDialogVariant = "danger" | "warning" | "info";

export interface SmritiConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig: Record<
  ConfirmDialogVariant,
  {
    icon: React.ReactNode;
    iconBg: string;
    confirmBtn: string;
    borderColor: string;
  }
> = {
  danger: {
    icon: <Trash2 size={20} />,
    iconBg: "bg-red-500/10 text-red-400 border border-red-500/20",
    confirmBtn: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20",
    borderColor: "border-red-500/20",
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    iconBg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    confirmBtn: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20",
    borderColor: "border-amber-500/20",
  },
  info: {
    icon: <Info size={20} />,
    iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    confirmBtn: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20",
    borderColor: "border-blue-500/20",
  },
};

export const SmritiConfirmDialog: React.FC<SmritiConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cfg = variantConfig[variant];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      if (e.key === "Enter")  { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smriti-confirm-title"
          aria-describedby="smriti-confirm-message"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.18 }}
            className={`relative w-full max-w-sm bg-theme-surface-1 rounded-2xl shadow-2xl border ${cfg.borderColor} overflow-hidden`}
          >
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${cfg.iconBg}`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h2 id="smriti-confirm-title" className="text-sm font-bold text-theme-primary font-display">
                  {title}
                </h2>
                <p id="smriti-confirm-message" className="text-xs text-theme-muted mt-1 leading-relaxed">
                  {message}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${cfg.confirmBtn}`}
              >
                <Check size={13} />
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── SmritiReasonDialog ─────────────────────────────────────────────────────

export interface SmritiReasonDialogProps {
  isOpen: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const SmritiReasonDialog: React.FC<SmritiReasonDialogProps> = ({
  isOpen,
  title,
  label = "Reason",
  placeholder = "Enter reason...",
  minLength = 3,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue("");
      setTouched(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  const hasError = touched && value.trim().length < minLength;

  const handleConfirm = () => {
    setTouched(true);
    if (value.trim().length < minLength) return;
    onConfirm(value.trim());
    setValue("");
    setTouched(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smriti-reason-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-sm bg-theme-surface-1 rounded-2xl shadow-2xl border border-amber-500/20 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-theme-divider">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldAlert size={16} />
                </div>
                <h2 id="smriti-reason-title" className="text-sm font-bold text-theme-primary font-display">
                  {title}
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                {label}
                {minLength > 0 && <span className="text-red-400 ml-1">*</span>}
              </label>
              <textarea
                ref={inputRef}
                rows={3}
                value={value}
                onChange={(e) => { setValue(e.target.value); }}
                onBlur={() => setTouched(true)}
                placeholder={placeholder}
                className={`w-full resize-none px-3 py-2.5 text-xs rounded-xl border font-sans transition-colors focus:outline-none bg-theme-surface-2 text-theme-primary ${
                  hasError
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-theme-divider focus:border-blue-500"
                }`}
              />
              {hasError && (
                <p className="text-[11px] text-red-400 font-medium">
                  Please enter at least {minLength} characters.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={touched && value.trim().length < minLength}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-amber-500/20"
              >
                <Check size={13} />
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
