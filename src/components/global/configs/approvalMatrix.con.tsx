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
import { ShieldCheck, FileCheck, Layers, Users, CheckCircle2, XCircle } from "lucide-react";
import { MasterConfig } from "../master/types.ts";

export interface ApprovalCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface ApprovalLevel {
  id: string;
  level: number;
  approverType: "role" | "user" | "manager";
  approverValue: string;
}

export interface ApprovalMatrix {
  id: string;
  name: string;
  documentType: string;
  active: boolean;
  conditions?: ApprovalCondition[];
  levels?: ApprovalLevel[];
  conditionSummary?: string;
  approverSummary?: string;
}

const DEFAULT_MATRICES: ApprovalMatrix[] = [
  {
    id: "AM-001",
    name: "High Value Purchase Orders",
    documentType: "Purchase Order",
    active: true,
    conditionSummary: "Total Amount > ₹50,000",
    approverSummary: "Level 1: Procurement Manager → Level 2: Finance Director",
    conditions: [
      { id: "c1", field: "Total Amount", operator: ">", value: "50000" }
    ],
    levels: [
      { id: "l1", level: 1, approverType: "role", approverValue: "Procurement Manager" },
      { id: "l2", level: 2, approverType: "role", approverValue: "Finance Director" }
    ]
  },
  {
    id: "AM-002",
    name: "High Discount Sales Approval",
    documentType: "Sales Invoice",
    active: true,
    conditionSummary: "Discount % > 15%",
    approverSummary: "Level 1: Reporting Manager → Level 2: Regional Head",
    conditions: [
      { id: "c2", field: "Discount %", operator: ">", value: "15" }
    ],
    levels: [
      { id: "l3", level: 1, approverType: "manager", approverValue: "Reporting Manager" },
      { id: "l4", level: 2, approverType: "role", approverValue: "Regional Head" }
    ]
  },
  {
    id: "AM-003",
    name: "Negative Margin & Credit Hold Clearance",
    documentType: "Sales Order",
    active: true,
    conditionSummary: "Margin % < 5% OR Credit Hold == True",
    approverSummary: "Level 1: Commercial Finance Admin",
    conditions: [
      { id: "c3", field: "Margin %", operator: "<", value: "5" }
    ],
    levels: [
      { id: "l5", level: 1, approverType: "role", approverValue: "Commercial Finance Admin" }
    ]
  }
];

