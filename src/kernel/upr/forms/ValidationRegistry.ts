/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Validation Registry (UFR-004)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface ValidationContext {
  fieldId: string;
  fieldLabel: string;
  value: any;
  ruleValue?: any;
  entityValues?: Record<string, any>;
}

export type ValidatorFn = (context: ValidationContext) => string | null;

export interface ValidatorDefinition {
  id: string;               // Validator identifier (e.g. "required", "email", "gst", "pan", "mobile", "min", "max")
  name: string;
  description?: string;
  validate: ValidatorFn;
}

export class ValidationRegistryService {
  private validators: Map<string, Readonly<ValidatorDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultValidators();
  }

  private seedDefaultValidators() {
    // Required Validator
    this.registerValidator({
      id: "required",
      name: "Required Field",
      validate: ({ fieldLabel, value }) => {
        if (value === undefined || value === null || String(value).trim() === "") {
          return `${fieldLabel} is required.`;
        }
        return null;
      }
    });

    // Min Value Validator
    this.registerValidator({
      id: "min",
      name: "Minimum Value",
      validate: ({ fieldLabel, value, ruleValue }) => {
        if (value !== undefined && value !== null && value !== "" && Number(value) < Number(ruleValue)) {
          return `${fieldLabel} must be at least ${ruleValue}.`;
        }
        return null;
      }
    });

    // Max Value Validator
    this.registerValidator({
      id: "max",
      name: "Maximum Value",
      validate: ({ fieldLabel, value, ruleValue }) => {
        if (value !== undefined && value !== null && value !== "" && Number(value) > Number(ruleValue)) {
          return `${fieldLabel} cannot exceed ${ruleValue}.`;
        }
        return null;
      }
    });

    // Email Validator
    this.registerValidator({
      id: "email",
      name: "Email Address",
      validate: ({ fieldLabel, value }) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
          return `Please enter a valid email address for ${fieldLabel}.`;
        }
        return null;
      }
    });

    // Indian GSTIN Validator (15 alphanumeric characters)
    this.registerValidator({
      id: "gst",
      name: "GSTIN Number",
      validate: ({ fieldLabel, value }) => {
        if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(value).toUpperCase())) {
          return `${fieldLabel} must be a valid 15-character GSTIN.`;
        }
        return null;
      }
    });

    // Indian PAN Validator (10 alphanumeric characters)
    this.registerValidator({
      id: "pan",
      name: "PAN Number",
      validate: ({ fieldLabel, value }) => {
        if (value && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(value).toUpperCase())) {
          return `${fieldLabel} must be a valid 10-character PAN number.`;
        }
        return null;
      }
    });

    // Mobile Number Validator (10 digits)
    this.registerValidator({
      id: "mobile",
      name: "Mobile Phone Number",
      validate: ({ fieldLabel, value }) => {
        if (value && !/^[6-9]\d{9}$/.test(String(value))) {
          return `${fieldLabel} must be a valid 10-digit mobile number.`;
        }
        return null;
      }
    });
  }

  public registerValidator(definition: ValidatorDefinition): void {
    const payload = Object.freeze({ ...definition, id: definition.id.toLowerCase() });
    this.validators.set(payload.id, payload);
    this.emitChange();
  }

  public getValidator(id: string): Readonly<ValidatorDefinition> | undefined {
    if (!id) return undefined;
    return this.validators.get(id.toLowerCase());
  }

  public getValidators(): ReadonlyArray<Readonly<ValidatorDefinition>> {
    return Array.from(this.validators.values());
  }

  public validateField(validatorId: string, context: ValidationContext): string | null {
    const validator = this.getValidator(validatorId);
    if (!validator) return null;
    return validator.validate(context);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.validators.clear();
    this.seedDefaultValidators();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const ValidationRegistry = new ValidationRegistryService();
