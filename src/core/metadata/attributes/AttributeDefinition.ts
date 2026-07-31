/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : AttributeDefinition (Universal Attribute Engine Core Contract)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type AttributeDataType =
  | "text"
  | "number"
  | "decimal"
  | "currency"
  | "boolean"
  | "date"
  | "datetime"
  | "dropdown"
  | "multiselect"
  | "lookup"
  | "barcode"
  | "color"
  | "formula"
  | "json";

export type AttributeControlType =
  | "textbox"
  | "textarea"
  | "dropdown"
  | "combobox"
  | "radio"
  | "checkbox"
  | "switch"
  | "datepicker"
  | "colorpicker"
  | "lookupdialog"
  | "tagselector";

export type AttributeBusinessDomain =
  | "sales"
  | "purchase"
  | "inventory"
  | "barcode"
  | "pos"
  | "crm"
  | "accounting"
  | "reports"
  | "global";

export interface AttributeBehavior {
  visible: boolean;
  editable: boolean;
  mandatory: boolean;
  printable: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  barcodeVisible: boolean;
  mobileVisible: boolean;
  aiVisible: boolean;
}

export interface AIMetadata {
  aiDescription?: string;
  businessMeaning?: string;
  examples?: string[];
  synonyms?: string[];
  confidence?: number;
}

export interface SelectOption {
  label: string;
  value: string | number;
  colorHex?: string;
  badgeCss?: string;
}

export interface AttributeDefinition {
  attributeCode: string;
  internalName: string;
  displayLabel: string;
  description?: string;
  businessDomain: AttributeBusinessDomain;
  module?: string;

  dataType: AttributeDataType;
  controlType: AttributeControlType;
  length?: number;
  precision?: number;
  defaultValue?: any;

  behavior: AttributeBehavior;

  sequence: number;
  category?: string;
  icon?: string;
  color?: string;

  validationRule?: string; // Regex or validation expression
  validationMessage?: string;
  visibilityRule?: string; // Conditional rule e.g. "category === 'Medicine'"
  dependencyRule?: string; // Trigger attribute e.g. "category"

  options?: SelectOption[];

  ai?: AIMetadata;

  version: number;
  createdBy?: string;
  createdDate?: string;
  published: boolean;
}
