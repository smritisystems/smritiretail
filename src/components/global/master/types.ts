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

import React from "react";

export type FieldType = 
  | "text" 
  | "email" 
  | "password" 
  | "number" 
  | "select" 
  | "textarea" 
  | "toggle" 
  | "date"
  | "tags"
  | "custom";

export interface SelectOption {
  label: string;
  value: string | number;
  badgeColor?: string;
}

export interface MasterColumnDef<T = any> {
  key: string;
  label: string;
  width?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  renderStatus?: boolean;
  renderBadge?: (value: any) => { label: string; color: string };
}

export interface MasterFormFieldDef<T = any> {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[] | SelectOption[];
  optionsEndpoint?: string; // e.g. "/api/v1/customer-groups"
  transformOptions?: (data: any) => SelectOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number;
  colSpan?: 1 | 2;
  section?: string;
  description?: string;
  disabled?: boolean | ((formState: any, isEdit?: boolean) => boolean);
  showWhen?: (formState: any) => boolean;
  validate?: (value: any, formState: any) => string | null;
  renderCustom?: (formState: any, onChange: (val: any) => void) => React.ReactNode;
}

export interface MasterFilterDef<T = any> {
  id: string;
  label: string;
  field: string;
  type: "select" | "toggle";
  options: { label: string; value: any }[];
  defaultValue?: any;
  customFilter?: (item: T, selectedValue: any) => boolean;
}

export interface MasterKpiDef<T = any> {
  id: string;
  label: string;
  compute: (items: T[]) => string | number;
  color?: "blue" | "emerald" | "amber" | "rose" | "indigo" | "purple";
  icon?: string;
}

export interface MasterSubTabDef<T = any> {
  id: string;
  label: string;
  icon?: string;
  renderContent?: (items: T[], refetch: () => void) => React.ReactNode;
}

export interface MasterCustomActionDef<T = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onClick: (item: T, refetch: () => void) => void;
  showWhen?: (item: T) => boolean;
}

export interface MasterConfig<T = any> {
  entityName: string; // e.g. "Customer", "Supplier", "Staff"
  entityNamePlural?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  apiEndpoint: string; // e.g. "/api/v1/customers"
  idKey?: string; // defaults to "id"
  responseTransform?: (data: any) => T[];
  payloadTransform?: (formData: any, mode: "create" | "update", editingItem?: T) => any;
  searchPlaceholder?: string;
  searchFields?: string[];
  columns: MasterColumnDef<T>[];
  fields: MasterFormFieldDef<T>[];
  filters?: MasterFilterDef<T>[];
  kpis?: MasterKpiDef<T>[];
  subTabs?: MasterSubTabDef<T>[];
  customActions?: MasterCustomActionDef<T>[];
  permissions?: {
    createRole?: string[];
    editRole?: string[];
    deleteRole?: string[];
  };
  defaultSort?: {
    key: string;
    direction: "asc" | "desc";
  };
  serverPagination?: boolean;
  pageSize?: number;
  slots?: {
    extraColumns?: (item: T) => React.ReactNode;
    extraFields?: (formState: any, setFormField: (name: string, val: any) => void) => React.ReactNode;
    extraHeaderActions?: (refetch: () => void, items: T[]) => React.ReactNode;
    detailDrawer?: (item: T, onClose: () => void, refetch: () => void) => React.ReactNode;
  };
  customValidation?: (formData: any, existingItems: T[]) => Promise<{ valid: boolean; errors: string[] }> | { valid: boolean; errors: string[] };
}