export const approvalMatrixConfig: MasterConfig<ApprovalMatrix> = {
  entityName: "Approval Rule",
  entityNamePlural: "Approval Rules",
  title: "Multi-Tier Approval Matrix Engine",
  subtitle: "Configure hierarchical validation criteria, amount thresholds, and multi-level signing authorities",
  icon: <ShieldCheck size={20} />,
  apiEndpoint: "/api/v1/approval-matrix",
  idKey: "id",
  responseTransform: (data) => Array.isArray(data) && data.length > 0 ? data : DEFAULT_MATRICES,
  searchPlaceholder: "Search by matrix name, document type, or approver role...",
  searchFields: ["name", "documentType", "conditionSummary", "approverSummary"],

  payloadTransform: (formData, mode, editingItem) => {
    const payload: ApprovalMatrix = {
      id: editingItem?.id || `AM-${Date.now().toString(36).toUpperCase()}`,
      name: formData.name,
      documentType: formData.documentType,
      active: formData.active !== false,
      conditionSummary: `${formData.conditionField || "Amount"} ${formData.conditionOperator || ">"} ${formData.conditionValue || "0"}`,
      approverSummary: `Level 1: ${formData.approverRole || "MANAGER"}`,
      conditions: [
        {
          id: "c1",
          field: formData.conditionField || "Total Amount",
          operator: formData.conditionOperator || ">",
          value: String(formData.conditionValue || "0")
        }
      ],
      levels: [
        {
          id: "l1",
          level: 1,
          approverType: "role",
          approverValue: formData.approverRole || "MANAGER"
        }
      ]
    };
    return payload;
  },

  columns: [
    {
      key: "name",
      label: "Rule Name / Details",
      width: "240px",
      sortable: true,
      render: (val, item) => (
        <div>
          <div className="font-bold text-theme-primary">{val}</div>
          <div className="text-[10px] text-theme-muted font-mono">{item.documentType} • {item.id}</div>
        </div>
      )
    },
    {
      key: "documentType",
      label: "Document Type",
      width: "150px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {val}
        </span>
      )
    },
    {
      key: "conditionSummary",
      label: "Threshold / Criteria",
      width: "220px",
      render: (val, item) => {
        const text = val || (item.conditions && item.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(", ")) || "Standard Criteria";
        return (
          <span className="font-mono text-xs text-amber-400">
            {text}
          </span>
        );
      }
    },
    {
      key: "approverSummary",
      label: "Approver Hierarchy",
      render: (val, item) => {
        const text = val || (item.levels && item.levels.map(l => `L${l.level}: ${l.approverValue}`).join(" → ")) || "Default Manager";
        return (
          <div className="flex items-center space-x-1 text-xs text-theme-muted">
            <Users size={12} className="shrink-0 text-blue-400" />
            <span className="truncate">{text}</span>
          </div>
        );
      }
    },
    {
      key: "active",
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
      label: "Rule Name",
      type: "text",
      required: true,
      placeholder: "e.g. High Value Purchase Order Approval",
      colSpan: 1
    },
    {
      name: "documentType",
      label: "Governed Document Type",
      type: "select",
      required: true,
      options: [
        { label: "Purchase Order", value: "Purchase Order" },
        { label: "Sales Invoice", value: "Sales Invoice" },
        { label: "Sales Quotation", value: "Quotation" },
        { label: "Sales Order", value: "Sales Order" },
        { label: "Goods Receipt (GRN)", value: "Goods Receipt" },
        { label: "Sales Return / Credit Note", value: "Sales Return" }
      ],
      defaultValue: "Purchase Order",
      colSpan: 1
    },
    {
      name: "conditionField",
      label: "Threshold Field",
      type: "select",
      options: [
        { label: "Total Amount", value: "Total Amount" },
        { label: "Discount Percentage (%)", value: "Discount %" },
        { label: "Gross Margin (%)", value: "Gross Margin %" },
        { label: "Credit Limit Exceeded", value: "Credit Limit" }
      ],
      defaultValue: "Total Amount",
      colSpan: 1
    },
    {
      name: "conditionOperator",
      label: "Operator",
      type: "select",
      options: [
        { label: "Greater Than (>)", value: ">" },
        { label: "Greater Than or Equal (>=)", value: ">=" },
        { label: "Equal To (==)", value: "==" },
        { label: "Less Than (<)", value: "<" }
      ],
      defaultValue: ">",
      colSpan: 1
    },
    {
      name: "conditionValue",
      label: "Threshold Value",
      type: "text",
      required: true,
      placeholder: "e.g. 50000",
      defaultValue: "50000",
      colSpan: 1
    },
    {
      name: "approverRole",
      label: "Approver Authority Role",
      type: "select",
      options: [
        { label: "SYSADMIN (Global)", value: "SYSADMIN" },
        { label: "ADMIN (Store Admin)", value: "ADMIN" },
        { label: "MANAGER (Branch Manager)", value: "MANAGER" },
        { label: "Procurement Manager", value: "Procurement Manager" },
        { label: "Finance Director", value: "Finance Director" }
      ],
      defaultValue: "MANAGER",
      colSpan: 1
    },
    {
      name: "active",
      label: "Enable Approval Rule",
      type: "toggle",
      defaultValue: true,
      colSpan: 1
    }
  ],

  filters: [
    {
      id: "doctype_filter",
      label: "Document Type",
      field: "documentType",
      type: "select",
      options: [
        { label: "Purchase Order", value: "Purchase Order" },
        { label: "Sales Invoice", value: "Sales Invoice" },
        { label: "Quotation", value: "Quotation" },
        { label: "Sales Order", value: "Sales Order" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_rules",
      label: "Active Matrices",
      compute: (items) => items.filter(m => m.active !== false).length,
      color: "emerald"
    },
    {
      id: "po_rules",
      label: "Procurement Rules",
      compute: (items) => items.filter(m => m.documentType === "Purchase Order").length,
      color: "blue"
    },
    {
      id: "sales_rules",
      label: "Sales & Billing Rules",
      compute: (items) => items.filter(m => m.documentType.includes("Sales")).length,
      color: "purple"
    }
  ]
};
