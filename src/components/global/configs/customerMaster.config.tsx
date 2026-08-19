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
import { Users, Phone, Mail, Building, CreditCard, Award } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { Customer } from "../../../types.ts";
import { CustomerProfile } from "../../customer/CustomerProfile.tsx";
import { CustomerLedger } from "../../customer/CustomerLedger.tsx";

export const customerMasterConfig: MasterConfig<Customer> = {
  entityName: "Customer",
  entityNamePlural: "Customers",
  title: "Customer Master Data",
  subtitle: "Manage retail & wholesale customer directory, GSTIN profiles, and credit ledgers",
  icon: <Users size={20} />,
  apiEndpoint: "/api/v1/customers",
  idKey: "id",
  searchPlaceholder: "Search by customer name, mobile, email, or GSTIN...",
  searchFields: ["name", "mobile", "email", "gst_number", "gstNumber", "code"],
  
  columns: [
    {
      key: "name",
      label: "Customer Name",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
            {String(val || "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val || "Unnamed Customer"}</div>
            {item.code && <div className="text-[10px] text-theme-muted font-mono">{item.code}</div>}
          </div>
        </div>
      )
    },
    {
      key: "mobile",
      label: "Contact",
      width: "160px",
      render: (val, item) => (
        <div className="space-y-0.5 font-mono text-[11px]">
          {val && (
            <div className="flex items-center space-x-1 text-theme-primary">
              <Phone size={11} className="text-theme-muted" />
              <span>{val}</span>
            </div>
          )}
          {(item.email) && (
            <div className="flex items-center space-x-1 text-theme-muted text-[10px] truncate max-w-[140px]">
              <Mail size={10} className="shrink-0" />
              <span className="truncate">{item.email}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "gst_number",
      label: "Tax / GSTIN",
      width: "150px",
      render: (val, item) => {
        const gst = val || (item as any).gstNumber;
        return gst ? (
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-theme-surface-2 border border-theme-divider text-theme-primary">
            {gst}
          </span>
        ) : (
          <span className="text-theme-muted text-[11px]">Unregistered</span>
        );
      }
    },
    {
      key: "customer_group_id",
      label: "Group",
      width: "130px",
      render: (val, item) => {
        const grp = val || (item as any).customerGroupId || "Retail";
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {String(grp).replace(/^CG-/, "")}
          </span>
        );
      }
    },
    {
      key: "outstanding",
      label: "Outstanding (₹)",
      width: "130px",
      align: "right",
      sortable: true,
      render: (val) => {
        const num = Number(val || 0);
        return (
          <span className={`font-mono font-bold text-[11px] ${num > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            ₹ {num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      key: "status",
      label: "Status",
      width: "100px",
      renderStatus: true
    }
  ],

  fields: [
    {
      name: "name",
      label: "Customer Name",
      type: "text",
      required: true,
      placeholder: "e.g. Acme Enterprise / Rahul Sharma",
      colSpan: 1
    },
    {
      name: "mobile",
      label: "Mobile Number",
      type: "text",
      required: true,
      placeholder: "10-digit mobile number",
      maxLength: 15,
      colSpan: 1
    },
    {
      name: "email",
      label: "Email Address",
      type: "email",
      placeholder: "customer@domain.com",
      colSpan: 1
    },
    {
      name: "gst_number",
      label: "GSTIN Number",
      type: "text",
      placeholder: "15-character GSTIN",
      maxLength: 15,
      colSpan: 1
    },
    {
      name: "pan",
      label: "PAN Number",
      type: "text",
      placeholder: "10-character PAN",
      maxLength: 10,
      colSpan: 1
    },
    {
      name: "customer_group_id",
      label: "Customer Group",
      type: "select",
      optionsEndpoint: "/api/v1/customer-groups",
      transformOptions: (data: any[]) => {
        if (!Array.isArray(data)) return [];
        return data.map((g) => ({
          label: g.name || g.id,
          value: g.id
        }));
      },
      defaultValue: "CG-Retail",
      colSpan: 1
    },
    {
      name: "status",
      label: "Account Status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Blocked", value: "Blocked" }
      ],
      defaultValue: "Active",
      colSpan: 1
    },
    {
      name: "notes",
      label: "Internal Notes",
      type: "textarea",
      placeholder: "Special preferences, delivery instructions, or credit terms...",
      colSpan: 2
    }
  ],

  filters: [
    {
      id: "status_filter",
      label: "Status",
      field: "status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Blocked", value: "Blocked" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_customers",
      label: "Total Directory",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_customers",
      label: "Active Accounts",
      compute: (items) => items.filter((c) => (c.status || "Active").toLowerCase() === "active").length,
      color: "emerald"
    },
    {
      id: "total_outstanding",
      label: "Total Receivables",
      compute: (items) => {
        const sum = items.reduce((acc, c) => acc + (Number(c.outstanding) || 0), 0);
        return `₹ ${sum.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
      },
      color: "rose"
    }
  ],

  slots: {
    detailDrawer: (item, onClose) => (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
        <div className="relative flex flex-col h-full w-full max-w-2xl bg-theme-surface-1 border-l border-theme-divider shadow-2xl overflow-hidden font-sans">
          <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
            <div>
              <h3 className="text-sm font-bold text-theme-primary font-display">{item.name}</h3>
              <p className="text-[11px] text-theme-muted font-mono">{item.mobile} • {item.gstNumber || (item as any).gst_number || "Unregistered"}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <CustomerProfile customer={item} isReadOnly={false} onClose={onClose} />
            <CustomerLedger customer={item} />
          </div>
        </div>
      </div>
    )
  }
};
