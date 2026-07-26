/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Version      : 5.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * WNG-002: List Report Pattern — System Audit Trail
 */

import React, { useState, useEffect } from "react";
import { AuditLogEntry } from "../types.js";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { FioriListReport, ListReportColumn } from "./common/FioriListReport.tsx";

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const cls =
    action === "CREATE"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : action === "DELETE"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : action === "UPDATE"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : "bg-slate-500/10 text-slate-400 border-slate-500/30";
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${cls}`}>
      {action}
    </span>
  );
};

const COLUMNS: ListReportColumn<AuditLogEntry>[] = [
  {
    key: "timestamp",
    label: "Timestamp",
    render: (row) => (
      <span className="text-slate-300 font-mono text-xs">
        {new Date(row.timestamp).toLocaleString()}
      </span>
    ),
  },
  {
    key: "userName",
    label: "Operator",
    render: (row) => (
      <div>
        <span className="font-semibold text-slate-100 text-xs">{row.userName}</span>
        {row.userId && <div className="text-[10px] text-slate-500 font-mono">{row.userId}</div>}
      </div>
    ),
  },
  {
    key: "module",
    label: "Module Segment",
    render: (row) => (
      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
        {row.module}
      </span>
    ),
  },
  {
    key: "action",
    label: "Action Type",
    align: "center",
    render: (row) => <ActionBadge action={row.action} />,
  },
  {
    key: "targetName",
    label: "Target Entity",
    render: (row) => (
      <div>
        <span className="text-slate-200 text-xs">{row.targetName}</span>
        {row.targetId && (
          <span className="text-[10px] text-slate-500 font-mono block">({row.targetId})</span>
        )}
      </div>
    ),
  },
  {
    key: "newValue",
    label: "Audit Trail Details",
    render: (row) => (
      <div className="text-xs">
        {row.oldValue && row.newValue && (
          <div className="flex flex-col space-y-0.5">
            <span className="line-through text-rose-400/80 font-mono text-[10px]">{row.oldValue}</span>
            <span className="text-emerald-400 font-mono text-[10px]">{row.newValue}</span>
          </div>
        )}
        {!row.oldValue && row.newValue && (
          <span className="text-slate-300">{row.newValue}</span>
        )}
        {!row.oldValue && !row.newValue && <span className="text-slate-600">—</span>}
      </div>
    ),
  },
];

export const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = () => {
    setLoading(true);
    apiFetchV1("/audit-logs")
      .then((data) => {
        const logsData = Array.isArray(data) ? data : data?.logs || [];
        setLogs(
          logsData.sort(
            (a: AuditLogEntry, b: AuditLogEntry) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load audit logs:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      <div className="flex-1 overflow-hidden">
        <FioriListReport<AuditLogEntry>
          title="System Audit Logs"
          subtitle="Global security, authentication, modification, and transaction audit trail"
          data={logs}
          columns={COLUMNS}
          isLoading={loading}
          onRefresh={fetchAuditLogs}
          searchPlaceholder="Search audit log by operator, module, action, or target..."
          filterOptions={[
            {
              key: "action",
              label: "Action",
              options: [
                { label: "CREATE", value: "CREATE" },
                { label: "UPDATE", value: "UPDATE" },
                { label: "DELETE", value: "DELETE" },
                { label: "SEARCH", value: "SEARCH" },
                { label: "FILTER", value: "FILTER" },
                { label: "TRANSACTION_VIEW", value: "TRANSACTION_VIEW" },
              ],
            },
          ]}
        />
      </div>
    </div>
  );
};
