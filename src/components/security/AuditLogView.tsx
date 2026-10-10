/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — Activity / Audit Log View
 *
 * NOTE: The smriti_audit_log table is written to by backend services
 * (security.py, crm.py, etc.) via SmritiAuditLog model. A read/query
 * endpoint (/api/v1/security/audit-log) is slated for a future sprint.
 * This view attempts to fetch it and shows a structured placeholder when
 * the endpoint returns 404 / is unavailable.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, Shield, Download, Filter, Clock } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

interface AuditEntry {
  id: string;
  changedTable: string;
  changedRecordId: string;
  fieldName?: string;
  changeType: string;
  changeReason?: string;
  changeSource?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt?: string;
}

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

const CHANGE_TYPE_STYLE: Record<string, string> = {
  INSERT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE: "bg-blue-50   text-blue-700   border-blue-200",
  DELETE: "bg-rose-50   text-rose-700   border-rose-200",
  LOGIN:  "bg-purple-50 text-purple-700 border-purple-200",
};

const fmtDate = (ts?: string) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      "  " + new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return ts; }
};

export const AuditLogView: React.FC<Props> = ({ onNotification }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [endpointReady, setEndpointReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiFetchV1("/security/audit-log?limit=100");
      if (Array.isArray(res?.entries)) {
        setEntries(res.entries);
        setEndpointReady(true);
      } else if (Array.isArray(res)) {
        setEntries(res);
        setEndpointReady(true);
      } else {
        setEndpointReady(false);
      }
    } catch {
      setEndpointReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0f172a] font-display">Activity / Audit Log</h2>
          <p className="text-xs text-[#64748b] mt-0.5">Tamper-evident journal of all system events and security changes</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#cbd5e1] bg-white text-[#475569] rounded-xl hover:bg-[#f1f5f9] transition">
            <Filter size={13} /> Filter
          </button>
          <button type="button" className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[#cbd5e1] bg-white text-[#475569] rounded-xl hover:bg-[#f1f5f9] transition">
            <Download size={13} /> Export
          </button>
          <button type="button" onClick={() => void load()} aria-label="Refresh audit log"
            className="p-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition focus:outline-none">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : !endpointReady ? (
          /* Placeholder until /api/v1/security/audit-log endpoint is implemented */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-[#eff6ff] rounded-2xl flex items-center justify-center mb-4">
              <Activity size={28} className="text-[#1e40af]" />
            </div>
            <h3 className="font-bold text-sm text-[#0f172a] mb-1">Audit Log — Read API Coming Soon</h3>
            <p className="text-xs text-[#64748b] leading-relaxed max-w-sm mb-6">
              The <code className="font-mono bg-[#f1f5f9] px-1 rounded">smriti_audit_log</code> table is actively recording events.
              The read endpoint <code className="font-mono bg-[#f1f5f9] px-1 rounded">/api/v1/security/audit-log</code> will be implemented in the next sprint.
            </p>
            {/* Schema preview */}
            <div className="w-full max-w-lg bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden text-left">
              <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#e2e8f0]">
                <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#64748b]">
                  smriti_audit_log — Schema Preview
                </p>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {[
                  ["changed_table",    "VARCHAR(100)", "Target table name (e.g., smriti_permissions)"],
                  ["changed_record_id","VARCHAR(100)", "ID of the affected record"],
                  ["change_type",      "VARCHAR(50)",  "INSERT / UPDATE / DELETE / LOGIN"],
                  ["change_reason",    "TEXT",         "Human-readable reason for the change"],
                  ["changed_by_name",  "VARCHAR(100)", "Operator who made the change"],
                  ["changed_at",       "TIMESTAMPTZ",  "UTC timestamp of the event"],
                  ["sha256_hash",      "CHAR(64)",     "Tamper-evident integrity hash"],
                ].map(([col, type, desc]) => (
                  <div key={col} className="flex items-start gap-3 px-4 py-2.5 text-xs">
                    <span className="font-mono text-[#1e40af] w-36 shrink-0">{col}</span>
                    <span className="font-mono text-[#64748b] w-24 shrink-0">{type}</span>
                    <span className="text-[#94a3b8]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
            <Clock size={32} className="mb-2 text-[#cbd5e1]" />
            <div className="font-semibold text-sm text-[#64748b]">No audit entries found</div>
          </div>
        ) : (
          <div className="p-6 space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex items-start gap-3">
                <span className={"px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 " + (CHANGE_TYPE_STYLE[entry.changeType] ?? "bg-slate-50 text-slate-600 border-slate-200")}>
                  {entry.changeType}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#0f172a]">{entry.changedTable}</span>
                    <span className="text-[#94a3b8] text-xs">·</span>
                    <span className="font-mono text-xs text-[#64748b]">{entry.changedRecordId}</span>
                    {entry.fieldName && <span className="font-mono text-[10px] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded text-[#475569]">{entry.fieldName}</span>}
                  </div>
                  {entry.changeReason && <p className="text-xs text-[#64748b] mt-0.5">{entry.changeReason}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-[#334155]">{entry.changedByName || entry.changedBy || "—"}</div>
                  <div className="text-[10px] font-mono text-[#94a3b8]">{fmtDate(entry.changedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogView;
