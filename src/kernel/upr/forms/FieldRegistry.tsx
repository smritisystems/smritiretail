/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Field Registry (UFR-003)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { FormFieldDefinition } from "./FormRegistry.js";

export interface FieldControlProps {
  field: FormFieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  isReadOnly?: boolean;
}

export type FieldControlComponent = React.ComponentType<FieldControlProps>;

export class FieldRegistryService {
  private fieldControls: Map<string, FieldControlComponent> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultFieldControls();
  }

  private seedDefaultFieldControls() {
    // Default Fallback Controls
    this.registerFieldControl("text", DefaultTextInputControl);
    this.registerFieldControl("number", DefaultNumberInputControl);
    this.registerFieldControl("currency", DefaultNumberInputControl);
    this.registerFieldControl("percentage", DefaultNumberInputControl);
    this.registerFieldControl("select", DefaultSelectControl);
    this.registerFieldControl("enum", DefaultSelectControl);
    this.registerFieldControl("checkbox", DefaultCheckboxControl);
    this.registerFieldControl("switch", DefaultCheckboxControl);
    this.registerFieldControl("barcode", DefaultTextInputControl);
    this.registerFieldControl("textarea", DefaultTextareaControl);
  }

  public registerFieldControl(type: string, component: FieldControlComponent): void {
    this.fieldControls.set(type.toLowerCase(), component);
    this.emitChange();
  }

  public getFieldControl(type: string): FieldControlComponent {
    const found = this.fieldControls.get(type.toLowerCase());
    return found || DefaultTextInputControl;
  }

  public getRegisteredTypes(): string[] {
    return Array.from(this.fieldControls.keys());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.fieldControls.clear();
    this.seedDefaultFieldControls();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/* ── Default Standard Input Controls ── */

const DefaultTextInputControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
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

const DefaultNumberInputControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
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

const DefaultSelectControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
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

const DefaultCheckboxControl: React.FC<FieldControlProps> = ({ field, value, onChange, isReadOnly }) => (
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

const DefaultTextareaControl: React.FC<FieldControlProps> = ({ field, value, onChange, error, isReadOnly }) => (
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

export const FieldRegistry = new FieldRegistryService();
