/**
 * Project      : SMRITI Retail OS
 * Module       : CompanyEditModal
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import type { CompanyItem } from "./OrganizationStudio.tsx";

interface CompanyEditModalProps {
  company: CompanyItem;
  onClose: () => void;
  onSaved: () => void;
}

const COMPANY_TYPES = [
  "PROPRIETORSHIP","PARTNERSHIP","LLP","PRIVATE_LTD","PUBLIC_LTD","OPC","TRUST","NGO",
];
const INDUSTRY_TYPES = [
  "RETAIL","WHOLESALE","MANUFACTURING","PHARMACY","FOOD_BEVERAGE",
  "APPAREL","ELECTRONICS","JEWELLERY","GROCERY","SERVICES","OTHER",
];
const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];

export const CompanyEditModal: React.FC<CompanyEditModalProps> = ({ company, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: company.name || "",
    legal_name: company.legal_name || "",
    short_name: company.short_name || "",
    gstNumber: company.gstNumber || "",
    company_type: company.company_type || "PRIVATE_LTD",
    industry_type: company.industry_type || "RETAIL",
    fiscal_year_start_month: company.fiscal_year_start_month ?? 4,
    currency_code: company.currency_code || "INR",
    is_gst_registered: company.is_gst_registered ?? false,
    status: company.status || "Active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : name === "fiscal_year_start_month"
          ? parseInt(value, 10)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetchV1(`/masters/company/${company.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save company details.");
    } finally {
      setSaving(false);
    }
  };

  const iCls = "w-full px-3 py-2 rounded bg-[var(--theme-surface-1)] border border-[var(--theme-divider)] text-sm text-[var(--theme-body)] focus:outline-none focus:border-[var(--theme-primary)] transition-colors";
  const lCls = "block text-xs font-medium text-[var(--theme-muted)] mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-divider)] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-divider)] bg-[var(--theme-surface-2)] rounded-t-2xl">
          <div>
            <h2 className="text-sm font-bold text-[var(--theme-body)]">Edit Company Details</h2>
            <p className="text-xs text-[var(--theme-muted)] font-mono mt-0.5">{company.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-body)] rounded-lg transition-colors" aria-label="Close company edit modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="mb-4 px-3 py-2 rounded text-xs text-red-300 bg-red-950/60 border border-red-700/50">{error}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lCls} htmlFor="ce-name">Trading Name *</label>
              <input id="ce-name" name="name" value={form.name} onChange={handleChange} className={iCls} required />
            </div>
            <div>
              <label className={lCls} htmlFor="ce-legal_name">Legal Name</label>
              <input id="ce-legal_name" name="legal_name" value={form.legal_name} onChange={handleChange} className={iCls} />
            </div>
            <div>
              <label className={lCls} htmlFor="ce-short_name">Short Name</label>
              <input id="ce-short_name" name="short_name" value={form.short_name} onChange={handleChange} className={iCls} />
            </div>
            <div>
              <label className={lCls} htmlFor="ce-gstNumber">GSTIN</label>
              <input id="ce-gstNumber" name="gstNumber" value={form.gstNumber} onChange={handleChange} className={iCls} maxLength={15} />
            </div>
            <div>
              <label className={lCls} htmlFor="ce-company_type">Company Type</label>
              <select id="ce-company_type" name="company_type" value={form.company_type} onChange={handleChange} className={iCls}>
                {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={lCls} htmlFor="ce-industry_type">Industry</label>
              <select id="ce-industry_type" name="industry_type" value={form.industry_type} onChange={handleChange} className={iCls}>
                {INDUSTRY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={lCls} htmlFor="ce-fiscal_year_start_month">Fiscal Year Start</label>
              <select id="ce-fiscal_year_start_month" name="fiscal_year_start_month" value={form.fiscal_year_start_month} onChange={handleChange} className={iCls}>
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lCls} htmlFor="ce-currency_code">Currency Code</label>
              <input id="ce-currency_code" name="currency_code" value={form.currency_code} onChange={handleChange} className={iCls} maxLength={3} />
            </div>
            <div>
              <label className={lCls} htmlFor="ce-status">Status</label>
              <select id="ce-status" name="status" value={form.status} onChange={handleChange} className={iCls}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center space-x-3 pt-5">
              <input type="checkbox" id="ce-is_gst_registered" name="is_gst_registered" checked={form.is_gst_registered} onChange={handleChange} className="w-4 h-4 accent-[var(--theme-primary)]" />
              <label htmlFor="ce-is_gst_registered" className="text-xs font-medium text-[var(--theme-body)]">GST Registered</label>
            </div>
          </div>
        </form>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-[var(--theme-divider)] bg-[var(--theme-surface-2)] rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded border border-[var(--theme-divider)] text-[var(--theme-muted)] hover:text-[var(--theme-body)] transition-colors">Cancel</button>
          <button type="submit" disabled={saving} onClick={handleSubmit} className="px-4 py-2 text-xs rounded bg-[var(--theme-primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyEditModal;
