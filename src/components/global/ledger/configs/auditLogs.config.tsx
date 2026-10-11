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
import { ShieldCheck, Lock, Activity, User, ExternalLink, Copy } from "lucide-react";
import { LedgerConfig } from "../types.ts";
import { formatDateTime } from "../../../../utils/formatters.ts";

export const auditLogsConfig: LedgerConfig<any> = {
  entityName: "Audit Log",
  title: "Security & System Audit Trail",
  subtitle: "Immutable recording of operational activities, entity mutations, and user login traces",
  icon: <ShieldCheck size={20} />,
  apiEndpoint: "/audit-logs",
  idKey: "id",
  searchPlaceholder: "Search by Action, User, Entity, or Details...",
  searchFields: ["action", "username", "entity", "details", "ipAddress"],
  exportFileName: "system_audit_logs",

  filters: [
    {
      key: "action",
      label: "Action Type",
      defaultValue: "ALL",
      options: [
        { label: "All Actions", value: "ALL" },
        { label: "Create", value: "CREATE" },
        { label: "Update", value: "UPDATE" },
        { label: "Delete", value: "DELETE" },
        { label: "Login", value: "LOGIN" },
        { label: "Logout", value: "LOGOUT" },
        { label: "Print", value: "PRINT" },
        { label: "Export", value: "EXPORT" },
        { label: "Settlement (POS)", value: "SETTLEMENT" },
        { label: "Supervisor Override", value: "SUPERVISOR_OVERRIDE" },
        { label: "View / Access", value: "VIEW" },
        { label: "Transaction View", value: "TRANSACTION_VIEW" },
        { label: "Search", value: "SEARCH" },
      ],
    },
    {
      key: "entity",
      label: "Entity Type",
      defaultValue: "ALL",
      options: [
        { label: "All Entities", value: "ALL" },
        { label: "Sales Invoices", value: "sales_invoices" },
        { label: "Sales Orders", value: "sales_orders" },
        { label: "Quotations", value: "quotations" },
        { label: "Sales Returns", value: "sales_returns" },
        { label: "POS Transactions", value: "pos_transactions" },
        { label: "POS Supervisor Auth", value: "pos_supervisor_auth" },
        { label: "Customers", value: "customers" },
        { label: "Reports", value: "reports" },
        { label: "Loyalty", value: "loyalty" },
        { label: "CRM", value: "crm" },
      ],
    },
    {
      key: "from_date",
      label: "From Date",
      type: "date",
      defaultValue: "",
    },
    {
      key: "to_date",
      label: "To Date",
      type: "date",
      defaultValue: "",
    },
  ],

  responseTransform: (data: any) => {
    const list = Array.isArray(data) ? data : data?.logs || [];
    return list.map((item: any) => ({
      id: item.id || `audit-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: item.timestamp || item.created_at,
      action: item.action || "INFO",
      username: item.username || item.user_id || "System",
      entity: item.entity || item.resource || "General",
      entityId: item.entityId || item.entity_id || "—",
      details: item.details || item.message || "—",
      ipAddress: item.ipAddress || item.ip_address || "127.0.0.1",
    }));
  },

  columns: [
    {
      key: "timestamp",
      label: "Timestamp",
      width: "160px",
      render: (val) => (
        <span className="text-theme-muted font-mono text-[11px]">
          {val ? formatDateTime(val) : "—"}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      width: "100px",
      align: "center",
      render: (val) => {
        const actionStr = String(val).toUpperCase();
        const isDestructive = actionStr === "DELETE";
        const isCreation = actionStr === "CREATE" || actionStr === "LOGIN";
        const isSettle = actionStr === "SETTLEMENT";
        const isOverride = actionStr === "SUPERVISOR_OVERRIDE";
        const isAuth = actionStr === "LOGOUT" || actionStr === "VIEW";
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
              isDestructive
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : isSettle
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isOverride
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : isCreation
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : isAuth
                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                : "bg-theme-surface-3 text-theme-muted border-theme-divider"
            }`}
          >
            {actionStr}
          </span>
        );
      },
    },
    {
      key: "username",
      label: "User",
      width: "140px",
      render: (val) => (
        <div className="flex items-center gap-1.5 font-mono">
          <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-[10px] shrink-0">
            <User size={10} />
          </div>
          <span className="text-theme-primary text-xs">{val}</span>
        </div>
      ),
    },
    {
      key: "entity",
      label: "Target Entity",
      width: "140px",
      render: (val, row) => {
        // REC-06: entity module URL routing map for drill-down navigation hint
        const entityUrlMap: Record<string, string> = {
          sales_invoices: "/sales?tab=invoices",
          sales_orders: "/sales?tab=orders",
          quotations: "/sales?tab=quotations",
          sales_returns: "/sales?tab=returns",
          pos_transactions: "/billing",
          pos_supervisor_auth: "/billing",
          customers: "/sales?tab=customers",
          reports: "/reports",
          crm: "/crm",
        };
        const href = val ? entityUrlMap[String(val)] : null;
        const handleCopy = () => {
          if (row.entityId && row.entityId !== "—") {
            navigator.clipboard.writeText(String(row.entityId)).catch(() => {});
          }
        };
        return (
          <div className="font-mono text-[11px] space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-blue-400 font-bold">{val}</span>
              {href && (
                <a
                  href={href}
                  title={`Open ${val} module`}
                  className="text-theme-muted hover:text-blue-400 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
            {row.entityId && row.entityId !== "—" && (
              <button
                type="button"
                title="Copy entity ID"
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="flex items-center gap-1 text-[10px] text-theme-muted hover:text-theme-primary group transition-colors"
              >
                <span className="font-mono truncate max-w-[100px]">{row.entityId}</span>
                <Copy size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "details",
      label: "Activity Details",
      render: (val) => <span className="text-theme-primary font-sans text-xs">{val}</span>,
    },
    {
      key: "ipAddress",
      label: "IP / Source",
      width: "120px",
      align: "right",
      render: (val) => <span className="text-theme-muted font-mono text-[11px]">{val}</span>,
    },
  ],
};

