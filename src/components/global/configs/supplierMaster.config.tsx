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
import { Store, Phone, Mail, Building2, MapPin } from "lucide-react";
import { MasterConfig } from "../master/types.ts";

export const supplierMasterConfig: MasterConfig = {
  entityName: "Supplier",
  entityNamePlural: "Suppliers",
  title: "Supplier & Vendor Directory",
  subtitle: "Manage procurement vendors, GST profiles, credit terms, and payables ledger",
  icon: <Store size={20} />,
  apiEndpoint: "/api/v1/purchase/suppliers/",
  idKey: "id",
  searchPlaceholder: "Search by vendor name, code, contact, GSTIN, or city...",
  searchFields: ["name", "code", "gst_number", "mobile", "email", "city", "state"],

  payloadTransform: (formData, mode, editingItem) => {
    const payload = { ...formData };
    if (mode === "create" && !payload.id) {
      payload.id = `sup-${Date.now().toString(36)}`;
    }
    if (mode === "create" && !payload.code) {
      payload.code = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return payload;
  },

  columns: [
    {
      key: "name",
      label: "Vendor Name",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0">
            {String(val || "S").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val || "Unnamed Vendor"}</div>
            {item.code && <div className="text-[10px] text-theme-muted font-mono">{item.code}</div>}
          </div>
        </div>
      )
    },
    {
      key: "gst_number",
      label: "GSTIN",
      width: "150px",
      render: (val) => val ? (
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val}
        </span>
      ) : (
        <span className="text-theme-muted text-[11px]">Unregistered</span>
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
          {item.email && (
            <div className="flex items-center space-x-1 text-theme-muted text-[10px] truncate max-w-[140px]">
              <Mail size={10} className="shrink-0" />
              <span className="truncate">{item.email}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "city",
      label: "Location",
      width: "140px",
      render: (val, item) => (
        <div className="flex items-center space-x-1 text-theme-muted text-xs">
          <MapPin size={11} className="shrink-0" />
          <span>{val ? `${val}${item.state ? `, ${item.state}` : ""}` : "Not specified"}</span>
        </div>
      )
    },
    {
      key: "outstanding",
      label: "Payables (₹)",
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
    }
  ],

  fields: [
    {
      name: "name",
      label: "Vendor Name",
      type: "text",
      required: true,
      placeholder: "e.g. Reliance Retail Logistics / Raymond Fabrics",
      colSpan: 1
    },
    {
      name: "code",
      label: "Vendor Code",
      type: "text",
      placeholder: "Auto-generated if blank",
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
      name: "mobile",
      label: "Contact Mobile",
      type: "text",
      placeholder: "10-digit mobile number",
      colSpan: 1
    },
    {
      name: "email",
      label: "Email Address",
      type: "email",
      placeholder: "accounts@vendor.com",
      colSpan: 1
    },
    {
      name: "city",
      label: "City",
      type: "text",
      placeholder: "e.g. Mumbai",
      colSpan: 1
    },
    {
      name: "state",
      label: "State",
      type: "text",
      placeholder: "e.g. Maharashtra",
      colSpan: 1
    },
    {
      name: "pincode",
      label: "Pincode",
      type: "text",
      placeholder: "e.g. 400053",
      colSpan: 1
    },
    {
      name: "address",
      label: "Full Registered Address",
      type: "textarea",
      placeholder: "Building, Street, Landmark...",
      colSpan: 2
    }
  ],

  kpis: [
    {
      id: "total_suppliers",
      label: "Active Vendors",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "total_payables",
      label: "Total Payables",
      compute: (items) => {
        const sum = items.reduce((acc, s) => acc + (Number(s.outstanding) || 0), 0);
        return `₹ ${sum.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
      },
      color: "rose"
    }
  ]
};
