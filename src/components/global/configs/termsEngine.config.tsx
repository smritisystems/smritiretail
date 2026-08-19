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
import { Gavel, FileText, BookOpen, ShieldCheck } from "lucide-react";
import { MasterConfig } from "../master/types.ts";

export interface Clause {
  id: string;
  code: string;
  title: string;
  category: string;
  content: string;
  isActive: boolean;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Archived";
  language: string;
}

export const termsEngineConfig: MasterConfig<Clause> = {
  entityName: "Terms Clause",
  entityNamePlural: "Terms Clauses",
  title: "Commercial & Statutory Terms Engine",
  subtitle: "Manage standard payment terms, delivery clauses, warranty conditions, and legal fine print",
  icon: <Gavel size={20} />,
  apiEndpoint: "/api/v1/terms/",
  idKey: "id",
  searchPlaceholder: "Search by clause title, code, or category...",
  searchFields: ["title", "code", "category", "content"],

  columns: [
    {
      key: "title",
      label: "Clause Title",
      width: "240px",
      sortable: true,
      render: (val, item) => (
        <div>
          <div className="font-bold text-theme-primary">{val}</div>
          <div className="text-[10px] text-theme-muted font-mono">{item.code || "STD-CLAUSE"} • v{item.version || 1}</div>
        </div>
      )
    },
    {
      key: "category",
      label: "Category",
      width: "140px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || "General"}
        </span>
      )
    },
    {
      key: "content",
      label: "Clause Preview",
      render: (val) => (
        <div className="text-xs text-theme-muted truncate max-w-md">
          {val || "No clause text defined."}
        </div>
      )
    },
    {
      key: "language",
      label: "Language",
      width: "90px",
      render: (val) => (
        <span className="font-mono text-[10px] uppercase text-theme-muted">
          {val || "en"}
        </span>
      )
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
      renderStatus: true
    }
  ],

  fields: [
    {
      name: "title",
      label: "Clause Title",
      type: "text",
      required: true,
      placeholder: "e.g. Standard Payment Due in 30 Days",
      colSpan: 1
    },
    {
      name: "code",
      label: "Clause Reference Code",
      type: "text",
      placeholder: "e.g. CL-PAY-30D",
      colSpan: 1
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: [
        { label: "Payment Terms", value: "Payment" },
        { label: "Delivery & Shipping", value: "Delivery" },
        { label: "Warranty & Returns", value: "Warranty" },
        { label: "Statutory & Tax Disclaimers", value: "Statutory" },
        { label: "General", value: "General" }
      ],
      defaultValue: "Payment",
      colSpan: 1
    },
    {
      name: "language",
      label: "Language Code",
      type: "select",
      options: [
        { label: "English (en)", value: "en" },
        { label: "Hindi (hi)", value: "hi" },
        { label: "Marathi (mr)", value: "mr" },
        { label: "Gujarati (gu)", value: "gu" }
      ],
      defaultValue: "en",
      colSpan: 1
    },
    {
      name: "status",
      label: "Approval Status",
      type: "select",
      options: [
        { label: "Approved", value: "Approved" },
        { label: "Draft", value: "Draft" },
        { label: "Pending Approval", value: "Pending Approval" },
        { label: "Archived", value: "Archived" }
      ],
      defaultValue: "Approved",
      colSpan: 1
    },
    {
      name: "content",
      label: "Clause Full Legal Body",
      type: "textarea",
      required: true,
      placeholder: "Enter the complete statutory or commercial clause text...",
      colSpan: 2
    }
  ],

  filters: [
    {
      id: "category_filter",
      label: "Category",
      field: "category",
      type: "select",
      options: [
        { label: "Payment", value: "Payment" },
        { label: "Delivery", value: "Delivery" },
        { label: "Warranty", value: "Warranty" },
        { label: "Statutory", value: "Statutory" }
      ]
    },
    {
      id: "status_filter",
      label: "Status",
      field: "status",
      type: "select",
      options: [
        { label: "Approved", value: "Approved" },
        { label: "Draft", value: "Draft" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_clauses",
      label: "Total Clauses",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "approved_clauses",
      label: "Approved & Live",
      compute: (items) => items.filter((c) => c.status === "Approved").length,
      color: "emerald"
    }
  ]
};
