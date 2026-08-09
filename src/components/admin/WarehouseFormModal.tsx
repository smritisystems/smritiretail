/**
 * Project      : SMRITI Retail OS
 * Module       : WarehouseFormModal (FIX 5 — Organisation Module Wire-Up)
 * Description  : Modal form for creating and editing Stock Room / Warehouse records.
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import type { BranchItem } from "./BranchFormModal.tsx";

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  branch?: string | null;
  is_transit?: boolean;
  address?: string | null;
  status?: string;
}

interface WarehouseFormModalProps {
  warehouse?: WarehouseItem | null;
  branches: BranchItem[];
  onClose: () => void;
  onSaved: () => void;
}

export const WarehouseFormModal: React.FC<WarehouseFormModalProps> = ({
  warehouse,
  branches,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(warehouse?.id);

  const [form, setForm] = useState({
    code: warehouse?.code || "",
    name: warehouse?.name || "",
    branch: warehouse?.branch || "",
    is_transit: warehouse?.is_transit || false,
    address: warehouse?.address || "",
    status: warehouse?.status || "Active",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { setError("Warehouse code is required."); return; }
    if (!form.name.trim()) { setError("Warehouse name is required."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      code: form.code,
      name: form.name,
      branch: form.branch || null,
      is_transit: form.is_transit,
      address: form.address || null,
      status: form.status,
    };

    try {
      if (isEdit && warehouse) {
        await apiFetchV1(`/masters/warehouse/${warehouse.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetchV1("/masters/warehouse", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save warehouse.");
    } finally {
      setSaving(false);
    }
  };

  const iCls = "w-full px-3 py-2 rounded bg-[var(--theme-surface-1)] border border-[var(--theme-divider)] text-sm text-[var(--theme-body)] focus:outline-none focus:border-[var(--theme-primary)] transition-colors";
  const lCls = "block text-xs font-medium text-[var(--theme-muted)] mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-divider)] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-divider)] bg-[var(--theme-surface-2)] rounded-t-2xl">
          <div>
            <h2 className="text-sm font-bold text-[var(--theme-body)]">{isEdit ? "Edit Warehouse" : "Add New Warehouse / Stock Room"}</h2>
            {warehouse?.id && <p className="text-xs text-[var(--theme-muted)] font-mono mt-0.5">{warehouse.id}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-body)] rounded-lg transition-colors" aria-label="Close modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded text-xs text-red-300 bg-red-950/60 border border-red-700/50">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lCls} htmlFor="wf-code">Warehouse Code *</label>
              <input id="wf-code" name="code" value={form.code} onChange={handleChange} className={iCls} required placeholder="e.g. WH-CENTRAL" />
            </div>

            <div>
              <label className={lCls} htmlFor="wf-name">Warehouse Name *</label>
              <input id="wf-name" name="name" value={form.name} onChange={handleChange} className={iCls} required placeholder="e.g. Central Hub" />
            </div>

            <div>
              <label className={lCls} htmlFor="wf-branch">Assigned Branch (Optional)</label>
              <select id="wf-branch" name="branch" value={form.branch} onChange={handleChange} className={iCls}>
                <option value="">Global / Unassigned</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lCls} htmlFor="wf-status">Status</label>
              <select id="wf-status" name="status" value={form.status} onChange={handleChange} className={iCls}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={lCls} htmlFor="wf-address">Address</label>
              <textarea id="wf-address" name="address" value={form.address} onChange={handleChange} className={iCls} rows={2} placeholder="Physical address..." />
            </div>

            <div className="sm:col-span-2 flex items-center space-x-3 pt-2">
              <input type="checkbox" id="wf-is_transit" name="is_transit" checked={form.is_transit} onChange={handleChange} className="w-4 h-4 accent-[var(--theme-primary)]" />
              <label htmlFor="wf-is_transit" className="text-xs font-medium text-[var(--theme-body)]">
                In-Transit / Transfer Location (Virtual Warehouse)
              </label>
            </div>
          </div>
        </form>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-[var(--theme-divider)] bg-[var(--theme-surface-2)] rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded border border-[var(--theme-divider)] text-[var(--theme-muted)] hover:text-[var(--theme-body)] transition-colors">Cancel</button>
          <button type="submit" disabled={saving} onClick={handleSubmit} className="px-4 py-2 text-xs rounded bg-[var(--theme-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Warehouse"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseFormModal;
