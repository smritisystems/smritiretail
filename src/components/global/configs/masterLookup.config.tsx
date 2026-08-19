/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Database, Layers, Tag, CheckCircle2, Sliders } from "lucide-react";
import { MasterConfig } from "../master/types.ts";

export interface MasterLookupItem {
  id: string;
  code: string;
  name: string;
  type_code?: string;
  type?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  is_system?: boolean;
  sequence_order?: number;
}

export const masterLookupConfig: MasterConfig<MasterLookupItem> = {
  entityName: "Lookup Value",
  entityNamePlural: "Lookup Values",
  title: "System Lookups & Core Master Directory",
  subtitle: "Manage organizational structures, finance codes, bank accounts, payment modes, and core lookup types",
  icon: <Database size={20} />,
  apiEndpoint: "/api/v1/masters/lookup/department/values",
  idKey: "id",
  searchPlaceholder: "Search by value name, code, category, or type...",
  searchFields: ["name", "code", "type_code", "category", "description"],

  columns: [
    {
      key: "name",
      label: "Lookup Value / Title",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
            <Tag size={13} />
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val || "Unnamed"}</div>
            <div className="text-[10px] text-theme-muted font-mono">{item.code || item.id}</div>
          </div>
        </div>
      )
    },
    {
      key: "type_code",
      label: "Lookup Type",
      width: "150px",
      render: (val, item) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || item.type || "General"}
        </span>
      )
    },
    {
      key: "description",
      label: "Description / Notes",
      render: (val) => (
        <span className="text-xs text-theme-muted truncate max-w-sm">
          {val || "—"}
        </span>
      )
    },
    {
      key: "is_active",
      label: "Status",
      width: "100px",
      render: (val) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
          val !== false ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>
          {val !== false ? "Active" : "Inactive"}
        </span>
      )
    }
  ],

  fields: [
    {
      name: "name",
      label: "Lookup Value Name",
      type: "text",
      required: true,
      placeholder: "e.g. Retail Sales / UPI / HDFC Bank",
      colSpan: 1
    },
    {
      name: "code",
      label: "Lookup Code",
      type: "text",
      required: true,
      placeholder: "e.g. SALES-DEPT / UPI-PAY",
      colSpan: 1
    },
    {
      name: "type_code",
      label: "Master Lookup Type",
      type: "select",
      options: [
        { label: "Department", value: "department" },
        { label: "Designation", value: "designation" },
        { label: "Bank Account", value: "bank" },
        { label: "Payment Mode", value: "payment_mode" },
        { label: "Expense Category", value: "expense_category" },
        { label: "Currency", value: "currency" }
      ],
      defaultValue: "department",
      colSpan: 1
    },
    {
      name: "is_active",
      label: "Active Status",
      type: "toggle",
      defaultValue: true,
      colSpan: 1
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Optional description or account details...",
      colSpan: 2
    }
  ],

  filters: [
    {
      id: "type_filter",
      label: "Master Type",
      field: "type_code",
      type: "select",
      options: [
        { label: "Department", value: "department" },
        { label: "Designation", value: "designation" },
        { label: "Bank Account", value: "bank" },
        { label: "Payment Mode", value: "payment_mode" },
        { label: "Expense Category", value: "expense_category" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_lookups",
      label: "Configured Lookups",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_lookups",
      label: "Active Master Values",
      compute: (items) => items.filter((i) => i.is_active !== false).length,
      color: "emerald"
    }
  ]
};
