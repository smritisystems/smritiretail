/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Company Profile & Corporate Settings Studio
 * Capability    : withCapability("company_profile_studio", "FOUNDATION")
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  MapPin,
  Receipt,
  Landmark,
  FileBadge,
  Globe,
  History,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Eye,
  X,
  FileText,
  CreditCard,
  Hash,
  Phone,
  Mail,
  User,
  Check,
} from "lucide-react";
import { apiFetchV1, persistTenantContext } from "../../lib/apiFetchV1";

interface BranchItem {
  id?: string;
  branch_code: string;
  name: string;
  address_line1?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  is_active: boolean;
  is_default: boolean;
}

interface BankAccountItem {
  id?: string;
  bank_name: string;
  account_holder_name?: string;
  account_no: string;
  account_type?: string;
  ifsc: string;
  branch?: string;
  upi_id?: string;
  is_default: boolean;
  is_active: boolean;
}

interface CompanyProfileData {
  id: string;
  name: string;
  company_code: string;
  legal_name?: string;
  trade_name?: string;
  business_type?: string;
  cin?: string;
  incorporation_date?: string;
  gst_number?: string;
  gst_scheme?: string;
  pan?: string;
  msme_reg_no?: string;
  reverse_charge_applicable?: boolean;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  dispatch_email?: string;
  accounts_email?: string;
  contact_person?: string;
  logo_url?: string;
  print_logo_url?: string;
  signature_url?: string;
  stamp_url?: string;
  signatory_name?: string;
  signatory_designation?: string;
  invoice_terms?: string;
  po_terms?: string;
  currency_code: string;
  secondary_currencies?: string[];
  timezone: string;
  financial_year_start?: string;
  date_format?: string;
  number_format?: string;
  currency_decimals?: number;
  quantity_decimals?: number;
  branches: BranchItem[];
  bank_accounts: BankAccountItem[];
}

interface AuditLogEntry {
  id: string;
  action: string;
  changed_by: string;
  timestamp: string;
  summary: string;
  hash_signature?: string;
}

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

type TabType =
  | "corporate"
  | "branches"
  | "statutory"
  | "banking"
  | "branding"
  | "localization"
  | "history";

const GST_STATE_MAP: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

