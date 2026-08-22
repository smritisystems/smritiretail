/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, AlertCircle, Loader2 } from "lucide-react";
import { MasterConfig, MasterFormFieldDef, SelectOption } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

interface MasterFormDrawerProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  config: MasterConfig<T>;
  editingItem?: T | null;
  onSubmit: (formData: any) => Promise<void>;
  existingItems: T[];
}

export const MasterFormDrawer: React.FC<MasterFormDrawerProps> = ({
  isOpen,
  onClose,
  config,
  editingItem,
  onSubmit,
  existingItems
}) => {
  const isEdit = Boolean(editingItem);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [asyncOptions, setAsyncOptions] = useState<Record<string, SelectOption[]>>({});

  // Initialize Form Data
  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, any> = {};
    config.fields.forEach((f) => {
      if (editingItem && editingItem[f.name] !== undefined) {
        initial[f.name] = editingItem[f.name];
      } else if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === "toggle") {
        initial[f.name] = false;
      } else if (f.type === "number") {
        initial[f.name] = 0;
      } else {
        initial[f.name] = "";
      }
    });
    setFormData(initial);
    setErrors([]);
    setFieldErrors({});
  }, [isOpen, editingItem, config]);

  // Load Async Select Options
  useEffect(() => {
    if (!isOpen) return;
    config.fields.forEach(async (f) => {
      if (f.type === "select" && f.optionsEndpoint) {
        try {
          const res = await apiFetchV1(f.optionsEndpoint);
          if (f.transformOptions) {
            setAsyncOptions((prev) => ({ ...prev, [f.name]: f.transformOptions!(res) }));
          } else if (Array.isArray(res)) {
            const opts: SelectOption[] = res.map((r: any) => ({
              label: r.name || r.title || r.label || r.code || String(r),
              value: r.id || r.code || r.value || r
            }));
            setAsyncOptions((prev) => ({ ...prev, [f.name]: opts }));
          }
        } catch (e) {
          console.warn(`[MasterForm] Failed to load async options for ${f.name}:`, e);
        }
      }
    });
  }, [isOpen, config]);

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    const newFieldErrors: Record<string, string> = {};

    // 1. Mandatory Field & Custom Field Validations
    config.fields.forEach((f) => {
      if (f.showWhen && !f.showWhen(formData)) return;
      const val = formData[f.name];
      if (f.required && (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0))) {
        newFieldErrors[f.name] = `${f.label} is required.`;
      } else if (f.validate) {
        const err = f.validate(val, formData);
        if (err) newFieldErrors[f.name] = err;
      }
    });

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setErrors(Object.values(newFieldErrors));
      return;
    }

    // 2. Custom Business Validation (if configured)
    if (config.customValidation) {
      try {
        const customRes = await config.customValidation(formData, existingItems);
        if (!customRes.valid) {
          setErrors(customRes.errors || ["Validation failed."]);
          return;
        }
      } catch (err: any) {
        setErrors([err?.message || "Validation error occurred."]);
        return;
      }
    }

    // 3. Submit
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setErrors([err?.message || "Failed to save record."]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden bg-black/40 backdrop-blur-xs">
        {/* Backdrop Click Dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={onClose}
        />

        {/* Slide-out Drawer */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative z-10 flex flex-col h-full w-full max-w-xl bg-theme-surface-1 border-l border-theme-divider shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-sm">
                {isEdit ? "✏️" : "➕"}
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-primary font-display">
                  {isEdit ? `Edit ${config.entityName}` : `Create New ${config.entityName}`}
                </h3>
                <p className="text-[11px] text-theme-muted">
                  {isEdit ? `Update existing profile details and master configurations.` : `Fill out the required attributes to register a new entry.`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Error Banner */}
          {errors.length > 0 && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="space-y-0.5">
                <div className="font-bold">Please correct the following errors:</div>
                <ul className="list-disc list-inside text-[11px] opacity-90">
                  {errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.fields.map((field) => {
                if (field.showWhen && !field.showWhen(formData)) return null;
                const fieldId = `field-${field.name}`;
                const val = formData[field.name] ?? "";
                const isFieldDisabled = typeof field.disabled === "function" ? field.disabled(formData, isEdit) : Boolean(field.disabled);

                return (
                  <div
                    key={field.name}
                    className={`space-y-1.5 ${field.colSpan === 2 ? "col-span-full" : "col-span-1"}`}
                  >
                    <label htmlFor={fieldId} className="block text-[11px] font-bold uppercase tracking-wider text-theme-muted font-mono">
                      {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>

                    {/* TEXT / EMAIL / PASSWORD / NUMBER */}
                    {(field.type === "text" || field.type === "email" || field.type === "password" || field.type === "number" || field.type === "date") && (
                      <input
                        id={fieldId}
                        type={field.type}
                        value={val}
                        disabled={isFieldDisabled}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        maxLength={field.maxLength}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={(e) => {
                          const v = field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
                          handleFieldChange(field.name, v);
                        }}
                        className={`w-full px-3 py-2 bg-theme-surface-2 border rounded-lg text-xs text-theme-primary placeholder:text-theme-muted/50 focus:outline-none focus:ring-1 transition-all ${
                          fieldErrors[field.name]
                            ? "border-rose-500/50 focus:ring-rose-500"
                            : "border-theme-divider focus:border-blue-500 focus:ring-blue-500"
                        } ${isFieldDisabled ? "opacity-50 cursor-not-allowed bg-theme-surface-3" : ""}`}
                      />
                    )}

                    {/* SELECT */}
                    {field.type === "select" && (
                      <select
                        id={fieldId}
                        value={val}
                        disabled={isFieldDisabled}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className={`w-full px-3 py-2 bg-theme-surface-2 border rounded-lg text-xs text-theme-primary focus:outline-none focus:ring-1 transition-all ${
                          fieldErrors[field.name]
                            ? "border-rose-500/50 focus:ring-rose-500"
                            : "border-theme-divider focus:border-blue-500 focus:ring-blue-500"
                        } ${isFieldDisabled ? "opacity-50 cursor-not-allowed bg-theme-surface-3" : ""}`}
                      >
                        <option value="">-- Select {field.label} --</option>
                        {/* Static Options */}
                        {field.options && Array.isArray(field.options) && field.options.map((opt, oIdx) => {
                          const label = typeof opt === "string" ? opt : opt.label;
                          const optVal = typeof opt === "string" ? opt : opt.value;
                          return (
                            <option key={oIdx} value={optVal}>
                              {label}
                            </option>
                          );
                        })}
                        {/* Async Options */}
                        {asyncOptions[field.name] && asyncOptions[field.name].map((opt, oIdx) => (
                          <option key={`async-${oIdx}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* TEXTAREA */}
                    {field.type === "textarea" && (
                      <textarea
                        id={fieldId}
                        rows={3}
                        value={val}
                        disabled={isFieldDisabled}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className={`w-full px-3 py-2 bg-theme-surface-2 border rounded-lg text-xs text-theme-primary placeholder:text-theme-muted/50 focus:outline-none focus:ring-1 transition-all ${
                          fieldErrors[field.name]
                            ? "border-rose-500/50 focus:ring-rose-500"
                            : "border-theme-divider focus:border-blue-500 focus:ring-blue-500"
                        }`}
                      />
                    )}

                    {/* TOGGLE */}
                    {field.type === "toggle" && (
                      <label className="flex items-center space-x-3 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          disabled={isFieldDisabled}
                          onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-theme-divider bg-theme-surface-2"
                        />
                        <span className="text-xs text-theme-primary font-medium">
                          {field.description || `Enable ${field.label}`}
                        </span>
                      </label>
                    )}

                    {/* TAGS (comma separated) */}
                    {field.type === "tags" && (
                      <input
                        id={fieldId}
                        type="text"
                        value={Array.isArray(val) ? val.join(", ") : val}
                        disabled={isFieldDisabled}
                        placeholder="Comma-separated tags (e.g. VIP, Wholesale)"
                        onChange={(e) => {
                          const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                          handleFieldChange(field.name, arr);
                        }}
                        className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-primary focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500"
                      />
                    )}

                    {/* CUSTOM RENDER */}
                    {field.type === "custom" && field.renderCustom && (
                      field.renderCustom(formData, (newVal) => handleFieldChange(field.name, newVal))
                    )}

                    {/* Inline Field Error */}
                    {fieldErrors[field.name] && (
                      <p className="text-[10px] text-rose-400 font-mono">{fieldErrors[field.name]}</p>
                    )}
                  </div>
                );
              })}

              {/* Slot: Extra Fields */}
              {config.slots?.extraFields && (
                <div className="col-span-full">
                  {config.slots.extraFields(formData, handleFieldChange)}
                </div>
              )}
            </div>
          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-theme-divider bg-theme-surface-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-theme-muted hover:text-theme-primary bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isEdit ? "Update Record" : "Create Record"}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
