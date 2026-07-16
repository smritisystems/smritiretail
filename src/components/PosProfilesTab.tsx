/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.2
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { POSProfile } from "../types";

interface PosProfilesTabProps {
  profiles: POSProfile[];
  onRefreshData: () => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
}

export const PosProfilesTab: React.FC<PosProfilesTabProps> = ({
  profiles,
  onRefreshData,
  onNotification
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [cashier, setCashier] = useState("");
  const [warehouse, setWarehouse] = useState("");

  // Create Profile
  // Migrated: POST /api/pos/profiles (Express — never mounted) → POST /api/v1/pos/profiles/ (FastAPI)
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cashier || !warehouse) return;
    try {
      await apiFetchV1("/pos/profiles/", {
        method: "POST",
        body: JSON.stringify({ name, cashier, warehouse })
      });
      onNotification("Success", `Profile ${name} registered successfully.`, "success");
      setShowAddModal(false);
      setName("");
      setCashier("");
      setWarehouse("");
      onRefreshData();
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to create profile.", "error");
    }
  };

  // Clone Profile
  // Migrated: POST /api/pos/profiles/clone/{id} (Express) → POST /api/v1/pos/profiles/{id}/clone (FastAPI)
  const handleCloneProfile = async (id: string) => {
    try {
      await apiFetchV1(`/pos/profiles/${id}/clone`, { method: "POST" });
      onNotification("Success", "POS Profile cloned successfully.", "success");
      onRefreshData();
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to clone profile.", "error");
    }
  };

  // Archive Profile
  // Migrated: POST /api/pos/profiles/archive/{id} (Express) → POST /api/v1/pos/profiles/{id}/archive (FastAPI)
  const handleArchiveProfile = async (id: string) => {
    try {
      await apiFetchV1(`/pos/profiles/${id}/archive`, { method: "POST" });
      onNotification("Success", "POS Profile successfully soft-deleted/archived.", "success");
      onRefreshData();
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to archive profile.", "error");
    }
  };

  // Toggle Lock Profile
  // Migrated: POST /api/pos/profiles/toggle-lock/{id} (Express) → POST /api/v1/pos/profiles/{id}/toggle-lock (FastAPI)
  const handleToggleLockProfile = async (id: string) => {
    try {
      await apiFetchV1(`/pos/profiles/${id}/toggle-lock`, { method: "POST" });
      onNotification("Lock Updated", "Terminal access state synced in audit trails.", "success");
      onRefreshData();
    } catch (e: any) {
      onNotification("Error", e.message || "Failed to toggle lock.", "error");
    }
  };

  return (
    <div className="space-y-6">

      {/* Description header */}
      <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-lg text-theme-body">POS Profile Manager</h3>
          <p className="text-xs text-theme-muted">
            Archive, clone, or toggle terminal-level cashier shift lockouts.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#2563EB] hover:bg-opacity-95 text-theme-body text-xs font-bold uppercase px-4 py-2.5 rounded-lg transition-all flex items-center space-x-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          <span>Register Terminal</span>
        </button>
      </div>

      {/* Profile list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(p => (
          <div key={p.id} className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider flex flex-col justify-between hover:border-theme-divider transition-all">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-blue-400">devices</span>
                  <h4 className="font-bold text-theme-body text-base font-display">{p.name}</h4>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  p.isLocked
                    ? "bg-rose-500 bg-opacity-20 text-rose-400 border-rose-500"
                    : "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500"
                }`}>
                  {p.isLocked ? "SHIFT LOCKED" : "ACTIVE"}
                </span>
              </div>

              {/* Attributes fields */}
              <div className="space-y-2 text-xs border-b border-theme-divider pb-4">
                <div className="flex justify-between">
                  <span className="text-theme-muted">Cashier User:</span>
                  <span className="font-semibold text-theme-body">{p.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-muted">Default Warehouse:</span>
                  <span className="font-semibold text-theme-body text-right">{p.warehouse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-muted">Terminal ID:</span>
                  <span className="font-mono text-[10px] text-theme-body">{p.id}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 pt-1 flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => handleToggleLockProfile(p.id)}
                className={`flex-1 font-semibold py-1.5 px-2 rounded flex items-center justify-center space-x-1 border transition-colors ${
                  p.isLocked
                    ? "bg-emerald-500 bg-opacity-20 border-emerald-500 text-emerald-400 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]"
                    : "bg-rose-500 bg-opacity-20 border-rose-500 text-rose-400 hover:bg-rose-500 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{p.isLocked ? "lock_open" : "lock"}</span>
                <span>{p.isLocked ? "Unlock Shift" : "Lock Shift"}</span>
              </button>

              <button
                onClick={() => handleCloneProfile(p.id)}
                className="bg-theme-surface-3 hover:bg-[#2a3a5c] text-theme-body p-2 rounded border border-theme-divider flex items-center justify-center transition-colors"
                title="Clone Profile"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
              </button>

              <button
                onClick={() => handleArchiveProfile(p.id)}
                className="bg-theme-surface-3 hover:bg-rose-950 hover:text-rose-400 text-theme-muted p-2 rounded border border-theme-divider flex items-center justify-center transition-colors"
                title="Archive Terminal"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add profile modal dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-70" onClick={() => setShowAddModal(false)}></div>
          <form
            onSubmit={handleCreateProfile}
            className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 max-w-md w-full relative z-10 space-y-4"
          >
            <h4 className="font-display font-semibold text-lg text-theme-body">Register Cash Terminal</h4>
            <p className="text-xs text-theme-muted">
              Add a new operational point-of-sale lane. This registers stable warehouse and user relations.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-1.5">Terminal Name:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 w-full focus:outline-none"
                  placeholder="e.g. Self-Checkout Terminal D"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-1.5">Assigned Cashier User:</label>
                <input
                  type="text"
                  required
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 w-full focus:outline-none"
                  placeholder="e.g. Sarah Connor"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-1.5">Default Outlet Stock Warehouse:</label>
                <input
                  type="text"
                  required
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 w-full focus:outline-none"
                  placeholder="e.g. North Terminal Outlet WH"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-theme-surface-3 text-theme-muted hover:text-theme-body px-4 py-2 rounded text-xs font-semibold transition-colors"
              >
                Abort
              </button>
              <button
                type="submit"
                className="bg-[#2563EB] hover:bg-opacity-95 text-theme-body px-4 py-2 rounded text-xs font-semibold transition-colors"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