export const CompanyProfileStudio: React.FC<Props> = ({
  isOpen = true,
  onClose,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("corporate");
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [originalProfile, setOriginalProfile] = useState<CompanyProfileData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeBranchModal, setActiveBranchModal] = useState<BranchItem | null>(null);
  const [activeBankModal, setActiveBankModal] = useState<BankAccountItem | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; type: "success" | "error" } | null>(null);

  // Auto-dismiss internal toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showNotification = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ title, message, type: type === "error" ? "error" : "success" });
      if (onNotification) {
        onNotification(title, message, type);
      }
    },
    [onNotification]
  );

  // Fetch Authoritative Profile
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1<CompanyProfileData>("/company/profile");
      setProfile(data);
      setOriginalProfile(JSON.parse(JSON.stringify(data)));
    } catch (err: any) {
      showNotification(
        "SMRITI-DATA-001: Profile Load Error",
        err?.message || "Failed to load corporate profile from system of record.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Fetch Audit Trail
  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await apiFetchV1<AuditLogEntry[]>("/company/audit-trail");
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch {
      // Non-blocking fallback for logs
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadAuditLogs();
  }, [loadProfile, loadAuditLogs]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!profile || !originalProfile) return false;
    return JSON.stringify(profile) !== JSON.stringify(originalProfile);
  }, [profile, originalProfile]);

  // Update profile fields
  const updateField = <K extends keyof CompanyProfileData>(field: K, value: CompanyProfileData[K]) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      // Auto-extract PAN and State Code from GSTIN if applicable
      if (field === "gst_number" && typeof value === "string") {
        const cleanedGstin = value.trim().toUpperCase();
        updated.gst_number = cleanedGstin;
        if (cleanedGstin.length >= 2) {
          const sc = cleanedGstin.slice(0, 2);
          updated.state_code = sc;
          if (GST_STATE_MAP[sc] && !updated.state) {
            updated.state = GST_STATE_MAP[sc];
          }
        }
        if (cleanedGstin.length >= 12) {
          updated.pan = cleanedGstin.slice(2, 12);
        }
      }

      if (field === "pan" && typeof value === "string") {
        updated.pan = value.trim().toUpperCase();
      }

      return updated;
    });
  };

  // Save Profile Handler
  const handleSave = async () => {
    if (!profile) return;

    // GSTIN Validation
    if (profile.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(profile.gst_number)) {
      showNotification(
        "SMRITI-VAL-001: Invalid GSTIN Format",
        "GSTIN must be 15 characters adhering to GST statutory specification (e.g., 27AAXFT2508H1ZR).",
        "error"
      );
      setActiveTab("statutory");
      return;
    }

    // PAN Validation
    if (profile.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(profile.pan)) {
      showNotification(
        "SMRITI-VAL-002: Invalid PAN Format",
        "PAN must be exactly 10 alphanumeric characters (e.g., AAXFT2508H).",
        "error"
      );
      setActiveTab("statutory");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetchV1<{ status: string; company: CompanyProfileData; updated_fields: string[] }>(
        "/company/profile",
        {
          method: "PUT",
          body: JSON.stringify(profile),
        }
      );

      const savedComp = res.company || profile;
      setProfile(savedComp);
      setOriginalProfile(JSON.parse(JSON.stringify(savedComp)));

      // Synchronize frontend tenant context immediately for print templates & document headers
      const defaultBank = savedComp.bank_accounts?.find((b) => b.is_default) || savedComp.bank_accounts?.[0];
      persistTenantContext({
        companyId: savedComp.id,
        companyName: savedComp.legal_name || savedComp.name,
        companyGstin: savedComp.gst_number,
        companyAddress: `${savedComp.address_line1 || ""} ${savedComp.city || ""} ${savedComp.state || ""} ${savedComp.pincode || ""}`.trim(),
        companyPhone: savedComp.phone,
        companyEmail: savedComp.email,
        companyLogoUrl: savedComp.logo_url || savedComp.print_logo_url,
      });

      showNotification(
        "Corporate Identity Synchronized",
        `Company profile and ${res.updated_fields?.length || 0} fields committed with immutable cryptographic audit seal.`,
        "success"
      );
      loadAuditLogs();
    } catch (err: any) {
      showNotification(
        "SMRITI-DATA-002: Update Failed",
        err?.message || "Failed to commit corporate profile changes.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    if (originalProfile) {
      setProfile(JSON.parse(JSON.stringify(originalProfile)));
      showNotification("Reverted", "Profile changes discarded.", "info");
    }
  };

  // Branch Management
  const handleSaveBranch = (branch: BranchItem) => {
    if (!profile) return;
    const branches = [...(profile.branches || [])];
    const index = branches.findIndex((b) => b.branch_code === branch.branch_code);

    if (branch.is_default) {
      branches.forEach((b) => {
        b.is_default = false;
      });
    }

    if (index >= 0) {
      branches[index] = branch;
    } else {
      branches.push(branch);
    }
    updateField("branches", branches);
    setActiveBranchModal(null);
  };

  const handleDeleteBranch = (branchCode: string) => {
    if (!profile) return;
    const branches = (profile.branches || []).filter((b) => b.branch_code !== branchCode);
    updateField("branches", branches);
  };

  // Bank Account Management
  const handleSaveBank = (bank: BankAccountItem) => {
    if (!profile) return;
    const accounts = [...(profile.bank_accounts || [])];
    const index = accounts.findIndex((b) => b.account_no === bank.account_no);

    if (bank.is_default) {
      accounts.forEach((b) => {
        b.is_default = false;
      });
    }

    if (index >= 0) {
      accounts[index] = bank;
    } else {
      accounts.push(bank);
    }
    updateField("bank_accounts", accounts);
    setActiveBankModal(null);
  };

  const handleDeleteBank = (accountNo: string) => {
    if (!profile) return;
    const accounts = (profile.bank_accounts || []).filter((b) => b.account_no !== accountNo);
    updateField("bank_accounts", accounts);
  };

  const setDefaultBank = (accountNo: string) => {
    if (!profile) return;
    const accounts = (profile.bank_accounts || []).map((b) => ({
      ...b,
      is_default: b.account_no === accountNo,
    }));
    updateField("bank_accounts", accounts);
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`absolute top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-700/60 text-rose-100 shadow-rose-950/50"
              : "bg-emerald-950/90 border-emerald-700/60 text-emerald-100 shadow-emerald-950/50"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div className="text-xs">
            <div className="font-bold tracking-wide">{toast.title}</div>
            <div className="text-slate-300 opacity-90">{toast.message}</div>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fiori-Grade Studio Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black tracking-tight text-white">
                {profile?.legal_name || profile?.name || "Corporate Profile & Settings"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                {profile?.company_code || "COMP-001"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                GST Compliant
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative Single System-of-Record for Corporate Identity, Multi-Branch Operations, Tax & Document Branding
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Discard unsaved changes"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/30 transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Profile
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 ml-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
              title="Close Studio"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Body: Sidebar Tabs + Form View */}
      <div className="flex flex-1 min-h-0">
        {/* Navigation Tab Rail */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/40 p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Studio Sections
          </div>

          <button
            onClick={() => setActiveTab("corporate")}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "corporate"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Corporate Identity
          </button>

          <button
            onClick={() => setActiveTab("branches")}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "branches"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 shrink-0" />
              Address & Branches
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {profile?.branches?.length || 1}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("statutory")}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "statutory"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            Tax & Statutory (GST)
          </button>

          <button
            onClick={() => setActiveTab("banking")}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "banking"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <Landmark className="w-4 h-4 shrink-0" />
              Banking Coordinates
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {profile?.bank_accounts?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("branding")}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "branding"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileBadge className="w-4 h-4 shrink-0" />
            Branding & Documents
          </button>

          <button
            onClick={() => setActiveTab("localization")}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "localization"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            Regional & Localization
          </button>

          <div className="border-t border-slate-800/80 my-2" />

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            Change History
          </button>

          {/* Quick Context Card */}
          <div className="mt-auto p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
            <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Dynamic Resolution
            </div>
            Changes here propagate directly to invoices, POS receipts, Purchase Orders, and statutory PDF generators.
          </div>
        </div>

        {/* Form Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-xs font-medium">Hydrating corporate identity from PostgreSQL...</span>
            </div>
          ) : !profile ? (
            <div className="p-8 text-center text-rose-400 text-sm">
              Failed to load profile. Please verify backend database connectivity.
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* TAB 1: CORPORATE IDENTITY */}
              {activeTab === "corporate" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-400" />
                      Legal & Commercial Corporate Identity
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Statutory registration parameters registered with the Ministry of Corporate Affairs and Tax Authorities.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Legal Registered Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={profile.legal_name || ""}
                        onChange={(e) => updateField("legal_name", e.target.value)}
                        placeholder="e.g., Tattly Threads Private Limited"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden transition"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Must match certificate of incorporation. Printed on formal tax invoices and contracts.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Trade / Brand Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={profile.trade_name || ""}
                        onChange={(e) => updateField("trade_name", e.target.value)}
                        placeholder="e.g., Tattly Threads Retail"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden transition"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Customer-facing store branding used across POS display and thermal receipts.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Business Structure / Entity Type
                      </label>
                      <select
                        value={profile.business_type || "Private Limited"}
                        onChange={(e) => updateField("business_type", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                      >
                        <option value="Private Limited">Private Limited Company (Pvt Ltd)</option>
                        <option value="Public Limited">Public Limited Company (Ltd)</option>
                        <option value="LLP">Limited Liability Partnership (LLP)</option>
                        <option value="Partnership">Partnership Firm</option>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                        <option value="One Person Company">One Person Company (OPC)</option>
                        <option value="Society / Trust">Society / Trust / Section 8</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Corporate Identity Number (CIN)
                      </label>
                      <input
                        type="text"
                        value={profile.cin || ""}
                        onChange={(e) => updateField("cin", e.target.value.toUpperCase())}
                        placeholder="e.g., U74999MH2021PTC123456"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white placeholder-slate-500 outline-hidden uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Official Telephone / Mobile
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={profile.phone || ""}
                          onChange={(e) => updateField("phone", e.target.value)}
                          placeholder="+91 98200 12345"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Official Corporate Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          value={profile.email || ""}
                          onChange={(e) => updateField("email", e.target.value)}
                          placeholder="corporate@tattlythreads.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Official Corporate Website
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                          type="url"
                          value={profile.website || ""}
                          onChange={(e) => updateField("website", e.target.value)}
                          placeholder="https://www.tattlythreads.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Primary Key Executive / Contact Person
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={profile.contact_person || ""}
                          onChange={(e) => updateField("contact_person", e.target.value)}
                          placeholder="Priya Sharma (Director / Head of Finance)"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADDRESS & BRANCHES */}
              {activeTab === "branches" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-400" />
                      Headquarters & Multi-Branch Network
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure corporate headquarters and operating store / fulfillment branch locations.
                    </p>
                  </div>

                  {/* Primary Registered Address */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Corporate Headquarters Registered Address
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Address Line 1 (Building, Suite, Street)
                        </label>
                        <input
                          type="text"
                          value={profile.address_line1 || ""}
                          onChange={(e) => updateField("address_line1", e.target.value)}
                          placeholder="Unit 402, Trade World B-Wing, Kamala Mills Compound, Senapati Bapat Marg"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Address Line 2 (Landmark, Area)
                        </label>
                        <input
                          type="text"
                          value={profile.address_line2 || ""}
                          onChange={(e) => updateField("address_line2", e.target.value)}
                          placeholder="Lower Parel"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
                        <input
                          type="text"
                          value={profile.city || ""}
                          onChange={(e) => updateField("city", e.target.value)}
                          placeholder="Mumbai"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">State</label>
                        <input
                          type="text"
                          value={profile.state || ""}
                          onChange={(e) => updateField("state", e.target.value)}
                          placeholder="Maharashtra"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          State Code (2-Digit GST)
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={profile.state_code || ""}
                          onChange={(e) => updateField("state_code", e.target.value)}
                          placeholder="27"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">PIN / Postal Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={profile.pincode || ""}
                          onChange={(e) => updateField("pincode", e.target.value)}
                          placeholder="400013"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branch Network List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Operating Branches & Stores ({profile.branches?.length || 0})
                      </h3>
                      <button
                        onClick={() =>
                          setActiveBranchModal({
                            branch_code: `BR-00${(profile.branches?.length || 0) + 1}`,
                            name: "",
                            city: profile.city || "",
                            state: profile.state || "",
                            state_code: profile.state_code || "",
                            is_active: true,
                            is_default: false,
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add New Branch
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(profile.branches || []).map((br) => (
                        <div
                          key={br.branch_code}
                          className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{br.name || "Untitled Branch"}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                {br.branch_code}
                              </span>
                              {br.is_default && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  Default HQ
                                </span>
                              )}
                              {br.is_active ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-4">
                              <span>
                                {br.city}, {br.state} {br.pincode}
                              </span>
                              {br.gstin && <span className="font-mono text-slate-500">GSTIN: {br.gstin}</span>}
                              {br.phone && <span>{br.phone}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActiveBranchModal(br)}
                              className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              Edit
                            </button>
                            {!br.is_default && (
                              <button
                                onClick={() => handleDeleteBranch(br.branch_code)}
                                className="p-1 text-slate-500 hover:text-rose-400"
                                title="Delete Branch"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TAX & STATUTORY */}
              {activeTab === "statutory" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-indigo-400" />
                      Taxation, GST & Statutory Compliance
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Strict statutory tax configurations adhering to the Goods and Services Tax Network (GSTN).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        GST Identification Number (GSTIN) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={profile.gst_number || ""}
                        onChange={(e) => updateField("gst_number", e.target.value)}
                        placeholder="27AAXFT2508H1ZR"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs font-mono font-bold text-white tracking-wider outline-hidden uppercase"
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>Format: 27 (State) + 10-char PAN + Entity + Z + Checksum</span>
                        <span className="font-mono text-indigo-400">{profile.gst_number?.length || 0}/15</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Permanent Account Number (PAN) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={profile.pan || ""}
                        onChange={(e) => updateField("pan", e.target.value)}
                        placeholder="AAXFT2508H"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs font-mono font-bold text-white tracking-wider outline-hidden uppercase"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Auto-extracted from GSTIN characters 3 through 12.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">GST Scheme Type</label>
                      <select
                        value={profile.gst_scheme || "REGULAR"}
                        onChange={(e) => updateField("gst_scheme", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-hidden"
                      >
                        <option value="REGULAR">Regular GST Taxpayer</option>
                        <option value="COMPOSITION">Composition Scheme (Section 10)</option>
                        <option value="SEZ_UNIT">Special Economic Zone (SEZ) Unit</option>
                        <option value="SEZ_DEVELOPER">SEZ Developer</option>
                        <option value="EXEMPTED">Exempted / Non-GST Entity</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        MSME / Udyam Registration Number
                      </label>
                      <input
                        type="text"
                        value={profile.msme_reg_no || ""}
                        onChange={(e) => updateField("msme_reg_no", e.target.value.toUpperCase())}
                        placeholder="UDYAM-MH-01-0012345"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white placeholder-slate-500 outline-hidden uppercase"
                      />
                    </div>

                    <div className="col-span-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Default Reverse Charge Mechanism (RCM)</div>
                        <div className="text-[11px] text-slate-400">
                          Automatically mark newly generated sales and purchase documents as subject to Reverse Charge.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(profile.reverse_charge_applicable)}
                          onChange={(e) => updateField("reverse_charge_applicable", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BANKING COORDINATES */}
              {activeTab === "banking" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-indigo-400" />
                      Corporate Banking & Payment Coordinates
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Authoritative bank account coordinates rendered onto Tax Invoices and Sales Orders for NEFT/RTGS settlement.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Bank Accounts ({profile.bank_accounts?.length || 0})
                    </h3>
                    <button
                      onClick={() =>
                        setActiveBankModal({
                          bank_name: "",
                          account_holder_name: profile.legal_name || profile.name || "",
                          account_no: "",
                          account_type: "Current",
                          ifsc: "",
                          branch: "",
                          upi_id: "",
                          is_default: (profile.bank_accounts?.length || 0) === 0,
                          is_active: true,
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Bank Account
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(profile.bank_accounts || []).map((acc) => (
                      <div
                        key={acc.account_no}
                        className={`p-5 rounded-2xl border transition ${
                          acc.is_default
                            ? "bg-indigo-950/20 border-indigo-500/50 ring-1 ring-indigo-500/30"
                            : "bg-slate-900 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400">
                              <Landmark className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-xs text-white flex items-center gap-2">
                                {acc.bank_name || "Untitled Bank"}
                                {acc.is_default && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white shadow-xs">
                                    Primary Invoice Default
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {acc.branch || "Branch Unspecified"} • {acc.account_type || "Current Account"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!acc.is_default && (
                              <button
                                onClick={() => setDefaultBank(acc.account_no)}
                                className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
                              >
                                Set as Default
                              </button>
                            )}
                            <button
                              onClick={() => setActiveBankModal(acc)}
                              className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              Edit
                            </button>
                            {profile.bank_accounts.length > 1 && (
                              <button
                                onClick={() => handleDeleteBank(acc.account_no)}
                                className="p-1 text-slate-500 hover:text-rose-400"
                                title="Delete Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-xs font-mono pt-3 border-t border-slate-800/80">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">Account No</div>
                            <div className="text-white font-bold tracking-wider">{acc.account_no}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">IFSC Code</div>
                            <div className="text-indigo-300 font-bold tracking-wider">{acc.ifsc}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">Beneficiary Name</div>
                            <div className="text-slate-200 truncate">{acc.account_holder_name || profile.name}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase font-sans">UPI ID / VPA</div>
                            <div className="text-emerald-400">{acc.upi_id || "None"}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: BRANDING & DOCUMENTS */}
              {activeTab === "branding" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <FileBadge className="w-5 h-5 text-indigo-400" />
                      Document Branding, Logos & Authorizations
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure corporate logos, digital signatures, and standardized contractual terms rendered on outputs.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Primary Color Logo */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Primary Full-Color Corporate Logo URL
                      </label>
                      <input
                        type="text"
                        value={profile.logo_url || ""}
                        onChange={(e) => updateField("logo_url", e.target.value)}
                        placeholder="/tattly_logo_black.png or https://..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-hidden"
                      />
                      <div className="h-28 rounded-lg bg-slate-950/70 border border-dashed border-slate-800 flex items-center justify-center overflow-hidden p-2">
                        {profile.logo_url ? (
                          <img
                            src={profile.logo_url}
                            alt="Logo Preview"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/tattly_logo_black.png";
                            }}
                          />
                        ) : (
                          <span className="text-xs text-slate-600">No logo specified</span>
                        )}
                      </div>
                    </div>

                    {/* Print Monochrome Logo */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Print Monochrome / High-Contrast Logo URL
                      </label>
                      <input
                        type="text"
                        value={profile.print_logo_url || ""}
                        onChange={(e) => updateField("print_logo_url", e.target.value)}
                        placeholder="/tattly_logo_black.png or https://..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-hidden"
                      />
                      <div className="h-28 rounded-lg bg-white border border-dashed border-slate-300 flex items-center justify-center overflow-hidden p-2">
                        {profile.print_logo_url || profile.logo_url ? (
                          <img
                            src={profile.print_logo_url || profile.logo_url}
                            alt="Print Preview"
                            className="max-h-full max-w-full object-contain filter grayscale"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/tattly_logo_black.png";
                            }}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">High contrast preview on paper</span>
                        )}
                      </div>
                    </div>

                    {/* Digital Signature */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Authorized Signatory Signature Image URL
                      </label>
                      <input
                        type="text"
                        value={profile.signature_url || ""}
                        onChange={(e) => updateField("signature_url", e.target.value)}
                        placeholder="/signatures/director_sig.png"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-hidden"
                      />
                      <div className="h-20 rounded-lg bg-white/90 border border-slate-300 flex items-center justify-center overflow-hidden p-2">
                        {profile.signature_url ? (
                          <img
                            src={profile.signature_url}
                            alt="Signature"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-500 italic">No signature file linked</span>
                        )}
                      </div>
                    </div>

                    {/* Official Seal / Stamp */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Official Company Seal / Stamp Image URL
                      </label>
                      <input
                        type="text"
                        value={profile.stamp_url || ""}
                        onChange={(e) => updateField("stamp_url", e.target.value)}
                        placeholder="/stamps/official_seal.png"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-hidden"
                      />
                      <div className="h-20 rounded-lg bg-white/90 border border-slate-300 flex items-center justify-center overflow-hidden p-2">
                        {profile.stamp_url ? (
                          <img
                            src={profile.stamp_url}
                            alt="Stamp"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-slate-500 italic">No official seal linked</span>
                        )}
                      </div>
                    </div>

                    {/* Signatory Text Details */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Authorized Signatory Name
                      </label>
                      <input
                        type="text"
                        value={profile.signatory_name || ""}
                        onChange={(e) => updateField("signatory_name", e.target.value)}
                        placeholder="Priya Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Signatory Designation
                      </label>
                      <input
                        type="text"
                        value={profile.signatory_designation || ""}
                        onChange={(e) => updateField("signatory_designation", e.target.value)}
                        placeholder="Director / Authorized Signatory"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      />
                    </div>

                    {/* Invoice Terms */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Default Invoice Statutory Terms & Conditions
                      </label>
                      <textarea
                        rows={3}
                        value={profile.invoice_terms || ""}
                        onChange={(e) => updateField("invoice_terms", e.target.value)}
                        placeholder="1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged if payment is delayed beyond credit period. 3. Subject to local jurisdiction only."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: REGIONAL & LOCALIZATION */}
              {activeTab === "localization" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-indigo-400" />
                      Regional, Currency & Formatting Localization
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure base accounting currency, timezone, financial year, and decimal conventions.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Base Operating Currency
                      </label>
                      <select
                        value={profile.currency_code || "INR"}
                        onChange={(e) => updateField("currency_code", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono outline-hidden"
                      >
                        <option value="INR">INR — Indian Rupee (₹)</option>
                        <option value="USD">USD — US Dollar ($)</option>
                        <option value="EUR">EUR — Euro (€)</option>
                        <option value="GBP">GBP — British Pound (£)</option>
                        <option value="AED">AED — UAE Dirham</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Operating Timezone</label>
                      <select
                        value={profile.timezone || "Asia/Kolkata"}
                        onChange={(e) => updateField("timezone", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST — UTC+05:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST — UTC+04:00)</option>
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Number Grouping Format
                      </label>
                      <select
                        value={profile.number_format || "INDIAN"}
                        onChange={(e) => updateField("number_format", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      >
                        <option value="INDIAN">Indian Numbering System (Lakhs & Crores: 12,34,567.89)</option>
                        <option value="INTERNATIONAL">International Numbering System (Millions: 1,234,567.89)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Standard Date Format</label>
                      <select
                        value={profile.date_format || "DD/MM/YYYY"}
                        onChange={(e) => updateField("date_format", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono outline-hidden"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 18/10/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                        <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 18-Oct-2026)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Financial Year Cycle Start
                      </label>
                      <select
                        value={profile.financial_year_start || "04-01"}
                        onChange={(e) => updateField("financial_year_start", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      >
                        <option value="04-01">April 1st (Indian Standard FY)</option>
                        <option value="01-01">January 1st (Calendar Year)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Currency Decimal Precision
                      </label>
                      <select
                        value={profile.currency_decimals ?? 2}
                        onChange={(e) => updateField("currency_decimals", parseInt(e.target.value, 10))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-hidden"
                      >
                        <option value="2">2 Decimals (Standard paise / cents: 0.00)</option>
                        <option value="0">0 Decimals (Whole units)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: CHANGE HISTORY */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-400" />
                      Cryptographic Audit Trail & Version Lineage
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Immutable record of all corporate identity modifications with SHA-256 chain verification.
                    </p>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                      No prior profile mutations recorded. Every update is tracked with cryptographic verification.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{log.action}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-semibold text-indigo-400">
                                By: {log.changed_by}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300">{log.summary}</div>
                            {log.hash_signature && (
                              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                Hash: {log.hash_signature.slice(0, 16)}...
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
          )}
        </div>
      </div>

      {/* Branch Edit Modal */}
      {activeBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">Branch Location Details</h3>
              <button
                onClick={() => setActiveBranchModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Branch Code</label>
                <input
                  type="text"
                  value={activeBranchModal.branch_code}
                  onChange={(e) =>
                    setActiveBranchModal({ ...activeBranchModal, branch_code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={activeBranchModal.name}
                  onChange={(e) => setActiveBranchModal({ ...activeBranchModal, name: e.target.value })}
                  placeholder="e.g., Bandra West Flagship Store"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Address</label>
                <input
                  type="text"
                  value={activeBranchModal.address_line1 || ""}
                  onChange={(e) => setActiveBranchModal({ ...activeBranchModal, address_line1: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">City</label>
                <input
                  type="text"
                  value={activeBranchModal.city || ""}
                  onChange={(e) => setActiveBranchModal({ ...activeBranchModal, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Pincode</label>
                <input
                  type="text"
                  value={activeBranchModal.pincode || ""}
                  onChange={(e) => setActiveBranchModal({ ...activeBranchModal, pincode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Branch-Specific GSTIN (optional)</label>
                <input
                  type="text"
                  value={activeBranchModal.gstin || ""}
                  onChange={(e) => setActiveBranchModal({ ...activeBranchModal, gstin: e.target.value.toUpperCase() })}
                  placeholder="Leave blank to use Corporate GSTIN"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveBranchModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveBranch(activeBranchModal)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white"
              >
                Apply Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Account Edit Modal */}
      {activeBankModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">Bank Account Details</h3>
              <button
                onClick={() => setActiveBankModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={activeBankModal.bank_name}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, bank_name: e.target.value })}
                  placeholder="e.g., STATE BANK OF INDIA"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Account Number</label>
                <input
                  type="text"
                  value={activeBankModal.account_no}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, account_no: e.target.value })}
                  placeholder="43976711765"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">IFSC Code (11 chars)</label>
                <input
                  type="text"
                  maxLength={11}
                  value={activeBankModal.ifsc}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, ifsc: e.target.value.toUpperCase() })}
                  placeholder="SBIN0030425"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={activeBankModal.branch || ""}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, branch: e.target.value })}
                  placeholder="WARDHMAN NAGAR"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Account Type</label>
                <select
                  value={activeBankModal.account_type || "Current"}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, account_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Current">Current Account</option>
                  <option value="Cash Credit">Cash Credit / Overdraft</option>
                  <option value="Savings">Savings Account</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">UPI ID / VPA</label>
                <input
                  type="text"
                  value={activeBankModal.upi_id || ""}
                  onChange={(e) => setActiveBankModal({ ...activeBankModal, upi_id: e.target.value })}
                  placeholder="merchant@sbi"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="col-span-2 pt-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeBankModal.is_default}
                    onChange={(e) => setActiveBankModal({ ...activeBankModal, is_default: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <span>Set as default account for invoices & commercial documents</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveBankModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveBank(activeBankModal)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white"
              >
                Apply Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
