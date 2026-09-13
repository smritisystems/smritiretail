/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-09-13
 * Modified     : 2026-09-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Master Lookup Item & Audit History Drawer
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Tag,
  Shield,
  History,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Hash,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Sliders,
  Layers,
  AlertTriangle,
  Info
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { formatDateTime } from "../../../utils/formatters.ts";

export interface MasterLookupDetailDrawerProps {
  item: Record<string, any>;
  typeCode: string;
  onClose: () => void;
  onRefetch?: () => void;
}

interface AuditLogEntry {
  id: string;
  uuid?: string;
  company_id?: string;
  branch_id?: string;
  event_type: string;
  entity_name: string;
  entity_id: string;
  actor_user_id?: string;
  actor_username?: string;
  actor_role?: string;
  ip_address?: string;
  before_state?: Record<string, any> | null;
  after_state?: Record<string, any> | null;
  action_summary: string;
  payload_hash: string;
  timestamp?: string | null;
}

export const MasterLookupDetailDrawer: React.FC<MasterLookupDetailDrawerProps> = ({
  item,
  typeCode,
  onClose,
  onRefetch
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "audit">("overview");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    if (!typeCode && !item?.id) return;
    setLoadingAudit(true);
    setAuditError(null);
    try {
      // Primary: Existing compliance audit search path
      const endpoint = item?.id
        ? `/integration/audit/logs?entity_name=master_lookup:${typeCode}&entity_id=${item.id}&limit=50`
        : `/integration/audit/logs?entity_name=master_lookup:${typeCode}&limit=50`;
      const res = await apiFetchV1<any>(endpoint);
      const logs = Array.isArray(res?.logs) ? res.logs : Array.isArray(res) ? res : [];
      
      // Fallback: If empty, also check the direct master lookup item audit endpoint
      if (logs.length === 0) {
        try {
          const directEndpoint = item?.id
            ? `/masters/lookup/${typeCode}/values/${item.id}/audit`
            : `/masters/lookup/${typeCode}/audit`;
          const directRes = await apiFetchV1<any>(directEndpoint);
          if (Array.isArray(directRes?.logs) && directRes.logs.length > 0) {
            setAuditLogs(directRes.logs);
            return;
          }
        } catch {
          // Direct endpoint optional
        }
      }
      setAuditLogs(logs);
    } catch (err: any) {
      console.warn("[MasterLookupDetailDrawer] Failed to fetch audit trail:", err);
      // Attempt direct endpoint as fallback on error
      try {
        const directEndpoint = item?.id
          ? `/masters/lookup/${typeCode}/values/${item.id}/audit`
          : `/masters/lookup/${typeCode}/audit`;
        const directRes = await apiFetchV1<any>(directEndpoint);
        setAuditLogs(Array.isArray(directRes?.logs) ? directRes.logs : []);
      } catch {
        setAuditError("Unable to load compliance audit trail. Verify permissions.");
      }
    } finally {
      setLoadingAudit(false);
    }
  }, [item?.id, typeCode]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getActionBadge = (eventType: string) => {
    const norm = eventType.toUpperCase();
    if (norm.includes("CREATE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={10} />
          CREATED
        </span>
      );
    }
    if (norm.includes("DELETE") || norm.includes("RETIRE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle size={10} />
          RETIRED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Sliders size={10} />
        MODIFIED
      </span>
    );
  };

  const renderFieldDiffs = (log: AuditLogEntry) => {
    const before = log.before_state || {};
    const after = log.after_state || {};

    const diffs: {
      label: string;
      field: string;
      beforeVal: any;
      afterVal: any;
    }[] = [];

    // 1. Code
    if (before.code !== undefined && after.code !== undefined && before.code !== after.code) {
      diffs.push({ label: "Code", field: "code", beforeVal: before.code, afterVal: after.code });
    }

    // 2. Name
    if (before.name !== undefined && after.name !== undefined && before.name !== after.name) {
      diffs.push({ label: "Title / Name", field: "name", beforeVal: before.name, afterVal: after.name });
    }

    // 3. Description (root or data.description)
    const beforeDesc = before.data?.description ?? before.description;
    const afterDesc = after.data?.description ?? after.description;
    if (beforeDesc !== undefined && afterDesc !== undefined && beforeDesc !== afterDesc) {
      diffs.push({ label: "Description", field: "description", beforeVal: beforeDesc, afterVal: afterDesc });
    }

    // 4. Active Status
    const beforeActive = before.active ?? before.is_active;
    const afterActive = after.active ?? after.is_active;
    if (beforeActive !== undefined && afterActive !== undefined && beforeActive !== afterActive) {
      diffs.push({
        label: "Status",
        field: "active",
        beforeVal: beforeActive ? "Active" : "Inactive",
        afterVal: afterActive ? "Active" : "Inactive"
      });
    }

    // 5. Sort Order
    if (before.sort_order !== undefined && after.sort_order !== undefined && before.sort_order !== after.sort_order) {
      diffs.push({
        label: "Sort Order",
        field: "sort_order",
        beforeVal: String(before.sort_order),
        afterVal: String(after.sort_order)
      });
    }

    // 6. Vendor Code
    if (before.vendor_code !== undefined && after.vendor_code !== undefined && before.vendor_code !== after.vendor_code) {
      diffs.push({
        label: "Vendor Code",
        field: "vendor_code",
        beforeVal: before.vendor_code || "None",
        afterVal: after.vendor_code || "None"
      });
    }

    if (diffs.length === 0) {
      // If it's a create or initial entry
      if (log.event_type.includes("CREATE")) {
        return (
          <div className="mt-2 text-[11px] text-theme-muted bg-theme-surface-2/60 rounded-lg p-2.5 border border-theme-divider/50">
            <span className="font-semibold text-theme-primary">Initial State: </span>
            Code: <span className="font-mono text-blue-400">{after.code || item.code}</span>
            {after.name && <> • Name: <span className="font-semibold text-theme-primary">{after.name}</span></>}
            {after.sort_order !== undefined && <> • Order: <span className="font-mono text-amber-400">{after.sort_order}</span></>}
            {after.active !== undefined && <> • Status: <span className="font-mono text-emerald-400">{after.active ? "Active" : "Inactive"}</span></>}
          </div>
        );
      }
      return null;
    }

    return (
      <div className="mt-2 space-y-1.5">
        <div className="text-[10px] uppercase font-bold tracking-wider text-theme-muted">
          Operational Field Changes:
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {diffs.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-theme-surface-2/70 border border-theme-divider/60 font-mono"
            >
              <span className="text-theme-muted font-sans font-semibold shrink-0 w-28">
                {d.label}:
              </span>
              <div className="flex items-center space-x-2 text-right overflow-hidden">
                <span className="text-rose-400 line-through truncate max-w-[140px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                  {String(d.beforeVal || "—")}
                </span>
                <ArrowRight size={12} className="text-theme-muted shrink-0" />
                <span className="text-emerald-400 font-bold truncate max-w-[160px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {String(d.afterVal || "—")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden bg-black/40 backdrop-blur-xs">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="relative z-10 flex flex-col h-full w-full max-w-xl bg-theme-surface-1 border-l border-theme-divider shadow-2xl overflow-hidden font-sans"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <Tag size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-theme-primary font-display">
                  {item.name || "Master Lookup Item"}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    item.is_active !== false && item.active !== false
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  {item.is_active !== false && item.active !== false ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted font-mono">
                Code: <span className="text-theme-primary font-bold">{item.code || item.id}</span> • Type:{" "}
                <span className="uppercase text-blue-400">{typeCode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer"
            title="Close Drawer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-theme-divider px-6 bg-theme-surface-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-theme-muted hover:text-theme-primary"
            }`}
          >
            <Info size={14} />
            Item Overview
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "audit"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-theme-muted hover:text-theme-primary"
            }`}
          >
            <History size={14} />
            Audit History
            {auditLogs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                {auditLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Properties Grid */}
              <div className="bg-theme-surface-2/60 rounded-xl p-4 border border-theme-divider space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1.5 font-display">
                  <Sliders size={13} className="text-blue-400" />
                  Core Configuration Attributes
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-theme-muted block text-[11px]">Lookup Code</span>
                    <span className="font-mono font-bold text-theme-primary">{item.code || "—"}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted block text-[11px]">Display Name</span>
                    <span className="font-bold text-theme-primary">{item.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted block text-[11px]">Type Code</span>
                    <span className="font-mono text-blue-400">{typeCode}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted block text-[11px]">Sort Sequence</span>
                    <span className="font-mono text-amber-400">{item.sort_order ?? item.sequence_order ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted block text-[11px]">Active Status</span>
                    <span className="font-mono text-emerald-400">
                      {item.is_active !== false && item.active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div>
                    <span className="text-theme-muted block text-[11px]">System Protected</span>
                    <span className="font-mono text-theme-muted">
                      {item.is_system ? "Yes (Built-in)" : "No (User-Defined)"}
                    </span>
                  </div>
                </div>

                {/* Description / Notes */}
                <div className="pt-2 border-t border-theme-divider/60">
                  <span className="text-theme-muted block text-[11px] mb-1">Description / Notes</span>
                  <p className="text-xs text-theme-primary bg-theme-surface-1 p-2.5 rounded-lg border border-theme-divider">
                    {item.description || item.data?.description || item.data?.notes || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Technical / Metadata Card */}
              <div className="bg-theme-surface-2/60 rounded-xl p-4 border border-theme-divider space-y-2 text-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1.5 font-display">
                  <Layers size={13} className="text-purple-400" />
                  System Identifiers & Audit State
                </h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Internal ID:</span>
                    <span className="text-theme-primary select-all">{item.id}</span>
                  </div>
                  {item.created_at && (
                    <div className="flex justify-between">
                      <span className="text-theme-muted">Created:</span>
                      <span className="text-theme-primary">{formatDateTime(item.created_at)}</span>
                    </div>
                  )}
                  {item.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-theme-muted">Updated:</span>
                      <span className="text-theme-primary">{formatDateTime(item.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Jump to Audit */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield size={20} className="text-blue-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-theme-primary">Compliance Audit Visibility</h5>
                    <p className="text-[11px] text-theme-muted">
                      Verify modification logs, actor identity, and SHA-256 cryptographic proof.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("audit")}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  View Audit Trail
                </button>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              {/* Audit Controls & Status */}
              <div className="flex items-center justify-between pb-2 border-b border-theme-divider">
                <div className="flex items-center space-x-2">
                  <Shield size={16} className="text-blue-400" />
                  <span className="text-xs font-bold text-theme-primary">
                    Tamper-Evident Modification Trail
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  disabled={loadingAudit}
                  className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                  title="Refresh Audit Trail"
                >
                  <RefreshCw size={12} className={loadingAudit ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              {loadingAudit ? (
                <div className="py-12 text-center text-theme-muted font-mono space-y-2">
                  <RefreshCw size={22} className="animate-spin mx-auto text-blue-400" />
                  <p className="text-xs">Querying compliance audit search path...</p>
                </div>
              ) : auditError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{auditError}</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center rounded-xl bg-theme-surface-2/40 border border-theme-divider space-y-2 p-6">
                  <History size={28} className="mx-auto text-theme-muted opacity-60" />
                  <p className="text-xs font-semibold text-theme-primary">No Recorded Audit Logs</p>
                  <p className="text-[11px] text-theme-muted max-w-sm mx-auto">
                    No modification events were recorded for this lookup item. Future modifications
                    (code, description, status, order) will be tracked here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-theme-divider">
                  {auditLogs.map((log, index) => (
                    <div key={log.id || index} className="relative flex items-start space-x-3 pl-1">
                      {/* Timeline Node Icon */}
                      <div className="relative z-10 w-7 h-7 rounded-full bg-theme-surface-1 border border-theme-divider flex items-center justify-center text-blue-400 shadow-xs shrink-0 mt-0.5">
                        <History size={13} />
                      </div>

                      {/* Audit Event Card */}
                      <div className="flex-1 bg-theme-surface-2/80 border border-theme-divider rounded-xl p-4 space-y-2.5 shadow-xs">
                        {/* Event Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            {getActionBadge(log.event_type)}
                            <span className="text-xs font-bold text-theme-primary font-display">
                              {log.action_summary || log.event_type}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-theme-muted flex items-center gap-1">
                            <Clock size={11} />
                            {log.timestamp ? formatDateTime(log.timestamp) : "—"}
                          </span>
                        </div>

                        {/* Actor & Authorization Identity */}
                        <div className="flex items-center gap-3 text-[11px] font-mono bg-theme-surface-1 p-2 rounded-lg border border-theme-divider/50">
                          <div className="flex items-center gap-1.5 text-theme-primary font-bold">
                            <User size={12} className="text-blue-400" />
                            <span>{log.actor_username || log.actor_user_id || "System"}</span>
                          </div>
                          {log.actor_role && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-theme-surface-2 text-theme-muted border border-theme-divider">
                              {log.actor_role}
                            </span>
                          )}
                          {log.ip_address && (
                            <span className="text-theme-muted text-[10px] ml-auto">
                              IP: {log.ip_address}
                            </span>
                          )}
                        </div>

                        {/* Field Diffs (Before -> After) */}
                        {renderFieldDiffs(log)}

                        {/* Cryptographic SHA-256 Proof */}
                        {log.payload_hash && (
                          <div className="pt-2 border-t border-theme-divider/50 flex items-center justify-between text-[10px] font-mono text-theme-muted">
                            <div className="flex items-center gap-1">
                              <Shield size={11} className="text-emerald-400" />
                              <span className="text-emerald-400 font-bold">SHA-256 Validated:</span>
                              <span className="truncate max-w-[150px]">{log.payload_hash}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.payload_hash, log.id)}
                              className="hover:text-theme-primary transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copy SHA-256 Hash"
                            >
                              {copiedHash === log.id ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                              <span>{copiedHash === log.id ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-between text-xs">
          <span className="text-theme-muted font-mono text-[11px]">
            SMRITI Compliance Audit Plane §12
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-theme-surface-1 hover:bg-theme-surface-hover text-theme-primary font-bold text-xs border border-theme-divider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
