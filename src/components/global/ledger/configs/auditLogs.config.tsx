/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { ShieldCheck, Lock, Activity, User } from "lucide-react";
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
      label: "Action",
      defaultValue: "ALL",
      options: [
        { label: "All Actions", value: "ALL" },
        { label: "Create", value: "CREATE" },
        { label: "Update", value: "UPDATE" },
        { label: "Delete", value: "DELETE" },
        { label: "Login", value: "LOGIN" },
        { label: "Print", value: "PRINT" },
      ],
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
      entityId: item.entityId || item.entity_id || "â€”",
      details: item.details || item.message || "â€”",
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
          {val ? formatDateTime(val) : "â€”"}
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
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
              isDestructive
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : isCreation
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
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
      render: (val, row) => (
        <div className="font-mono text-[11px]">
          <span className="text-blue-400 font-bold">{val}</span>
          {row.entityId && row.entityId !== "â€”" && (
            <div className="text-[10px] text-theme-muted">{row.entityId}</div>
          )}
        </div>
      ),
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

