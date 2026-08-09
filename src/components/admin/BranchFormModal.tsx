/**
 * Project      : SMRITI Retail OS
 * Module       : BranchFormModal (FIX 4 — Organisation Module Wire-Up)
 * Description  : Modal form for creating and editing Branch/Store location records.
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import type { CompanyItem } from "./OrganizationStudio.tsx";

export interface BranchItem {
  id: string;
  company: string;
  name: string;
  code: string;
  branch_type?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  manager_user_id?: string;
}

interface BranchFormModalProps {
  branch?: BranchItem | null;
  companies: CompanyItem[];
  users: Array<{ id: string; username: string; full_name?: string }>;
  onClose: () => void;
  onSaved: () => void;
}

const BRANCH_TYPES = ["RETAIL", "WHOLESALE", "WAREHOUSE", "HQ", "FRANCHISE"];

export const BranchFormModal: React.FC<BranchFormModalProps> = ({
  branch,
  companies,
  users,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(branch?.id);

  const [form, setForm] = useState({
    company: branch?.company || (companies.length > 0 ? companies[0].id : ""),
    name: branch?.name || "",
    code: branch?.code || "",
    branch_type: branch?.branch_type || "RETAIL",
    gstin: branch?.gstin || "",
    phone: branch?.phone || "",
    email: branch?.email || "",
    manager_user_id: branch?.manager_user_id || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company) { setError("Company selection is required."); return; }
    if (!form.name.trim()) { setError("Branch name is required."); return; }
    if (!form.code.trim()) { setError("Branch code is required."); return; }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && branch) {
        await apiFetchV1(`/masters/branch/${branch.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetchV1("/masters/branch", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save branch.");
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
            <h2 className="text-sm font-bold text-[var(--theme-body)]">{isEdit ? "Edit Branch" : "Add New Branch"}</h2>
            {branch?.id && <p className="text-xs text-[var(--theme-muted)] font-mono mt-0.5">{branch.id}</p>}
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
            <div className="sm:col-span-2">
              <label className={lCls} htmlFor="bf-company">Company *</label>
              <select id="bf-company" name="company" value={form.company} onChange={handleChange} className={iCls} required>
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lCls} htmlFor="bf-name">Branch Name *</label>
              <input id="bf-name" name="name" value={form.name} onChange={handleChange} className={iCls} required />
            </div>

            <div>
              <label className={lCls} htmlFor="bf-code">Branch Code *</label>
              <input id="bf-code" name="code" value={form.code} onChange={handleChange} className={iCls} required placeholder="e.g. BR-ANDHERI" />
            </div>

            <div>
              <label className={lCls} htmlFor="bf-branch_type">Branch Type</label>
              <select id="bf-branch_type" name="branch_type" value={form.branch_type} onChange={handleChange} className={iCls}>
                {BRANCH_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lCls} htmlFor="bf-gstin">GSTIN</label>
              <input id="bf-gstin" name="gstin" value={form.gstin} onChange={handleChange} className={iCls} maxLength={15} />
            </div>

            <div>
              <label className={lCls} htmlFor="bf-phone">Phone</label>
              <input id="bf-phone" name="phone" value={form.phone} onChange={handleChange} className={iCls} />
            </div>

            <div>
              <label className={lCls} htmlFor="bf-email">Email</label>
              <input id="bf-email" name="email" type="email" value={form.email} onChange={handleChange} className={iCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={lCls} htmlFor="bf-manager_user_id">Branch Manager</label>
              <select id="bf-manager_user_id" name="manager_user_id" value={form.manager_user_id} onChange={handleChange} className={iCls}>
                <option value="">None / Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.id})</option>
                ))}
              </select>
            </div>
          </div>
        </form>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-[var(--theme-divider)] bg-[var(--theme-surface-2)] rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded border border-[var(--theme-divider)] text-[var(--theme-muted)] hover:text-[var(--theme-body)] transition-colors">Cancel</button>
          <button type="submit" disabled={saving} onClick={handleSubmit} className="px-4 py-2 text-xs rounded bg-[var(--theme-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Branch"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchFormModal;
