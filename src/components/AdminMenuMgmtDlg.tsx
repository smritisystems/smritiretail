/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { X, Settings, ShieldCheck, Save, Eye, EyeOff, History, Layers, ArrowUpDown } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface AdminMenuManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminMenuManagementModal: React.FC<AdminMenuManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [menus, setMenus] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"registry" | "audit">("registry");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingMenu, setEditingMenu] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, aRes] = await Promise.all([
        apiFetchV1("/menus/"),
        apiFetchV1("/menus/audit"),
      ]);
      setMenus(Array.isArray(mRes) ? mRes : []);
      setAuditLogs(Array.isArray(aRes) ? aRes : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load Control Plane Menu Registry.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (menu: any) => {
    setSavingId(menu.id);
    try {
      const updated = await apiFetchV1(`/menus/${menu.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !menu.is_active }),
      });
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? updated : m)));
      loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update menu status");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu) return;
    setSavingId(editingMenu.id);
    try {
      const updated = await apiFetchV1(`/menus/${editingMenu.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editingMenu.title,
          icon: editingMenu.icon,
          sequence: parseInt(editingMenu.sequence) || 0,
          module: editingMenu.module,
        }),
      });
      setMenus((prev) => prev.map((m) => (m.id === editingMenu.id ? updated : m)));
      setEditingMenu(null);
      loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update menu configuration");
    } finally {
      setSavingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-sans">
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl relative text-theme-primary max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-theme-muted hover:text-theme-primary p-1.5 rounded-xl hover:bg-theme-surface-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-theme-divider pb-4 shrink-0">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-primary font-display flex items-center gap-2">
              Control Plane Menu Management & Navigation Registry
              <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 text-[10px] font-mono border border-indigo-500/30 rounded">
                system.menu.manage
              </span>
            </h3>
            <p className="text-xs text-theme-muted">
              Configure visibility, labels, icons, sort ordering, and inspect smriti_audit_log history.
            </p>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-2 border-b border-theme-divider pb-2 shrink-0 text-xs font-mono font-bold">
          <button
            onClick={() => setActiveSubTab("registry")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeSubTab === "registry"
                ? "bg-indigo-600 text-white"
                : "bg-theme-surface-3 text-theme-muted hover:text-theme-primary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Menu Registry ({menus.length})
          </button>
          <button
            onClick={() => setActiveSubTab("audit")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeSubTab === "audit"
                ? "bg-indigo-600 text-white"
                : "bg-theme-surface-3 text-theme-muted hover:text-theme-primary"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Change Audit Logs ({auditLogs.length})
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-mono shrink-0">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 text-xs">
          {activeSubTab === "registry" && (
            <div className="space-y-4">
              {editingMenu && (
                <form onSubmit={handleSaveEdit} className="bg-theme-surface-3 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-indigo-400 font-mono text-xs flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Edit Menu Definition #{editingMenu.id}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-theme-muted mb-1 font-mono font-bold">Label</label>
                      <input
                        type="text"
                        value={editingMenu.title}
                        onChange={(e) => setEditingMenu({ ...editingMenu, title: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2.5 py-1.5 text-theme-primary focus:outline-none focus:border-indigo-500 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-theme-muted mb-1 font-mono font-bold">Icon Name</label>
                      <input
                        type="text"
                        value={editingMenu.icon || ""}
                        onChange={(e) => setEditingMenu({ ...editingMenu, icon: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2.5 py-1.5 text-theme-primary font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-theme-muted mb-1 font-mono font-bold">Category Module</label>
                      <input
                        type="text"
                        value={editingMenu.module || ""}
                        onChange={(e) => setEditingMenu({ ...editingMenu, module: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2.5 py-1.5 text-theme-primary focus:outline-none focus:border-indigo-500 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-theme-muted mb-1 font-mono font-bold">Sequence Order</label>
                      <input
                        type="number"
                        value={editingMenu.sequence}
                        onChange={(e) => setEditingMenu({ ...editingMenu, sequence: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2.5 py-1.5 text-theme-primary font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={savingId === editingMenu.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMenu(null)}
                      className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-theme-surface-3 border border-theme-divider rounded-xl overflow-hidden shadow">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-4 border-b border-theme-divider text-[10px] uppercase font-mono text-theme-muted">
                      <th className="px-3 py-2 text-center">Seq</th>
                      <th className="px-3 py-2">Menu ID</th>
                      <th className="px-3 py-2">Title / Label</th>
                      <th className="px-3 py-2">Category Module</th>
                      <th className="px-3 py-2">Route</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider text-xs">
                    {menus.map((m) => (
                      <tr key={m.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-3 py-2 text-center font-mono font-bold text-indigo-400">
                          {m.sequence}
                        </td>
                        <td className="px-3 py-2 font-mono text-theme-muted text-[11px]">
                          {m.id}
                        </td>
                        <td className="px-3 py-2 font-medium flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-indigo-400">
                            {m.icon || "grid_view"}
                          </span>
                          {m.title}
                        </td>
                        <td className="px-3 py-2 font-mono text-theme-muted">
                          {m.module}
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-400">
                          {m.route}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.is_active
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-950 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {m.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center space-x-1">
                          <button
                            onClick={() => setEditingMenu(m)}
                            className="p-1 hover:bg-theme-surface-hover text-indigo-400 rounded transition-colors"
                            title="Edit Menu Definition"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(m)}
                            disabled={savingId === m.id}
                            className="p-1 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary rounded transition-colors"
                            title={m.is_active ? "Disable Menu" : "Enable Menu"}
                          >
                            {m.is_active ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === "audit" && (
            <div className="bg-theme-surface-3 border border-theme-divider rounded-xl overflow-hidden shadow">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-theme-surface-4 border-b border-theme-divider text-[10px] uppercase font-mono text-theme-muted">
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Record ID</th>
                    <th className="px-3 py-2">Changed By</th>
                    <th className="px-3 py-2">Change Type</th>
                    <th className="px-3 py-2">Old Value</th>
                    <th className="px-3 py-2">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-theme-muted">
                        No menu audit log records found in smriti_audit_log.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-theme-surface-hover">
                        <td className="px-3 py-2 text-theme-muted">
                          {log.changed_at ? new Date(log.changed_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="px-3 py-2 text-indigo-400 font-bold">
                          {log.changed_record_id || log.entity_id}
                        </td>
                        <td className="px-3 py-2 text-theme-primary">
                          {log.changed_by_name || log.changed_by || "System Admin"}
                        </td>
                        <td className="px-3 py-2 text-amber-400 font-bold">
                          {log.change_type}
                        </td>
                        <td className="px-3 py-2 text-rose-300 max-w-xs truncate">
                          {log.old_value}
                        </td>
                        <td className="px-3 py-2 text-emerald-300 max-w-xs truncate">
                          {log.new_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-theme-divider text-xs shrink-0 font-mono text-theme-muted">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
            Control Plane Audited: Table smriti_menus & smriti_audit_log
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-primary font-bold rounded-lg transition-colors border border-theme-divider"
          >
            Close Studio
          </button>
        </div>
      </div>
    </div>
  );
};
