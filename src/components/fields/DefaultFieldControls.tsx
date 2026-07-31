/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Default Standard Field Controls (UFR-003)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { FormFieldDefinition } from "../../kernel/upr/forms/FormRegistry.js";

export interface FieldControlProps {
  field: FormFieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  isReadOnly?: boolean;
}

export const DefaultTextInputControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
  <input
    type="text"
    value={value !== undefined && value !== null ? String(value) : ""}
    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
    disabled={isReadOnly || field.readOnly}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full p-2 text-xs bg-theme-surface-1 text-theme-heading border rounded-lg focus:outline-none focus:border-[#0a6ed1] ${
      error ? "border-red-500" : "border-theme-divider"
    }`}
  />
);

export const DefaultNumberInputControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
  <input
    type="number"
    value={value !== undefined && value !== null ? value : ""}
    placeholder={field.placeholder || "0.00"}
    disabled={isReadOnly || field.readOnly}
    onChange={(e) => onChange(e.target.value !== "" ? Number(e.target.value) : "")}
    className={`w-full p-2 text-xs bg-theme-surface-1 text-theme-heading border rounded-lg font-mono focus:outline-none focus:border-[#0a6ed1] ${
      error ? "border-red-500" : "border-theme-divider"
    }`}
  />
);

export const DefaultSelectControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
  <select
    value={value !== undefined && value !== null ? String(value) : ""}
    disabled={isReadOnly || field.readOnly}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full p-2 text-xs bg-theme-surface-1 text-theme-heading border rounded-lg focus:outline-none focus:border-[#0a6ed1] ${
      error ? "border-red-500" : "border-theme-divider"
    }`}
  >
    <option value="">-- Select {field.label} --</option>
    {field.options?.map((opt) => (
      <option key={String(opt.value)} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export const DefaultCheckboxControl: React.FC<FieldControlProps> = ({ field, value, onChange, isReadOnly }) => (
  <label className="flex items-center gap-2 text-xs text-theme-heading cursor-pointer pt-1">
    <input
      type="checkbox"
      checked={Boolean(value)}
      disabled={isReadOnly || field.readOnly}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded border-theme-divider text-[#0a6ed1] focus:ring-[#0a6ed1]"
    />
    <span>{field.label}</span>
  </label>
);

export const DefaultTextareaControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
  <textarea
    rows={3}
    value={value !== undefined && value !== null ? String(value) : ""}
    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
    disabled={isReadOnly || field.readOnly}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full p-2 text-xs bg-theme-surface-1 text-theme-heading border rounded-lg focus:outline-none focus:border-[#0a6ed1] ${
      error ? "border-red-500" : "border-theme-divider"
    }`}
  />
);
