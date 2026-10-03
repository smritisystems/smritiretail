/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — Roles & Groups View
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, RefreshCw,
  ShieldCheck, Lock, Users, CheckCircle2, Circle, Star,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
}

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

const SYSTEM_BADGE = "bg-amber-50 text-amber-700 border-amber-200";
const CUSTOM_BADGE = "bg-blue-50   text-blue-700  border-blue-200";

export const RolesGroupsView: React.FC<Props> = ({ onNotification }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const notify = useCallback(
    (type: Notification["type"], message: string) => onNotification?.({ type, message }),
    [onNotification],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: Role[] = await apiFetchV1("/roles/");
      setRoles(Array.isArray(res) ? res : []);
    } catch {
      notify("error", "Failed to load roles. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0f172a] font-display">Roles &amp; Groups</h2>
          <p className="text-xs text-[#64748b] mt-0.5">Define and manage security roles and user groups</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh roles"
            className="p-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <Plus size={14} /> New Role
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl p-4 animate-pulse h-16" />
            ))
          : roles.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#94a3b8]">
                <ShieldCheck size={36} className="mb-2 text-[#cbd5e1]" />
                <div className="font-semibold text-sm text-[#64748b]">No roles found</div>
                <div className="text-xs mt-1">Create your first security role to get started.</div>
              </div>
            )
            : roles.map(role => {
              const open = expanded.has(role.id);
              return (
                <div
                  key={role.id}
                  className="bg-white border border-[#e2e8f0] rounded-xl shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(role.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#f8fafc] transition focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[#1e40af]"
                  >
                    <div className={"w-9 h-9 rounded-lg flex items-center justify-center shrink-0 " + (role.isSystem ? "bg-amber-100" : "bg-[#eff6ff]")}>
                      {role.isSystem ? <Lock size={16} className="text-amber-600" /> : <Users size={16} className="text-[#1e40af]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0f172a]">{role.name}</span>
                        <span className={"px-1.5 py-0.5 rounded border text-[10px] font-bold " + (role.isSystem ? SYSTEM_BADGE : CUSTOM_BADGE)}>
                          {role.isSystem ? "System" : "Custom"}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-xs text-[#64748b] mt-0.5 truncate">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[#94a3b8] font-mono">
                        {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                      </span>
                      {!role.isSystem && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button type="button" aria-label={`Edit ${role.name}`}
                            className="p-1.5 rounded text-[#64748b] hover:text-[#1e40af] hover:bg-[#eff6ff] transition">
                            <Pencil size={13} />
                          </button>
                          <button type="button" aria-label={`Delete ${role.name}`}
                            className="p-1.5 rounded text-[#64748b] hover:text-rose-600 hover:bg-rose-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                      {open ? <ChevronDown size={15} className="text-[#94a3b8]" /> : <ChevronRight size={15} className="text-[#94a3b8]" />}
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-[#f1f5f9] px-5 py-4 bg-[#f8fafc]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-3">
                        Permissions ({role.permissions.length})
                      </p>
                      {role.permissions.length === 0
                        ? <p className="text-xs text-[#94a3b8] italic">No permissions assigned to this role.</p>
                        : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {role.permissions.map(perm => (
                              <div key={perm}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-[#e2e8f0] text-xs text-[#334155]">
                                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                <span className="font-mono truncate">{perm}</span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );
};

export default RolesGroupsView;
