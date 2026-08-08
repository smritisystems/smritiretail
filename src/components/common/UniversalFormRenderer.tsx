/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Form Renderer (UFR-002)
 * Standard     : SMAP Constitution v1.0 â€” Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { SPK } from "../../kernel/SPK.js";
import { FormDefinition, FormFieldDefinition, FormValidationResult } from "../../kernel/upr/forms/FormRegistry.js";
import { AlertCircle, Check, Save, RotateCcw } from "lucide-react";

export interface UniversalFormRendererProps {
  formId: string;
  initialValues?: Record<string, any>;
  onSave?: (values: Record<string, any>) => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
}

export const UniversalFormRenderer: React.FC<UniversalFormRendererProps> = ({
  formId,
  initialValues = {},
  onSave,
  onCancel,
  isReadOnly = false
}) => {
  const [formDef, setFormDef] = useState<FormDefinition | undefined>(() => SPK.forms.getForm(formId));
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const unsub = SPK.forms.subscribe(() => {
      setFormDef(SPK.forms.getForm(formId));
    });
    return unsub;
  }, [formId]);

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitted(false);
  }, [initialValues, formId]);

  if (!formDef) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>UFR Error: Form ID '{formId}' is not registered in UPR FormRegistry.</span>
      </div>
    );
  }

  const handleFieldChange = (fieldId: string, value: any) => {
    const nextValues = { ...values, [fieldId]: value };
    setValues(nextValues);

    if (isSubmitted) {
      const validation = SPK.forms.validateForm(formId, nextValues);
      setErrors(validation.errors);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    const validation = SPK.forms.validateForm(formId, values);
    setErrors(validation.errors);

    if (validation.isValid) {
      if (onSave) {
        onSave(values);
      }
    }
  };

  const renderControl = (field: FormFieldDefinition) => {
    const val = values[field.id] !== undefined ? values[field.id] : (field.defaultValue ?? "");
    const fieldError = errors[field.id];

    // UFR-003 Dynamic Field Control Resolution via FieldRegistry
    const FieldControlComponent = SPK.fields.getFieldControl(field.type);

    return (
      <FieldControlComponent
        field={field}
        value={val}
        onChange={(newVal: unknown) => handleFieldChange(field.id, newVal)}
        error={fieldError}
        isReadOnly={isReadOnly}
      />
    );
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-6 text-xs font-sans">
      {/* Form Header */}
      <div className="flex items-center justify-between pb-3 border-b border-theme-divider">
        <div>
          <h2 className="text-sm font-bold text-theme-heading tracking-wide uppercase">{formDef.title}</h2>
          {formDef.description && <p className="text-[11px] text-theme-muted mt-0.5">{formDef.description}</p>}
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border border-[var(--c-seef-accent)]/20">
          UFR Form v{formDef.version}
        </span>
      </div>

      {/* Form Sections & 12-Column Responsive Grid */}
      <div className="space-y-6">
        {formDef.sections.map((section) => (
          <div key={section.id} className="space-y-3 bg-theme-surface-2/40 p-3.5 rounded-xl border border-theme-divider/60">
            <h3 className="text-xs font-bold text-theme-heading uppercase tracking-wider text-[var(--c-seef-accent)] border-b border-theme-divider/40 pb-1.5">
              {section.title}
            </h3>

            <div className="grid grid-cols-12 gap-3">
              {section.fields.map((field) => {
                const spanClass = SPK.layouts.resolveGridClass(field.gridSpan || 12);
                const fieldError = errors[field.id];

                return (
                  <div key={field.id} className={spanClass}>
                    {field.type !== "checkbox" && field.type !== "switch" && (
                      <label className="block text-[11px] font-bold text-theme-muted mb-1 uppercase tracking-wider">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                    )}

                    {renderControl(field)}

                    {fieldError && <p className="text-[10px] text-red-400 font-bold mt-1">{fieldError}</p>}
                    {field.helpText && !fieldError && <p className="text-[10px] text-theme-muted mt-1">{field.helpText}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Form Action Toolbar */}
      {!isReadOnly && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-divider">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg border border-theme-divider text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/90 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Entity</span>
          </button>
        </div>
      )}
    </form>
  );
};
