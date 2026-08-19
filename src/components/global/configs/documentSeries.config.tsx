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
import { FileDigit, Hash, ShieldCheck } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { DocumentSeries, NumberingEngine } from "../../../services/numberingEngine.ts";

export const documentSeriesConfig: MasterConfig<DocumentSeries> = {
  entityName: "Document Series",
  entityNamePlural: "Document Series",
  title: "Document Series & Numbering Studio",
  subtitle: "Configure automated sequential numbering rules, branch-specific prefixes, and fiscal year resets",
  icon: <FileDigit size={20} />,
  apiEndpoint: "/api/v1/system/document-series",
  idKey: "id",
  responseTransform: (data) => Array.isArray(data) ? data : NumberingEngine.getAllSeries(),
  searchPlaceholder: "Search by series name, document type, or prefix pattern...",
  searchFields: ["name", "documentType", "prefix", "suffix", "module"],

  columns: [
    {
      key: "name",
      label: "Series Name",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div>
          <div className="font-bold text-theme-primary">{val}</div>
          <div className="text-[10px] text-theme-muted font-mono">{item.documentType} • {item.module}</div>
        </div>
      )
    },
    {
      key: "prefix",
      label: "Prefix Pattern",
      width: "200px",
      render: (val, item) => (
        <div className="font-mono text-xs font-bold text-blue-400">
          {val || "—"}<span className="text-emerald-400 font-normal">{"0".repeat(item.runningLength || 6)}</span>{item.suffix || ""}
        </div>
      )
    },
    {
      key: "currentNumber",
      label: "Current Sequence",
      width: "140px",
      align: "right",
      sortable: true,
      render: (val) => (
        <span className="font-mono font-bold text-xs text-theme-primary">
          {Number(val || 0).toLocaleString("en-IN")}
        </span>
      )
    },
    {
      key: "resetRule",
      label: "Reset Cycle",
      width: "140px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || "Financial Year"}
        </span>
      )
    },
    {
      key: "isActive",
      label: "Status",
      width: "100px",
      render: (val) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
          val ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>
          {val ? "Active" : "Inactive"}
        </span>
      )
    }
  ],

  fields: [
    {
      name: "name",
      label: "Series Name",
      type: "text",
      required: true,
      placeholder: "e.g. Retail Tax Invoice Series",
      colSpan: 1
    },
    {
      name: "documentType",
      label: "Document Type",
      type: "select",
      required: true,
      options: [
        { label: "Retail Invoice", value: "Retail Invoice" },
        { label: "Tax Invoice (B2B)", value: "Tax Invoice" },
        { label: "Sales Order", value: "Sales Order" },
        { label: "Quotation", value: "Quotation" },
        { label: "Purchase Order", value: "Purchase Order" },
        { label: "Goods Receipt (GRN)", value: "Goods Receipt" },
        { label: "Sales Return / Credit Note", value: "Sales Return" },
        { label: "Debit Note", value: "Debit Note" }
      ],
      defaultValue: "Retail Invoice",
      colSpan: 1
    },
    {
      name: "prefix",
      label: "Prefix Format",
      type: "text",
      required: true,
      placeholder: "e.g. INV/{FY}/{Branch}/",
      defaultValue: "INV/{FY}/",
      colSpan: 1
    },
    {
      name: "suffix",
      label: "Suffix Format",
      type: "text",
      placeholder: "Optional suffix",
      colSpan: 1
    },
    {
      name: "currentNumber",
      label: "Initial / Starting Counter",
      type: "number",
      defaultValue: 0,
      colSpan: 1
    },
    {
      name: "runningLength",
      label: "Padding Digit Length",
      type: "number",
      defaultValue: 6,
      min: 2,
      max: 10,
      colSpan: 1
    },
    {
      name: "resetRule",
      label: "Sequence Reset Frequency",
      type: "select",
      options: [
        { label: "Financial Year (1-Apr)", value: "Financial Year" },
        { label: "Calendar Year (1-Jan)", value: "Calendar Year" },
        { label: "Monthly", value: "Monthly" },
        { label: "Never (Continuous)", value: "Never" }
      ],
      defaultValue: "Financial Year",
      colSpan: 1
    },
    {
      name: "isActive",
      label: "Active Series",
      type: "toggle",
      defaultValue: true,
      colSpan: 1
    }
  ],

  kpis: [
    {
      id: "total_series",
      label: "Configured Series",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_series",
      label: "Active Numbering Series",
      compute: (items) => items.filter((s) => s.isActive !== false).length,
      color: "emerald"
    }
  ]
};
