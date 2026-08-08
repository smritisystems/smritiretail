/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Form Registry (UFR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { EntityRegistry } from "./EntityRegistry.js";
import { ValidationRegistry } from "./ValidationRegistry.js";

export type FormFieldType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "textarea"
  | "checkbox"
  | "switch"
  | "date"
  | "datetime"
  | "currency"
  | "percentage"
  | "barcode"
  | "image"
  | "lookup";

export interface FormValidationRule {
  type: "required" | "min" | "max" | "minLength" | "maxLength" | "regex" | "custom";
  value?: any;
  message: string;
}

export interface FormFieldDefinition {
  id: string;               // Target entity field ID (e.g. "sku", "name")
  label: string;             // Label override
  type: FormFieldType;       // Input field control type
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  lookupDomain?: string;     // For ULE lookup fields
  readOnly?: boolean;
  required?: boolean;
  gridSpan?: number;         // Columns (1-12) in responsive grid
  validations?: FormValidationRule[];
  helpText?: string;
  dependsOn?: {
    fieldId: string;
    value: any;
  };
}

export interface FormSectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldDefinition[];
  collapsedByDefault?: boolean;
}

export interface FormDefinition {
  id: string;               // Form ID (e.g. "item-master-form", "customer-master-form")
  title: string;
  description?: string;
  entityId: string;         // Target entity ID from EntityRegistry (e.g. "product", "customer")
  domainId: string;         // Domain relationship (e.g. "inventory", "sales")
  sections: FormSectionDefinition[];
  permission?: string;
  version: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class FormRegistryService {
  private forms: Map<string, Readonly<FormDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultForms();
  }

  private seedDefaultForms() {
    const defaults: FormDefinition[] = [
      {
        id: "item-master-form",
        title: "Product Item Master Form",
        entityId: "product",
        domainId: "inventory",
        version: "1.0.0",
        sections: [
          {
            id: "basic_info",
            title: "Basic Product Details",
            fields: [
              { id: "sku", label: "SKU / Barcode", type: "barcode", required: true, gridSpan: 6, validations: [{ type: "required", message: "SKU is required." }] },
              { id: "name", label: "Product Name", type: "text", required: true, gridSpan: 6, validations: [{ type: "required", message: "Product name is required." }] },
              { id: "category", label: "Category", type: "select", gridSpan: 4, options: [{ label: "Apparel", value: "Apparel" }, { label: "Footwear", value: "Footwear" }, { label: "Electronics", value: "Electronics" }] },
              { id: "brand", label: "Brand", type: "text", gridSpan: 4 },
              { id: "unit", label: "Unit of Measure (UOM)", type: "select", gridSpan: 4, options: [{ label: "Pcs", value: "Pcs" }, { label: "Kg", value: "Kg" }, { label: "Mtr", value: "Mtr" }] }
            ]
          },
          {
            id: "pricing_tax",
            title: "Pricing & Tax Configuration",
            fields: [
              { id: "mrpi", label: "MRP (₹)", type: "currency", required: true, gridSpan: 4 },
              { id: "rsp", label: "Retail Sale Price (RSP)", type: "currency", required: true, gridSpan: 4 },
              { id: "hsn", label: "HSN / SAC Code", type: "text", gridSpan: 4 }
            ]
          }
        ]
      },
      {
        id: "customer-master-form",
        title: "Customer Profile Form",
        entityId: "customer",
        domainId: "sales",
        version: "1.0.0",
        sections: [
          {
            id: "customer_info",
            title: "Customer Details",
            fields: [
              { id: "code", label: "Customer Code", type: "text", required: true, gridSpan: 4 },
              { id: "name", label: "Customer Name", type: "text", required: true, gridSpan: 4 },
              { id: "phone", label: "Mobile Number", type: "text", required: true, gridSpan: 4 },
              { id: "email", label: "Email Address", type: "text", gridSpan: 6 },
              { id: "loyalty_tier", label: "Loyalty Tier", type: "select", gridSpan: 6, options: [{ label: "Bronze", value: "Bronze" }, { label: "Silver", value: "Silver" }, { label: "Gold", value: "Gold" }, { label: "Platinum", value: "Platinum" }] }
            ]
          }
        ]
      }
    ];

    defaults.forEach((f) => this.registerForm(f));
  }

  public registerForm(form: FormDefinition): void {
    const payload = Object.freeze({ ...form, id: form.id.toLowerCase() });
    this.forms.set(payload.id, payload);
    this.emitChange();
  }

  public getForm(id: string): Readonly<FormDefinition> | undefined {
    if (!id) return undefined;
    return this.forms.get(id.toLowerCase());
  }

  public getForms(): ReadonlyArray<Readonly<FormDefinition>> {
    return Array.from(this.forms.values());
  }

  public validateForm(formId: string, values: Record<string, any>): FormValidationResult {
    const form = this.getForm(formId);
    if (!form) {
      return { isValid: false, errors: { _form: `Form '${formId}' not registered in UFR.` } };
    }

    const errors: Record<string, string> = {};

    form.sections.forEach((section) => {
      section.fields.forEach((field) => {
        const val = values[field.id];

        if (field.required) {
          const reqErr = ValidationRegistry.validateField("required", {
            fieldId: field.id,
            fieldLabel: field.label,
            value: val,
            entityValues: values
          });
          if (reqErr) {
            errors[field.id] = reqErr;
            return;
          }
        }

        if (field.validations) {
          for (const rule of field.validations) {
            const err = ValidationRegistry.validateField(rule.type, {
              fieldId: field.id,
              fieldLabel: field.label,
              value: val,
              ruleValue: rule.value,
              entityValues: values
            });
            if (err) {
              errors[field.id] = rule.message || err;
              break;
            }
          }
        }
      });
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.forms.clear();
    this.seedDefaultForms();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const FormRegistry = new FormRegistryService();
