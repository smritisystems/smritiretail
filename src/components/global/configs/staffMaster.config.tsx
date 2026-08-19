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
import { UserCheck, ShieldCheck, MapPin, Briefcase, Key } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { User } from "../../../types.ts";

export const staffMasterConfig: MasterConfig<User> = {
  entityName: "Staff Member",
  entityNamePlural: "Staff Members",
  title: "Staff & User Access Management",
  subtitle: "Manage operator accounts, security credentials, RBAC roles, and branch assignments",
  icon: <UserCheck size={20} />,
  apiEndpoint: "/api/v1/users/",
  idKey: "id",
  responseTransform: (data) => data?.users || (Array.isArray(data) ? data : []),
  searchPlaceholder: "Search by full name, username, designation, or role...",
  searchFields: ["fullName", "username", "role", "designation", "department"],

  payloadTransform: (formData, mode, editingItem) => {
    return {
      username: formData.username,
      fullName: formData.fullName || formData.username,
      role: formData.role,
      status: formData.status || "Active",
      designation: formData.designation || undefined,
      department: formData.department || undefined,
      branch: formData.branch || undefined,
      fixedMonthly: formData.fixedMonthly ? Number(formData.fixedMonthly) : undefined,
      ...(formData.password ? { passwordHash: formData.password } : {})
    };
  },

  columns: [
    {
      key: "fullName",
      label: "Staff Name",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
            {String(val || item.username || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val || item.username}</div>
            <div className="text-[10px] text-theme-muted font-mono">@{item.username}</div>
          </div>
        </div>
      )
    },
    {
      key: "role",
      label: "System Role",
      width: "150px",
      sortable: true,
      render: (val) => {
        const r = String(val || "").toUpperCase();
        const isSysAdmin = r.includes("SYSADMIN") || r.includes("ADMIN");
        const isManager = r.includes("MANAGER");

        return (
          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
            isSysAdmin ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
            isManager ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}>
            <ShieldCheck size={11} />
            <span>{String(val || "Cashier")}</span>
          </span>
        );
      }
    },
    {
      key: "designation",
      label: "Designation / Dept",
      width: "180px",
      render: (val, item) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-theme-primary">{val || item.role || "Operator"}</div>
          {item.department && (
            <div className="text-[10px] text-theme-muted flex items-center space-x-1">
              <Briefcase size={10} />
              <span>{item.department}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "branch",
      label: "Assigned Branch",
      width: "180px",
      render: (val) => (
        <div className="flex items-center space-x-1 text-theme-muted text-xs">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{val || "All Branches (Global)"}</span>
        </div>
      )
    },
    {
      key: "status",
      label: "Account Status",
      width: "110px",
      renderStatus: true
    }
  ],

  fields: [
    {
      name: "fullName",
      label: "Full Name",
      type: "text",
      required: true,
      placeholder: "e.g. Ramesh Kumar",
      colSpan: 1
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "Unique login username",
      colSpan: 1
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      placeholder: "Set or update password",
      colSpan: 1
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: [
        { label: "SYSADMIN", value: "SYSADMIN" },
        { label: "ADMIN", value: "ADMIN" },
        { label: "MANAGER", value: "MANAGER" },
        { label: "CASHIER", value: "CASHIER" },
        { label: "SALES_EXECUTIVE", value: "SALES_EXECUTIVE" }
      ],
      defaultValue: "CASHIER",
      colSpan: 1
    },
    {
      name: "designation",
      label: "Designation",
      type: "text",
      placeholder: "e.g. Senior Floor Manager",
      colSpan: 1
    },
    {
      name: "department",
      label: "Department",
      type: "text",
      placeholder: "e.g. Retail Sales",
      colSpan: 1
    },
    {
      name: "status",
      label: "Account Status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Suspended", value: "Suspended" }
      ],
      defaultValue: "Active",
      colSpan: 1
    },
    {
      name: "fixedMonthly",
      label: "Fixed Monthly Salary",
      type: "number",
      defaultValue: 25000,
      colSpan: 1
    }
  ],

  filters: [
    {
      id: "role_filter",
      label: "Role",
      field: "role",
      type: "select",
      options: [
        { label: "SYSADMIN", value: "SYSADMIN" },
        { label: "ADMIN", value: "ADMIN" },
        { label: "MANAGER", value: "MANAGER" },
        { label: "CASHIER", value: "CASHIER" },
        { label: "SALES_EXECUTIVE", value: "SALES_EXECUTIVE" }
      ]
    },
    {
      id: "status_filter",
      label: "Status",
      field: "status",
      type: "select",
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Suspended", value: "Suspended" }
      ]
    }
  ],

  kpis: [
    {
      id: "total_staff",
      label: "Total Staff",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_staff",
      label: "Active Accounts",
      compute: (items) => items.filter((u) => (u.status || "Active").toLowerCase() === "active").length,
      color: "emerald"
    },
    {
      id: "managers",
      label: "Managers / Admins",
      compute: (items) => items.filter((u) => ["SYSADMIN", "ADMIN", "MANAGER"].includes(String(u.role).toUpperCase())).length,
      color: "purple"
    }
  ]
};
