/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";

export interface LedgerColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (val: any, record: T, index: number) => React.ReactNode;
}

export interface LedgerFilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
}

export interface LedgerConfig<T> {
  entityName: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  apiEndpoint: string;
  idKey?: string;
  searchPlaceholder?: string;
  searchFields?: (keyof T | string)[];
  columns: LedgerColumn<T>[];
  filters?: LedgerFilterOption[];
  responseTransform?: (data: any) => T[];
  exportFileName?: string;
}
