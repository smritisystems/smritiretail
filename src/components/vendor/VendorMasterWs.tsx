/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Vendor 360 Workspace (Universal Party System of Record)
 */

import React, { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Save, 
  RotateCcw, 
  GitMerge, 
  ShieldCheck, 
  CreditCard, 
  Users, 
  MapPin, 
  Clock, 
  Award, 
  Package, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Filter,
  Printer,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from "lucide-react";
import { 
  VendorSummary, 
  VendorDetail, 
  VendorStatus, 
  CommercialClassification,
  VendorAddress,
  VendorContact,
  VendorBankAccount 
} from "../../types/vendor";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import { withCapability } from "../../types/architecture";
import { VendorOverviewTab } from "./tabs/VendorOverviewTab";
import { VendorIdentityTab } from "./tabs/VendorIdentityTab";
import { VendorAddressTab } from "./tabs/VendorAddressTab";
import { VendorContactTab } from "./tabs/VendorContactTab";
import { VendorCommercialTab } from "./tabs/VendorCommercialTab";
import { VendorBankingTab } from "./tabs/VendorBankingTab";
import { VendorProcurementTab } from "./tabs/VendorProcurementTab";
import { VendorPayablesTab } from "./tabs/VendorPayablesTab";
import { VendorScorecardTab } from "./tabs/VendorScorecardTab";
import { VendorMergeModal } from "./tabs/VendorMergeModal";
import { VendorPrintModal } from "./VendorPrintModal";

export interface VendorMasterWsProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

type TabKey = 
  | "overview" 
  | "identity" 
  | "addresses" 
  | "contacts" 
  | "commercial" 
  | "banking" 
  | "procurement" 
  | "payables" 
  | "scorecard";

const STATUS_CHIPS: Record<VendorStatus, { bg: string; text: string; border: string }> = {
  ACTIVE:               { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  INACTIVE:             { bg: "bg-slate-500/10",   text: "text-slate-400",   border: "border-slate-500/30" },
  BLOCKED:              { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30" },
  ON_HOLD:              { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30" },
  PENDING_VERIFICATION: { bg: "bg-sky-500/10",     text: "text-sky-400",     border: "border-sky-500/30" },
  ARCHIVED:             { bg: "bg-slate-700/20",   text: "text-slate-400",   border: "border-slate-700/30" },
  MERGED:               { bg: "bg-purple-500/10",  text: "text-purple-400",  border: "border-purple-500/30" },
};

const CLASSIFICATION_CHIPS: Record<CommercialClassification, { bg: string; text: string }> = {
  PREFERRED:   { bg: "bg-indigo-500/20", text: "text-indigo-300" },
  APPROVED:    { bg: "bg-teal-500/20",   text: "text-teal-300" },
  CONDITIONAL: { bg: "bg-amber-500/20",  text: "text-amber-300" },
  RESTRICTED:  { bg: "bg-orange-500/20", text: "text-orange-300" },
  BLOCKED:     { bg: "bg-rose-500/20",   text: "text-rose-300" },
};

function normalizeVendorSummary(v: any): VendorSummary {
  return {
    id: v?.id || "",
    code: v?.code || "",
    legalName: v?.legalName || v?.legal_name || "Unnamed Vendor",
    tradeName: v?.tradeName || v?.trade_name || v?.legalName || v?.legal_name || "",
    gstin: v?.gstin || "",
    pan: v?.pan || "",
    mobile: v?.mobile || "",
    email: v?.email || "",
    city: v?.city || "",
    state: v?.state || "",
    status: v?.status || "ACTIVE",
    commercialClassification: v?.commercialClassification || v?.commercial_classification || "APPROVED",
    supplierType: v?.supplierType || v?.supplier_type || "DISTRIBUTOR",
    outstanding: Number(v?.outstanding ?? 0),
  };
}

function normalizeVendorDetail(v: any): VendorDetail {
  if (!v) return null as any;
  const comm = v.commercial || {};
  const comp = v.compliance || {};
  return {
    id: v.id || "",
    code: v.code || "",
    legalName: v.legalName || v.legal_name || "Unnamed Vendor",
    tradeName: v.tradeName || v.trade_name || v.legalName || v.legal_name || "",
    partyType: v.partyType || v.party_type || "ORGANIZATION",
    gstin: v.gstin || comp.gstin || "",
    pan: v.pan || comp.pan || "",
    email: v.email || "",
    phone: v.phone || "",
    mobile: v.mobile || "",
    addressLine1: v.addressLine1 || v.address_line1 || "",
    city: v.city || "",
    state: v.state || "",
    pincode: v.pincode || "",
    status: v.status || "ACTIVE",
    mergedIntoPartyId: v.mergedIntoPartyId || v.merged_into_party_id || null,
    legacySupplierId: v.legacySupplierId || v.legacy_supplier_id || null,
    commercial: {
      supplierType: comm.supplierType || comm.supplier_type || v.supplierType || v.supplier_type || "DISTRIBUTOR",
      paymentTermsDays: comm.paymentTermsDays ?? comm.payment_terms_days ?? 30,
      msmeRegistrationNo: comm.msmeRegistrationNo || comm.msme_registration_no || "",
      msmeCategory: comm.msmeCategory || comm.msme_category || "NOT_APPLICABLE",
      commercialClassification: comm.commercialClassification || comm.commercial_classification || v.commercialClassification || v.commercial_classification || "APPROVED",
      tdsSection: comm.tdsSection || comm.tds_section || "194Q",
      tdsRate: comm.tdsRate ?? comm.tds_rate ?? 0.1,
      taxTreatment: comm.taxTreatment || comm.tax_treatment || "REGISTERED_REGULAR",
      outstandingLiability: comm.outstandingLiability ?? comm.outstanding_liability ?? v.outstanding ?? 0,
    },
    compliance: {
      gstin: comp.gstin || v.gstin || "",
      pan: comp.pan || v.pan || "",
      msmeRegistrationNo: comp.msmeRegistrationNo || comp.msme_registration_no || comm.msmeRegistrationNo || comm.msme_registration_no || "",
      msmeCategory: comp.msmeCategory || comp.msme_category || comm.msmeCategory || comm.msme_category || "NOT_APPLICABLE",
      verificationFlags: {
        gstVerified: comp.verificationFlags?.gstVerified ?? comp.verification_flags?.gst_verified ?? comp.gstVerified ?? comp.gst_verified ?? !!(v.gstin || comp.gstin),
        panVerified: comp.verificationFlags?.panVerified ?? comp.verification_flags?.pan_verified ?? comp.panVerified ?? comp.pan_verified ?? !!(v.pan || comp.pan),
        bankVerified: comp.verificationFlags?.bankVerified ?? comp.verification_flags?.bank_verified ?? comp.bankVerified ?? comp.bank_verified ?? false,
        msmeVerified: comp.verificationFlags?.msmeVerified ?? comp.verification_flags?.msme_verified ?? comp.msmeVerified ?? comp.msme_verified ?? false,
      },
    },
    contacts: Array.isArray(v.contacts)
      ? v.contacts.map((c: any) => ({
          id: c.id,
          contactName: c.contactName || c.contact_name || "",
          contactCategory: c.contactCategory || c.contact_category || "GENERAL",
          designation: c.designation || "",
          department: c.department || "",
          phone: c.phone || "",
          mobile: c.mobile || "",
          email: c.email || "",
          isPrimary: Boolean(c.isPrimary ?? c.is_primary),
        }))
      : [],
    addresses: Array.isArray(v.addresses)
      ? v.addresses.map((a: any) => ({
          id: a.id,
          addressType: a.addressType || a.address_type || "BILLING",
          addressTitle: a.addressTitle || a.address_title || "",
          addressLine1: a.addressLine1 || a.address_line1 || "",
          addressLine2: a.addressLine2 || a.address_line2 || "",
          city: a.city || "",
          state: a.state || "",
          stateCode: a.stateCode || a.state_code || "",
          pincode: a.pincode || "",
          country: a.country || "India",
          gstin: a.gstin || "",
          isPrimary: Boolean(a.isPrimary ?? a.is_primary),
        }))
      : [],
    bankAccounts: Array.isArray(v.bankAccounts || v.bank_accounts)
      ? (v.bankAccounts || v.bank_accounts).map((b: any) => ({
          id: b.id,
          bankName: b.bankName || b.bank_name || "",
          accountHolderName: b.accountHolderName || b.account_holder_name || "",
          accountNumber: b.accountNumber || b.account_number || "",
          ifsc: b.ifsc || "",
          branch: b.branch || "",
          accountType: b.accountType || b.account_type || "CURRENT",
          isPrimary: Boolean(b.isPrimary ?? b.is_primary),
          verificationStatus: b.verificationStatus || b.verification_status || "PENDING",
          verifiedAt: b.verifiedAt || b.verified_at,
        }))
      : [],
    roles: Array.isArray(v.roles) ? v.roles : ["SUPPLIER"],
    tags: Array.isArray(v.tags) ? v.tags : [],
  };
}

const VendorMasterWsBase: React.FC<VendorMasterWsProps> = ({ currentUser, onNotification }) => {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printWithData, setPrintWithData] = useState(true);
  const [showPrintDropdown, setShowPrintDropdown] = useState(false);

  // New Vendor Form State
  const [newForm, setNewForm] = useState({
    legalName: "",
    tradeName: "",
    gstin: "",
    pan: "",
    mobile: "",
    email: "",
    city: "",
    state: "",
    supplierType: "DISTRIBUTOR",
    paymentTermsDays: 30,
  });

  // Load Vendor Directory
  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetchV1("/purchase/vendors/");
      const rawList = Array.isArray(res) ? res : [];
      const list = rawList.map(normalizeVendorSummary);
      setVendors(list);
      if (list.length > 0 && !selectedVendorId) {
        setSelectedVendorId(list[0].id);
      }
    } catch (err: any) {
      onNotification?.("Failed to Load", err?.message || "Could not retrieve vendor directory.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedVendorId, onNotification]);

  useEffect(() => {
    loadVendors();
  }, []);

  // Load Selected Vendor Detail
  useEffect(() => {
    if (!selectedVendorId) return;
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const detail = await apiFetchV1(`/purchase/vendors/${selectedVendorId}`);
        setSelectedVendor(normalizeVendorDetail(detail));
        setIsEditing(false);
      } catch (err: any) {
        onNotification?.("Error", err?.message || "Failed to load vendor details.", "error");
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedVendorId, onNotification]);

  // Handle Local Field Change
  const handleFieldChange = (field: string, value: any) => {
    if (!selectedVendor) return;
    if (field.startsWith("commercial.")) {
      const sub = field.split(".")[1];
      setSelectedVendor({
        ...selectedVendor,
        commercial: { ...selectedVendor.commercial, [sub]: value },
      });
    } else {
      setSelectedVendor({
        ...selectedVendor,
        [field]: value,
      });
    }
  };

  // Save Updates
  const handleSave = async () => {
    if (!selectedVendor) return;
    setSaving(true);
    try {
      const payload = {
        legalName: selectedVendor.legalName,
        tradeName: selectedVendor.tradeName,
        gstin: selectedVendor.gstin,
        pan: selectedVendor.pan,
        email: selectedVendor.email,
        mobile: selectedVendor.mobile,
        phone: selectedVendor.phone,
        status: selectedVendor.status,
        addressLine1: selectedVendor.addressLine1,
        city: selectedVendor.city,
        state: selectedVendor.state,
        pincode: selectedVendor.pincode,
        commercial: selectedVendor.commercial,
        addresses: selectedVendor.addresses,
        contacts: selectedVendor.contacts,
        bankAccounts: selectedVendor.bankAccounts,
      };

      const updated = await apiFetchV1(`/purchase/vendors/${selectedVendor.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const normUpdated = normalizeVendorDetail(updated);
      setSelectedVendor(normUpdated);
      setIsEditing(false);
      onNotification?.("Vendor Updated", `Successfully saved changes for ${normUpdated.legalName}.`, "success");
      loadVendors();
    } catch (err: any) {
      onNotification?.("Save Error", err?.message || "Failed to update vendor.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Rapid Vendor Creation
  const handleCreateVendor = async () => {
    if (!newForm.legalName) {
      onNotification?.("Required Field", "Please enter a legal vendor name.", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetchV1("/purchase/vendors/", {
        method: "POST",
        body: JSON.stringify({
          legal_name: newForm.legalName,
          trade_name: newForm.tradeName || newForm.legalName,
          gstin: newForm.gstin || null,
          pan: newForm.pan || null,
          mobile: newForm.mobile || null,
          email: newForm.email || null,
          city: newForm.city || null,
          state: newForm.state || null,
          commercial: {
            supplier_type: newForm.supplierType,
            payment_terms_days: Number(newForm.paymentTermsDays) || 30,
          },
        }),
      });

      const normCreated = normalizeVendorDetail(created);
      onNotification?.("Vendor Created", `Added ${normCreated.legalName} to Universal Party Master.`, "success");
      setShowNewModal(false);
      setNewForm({
        legalName: "",
        tradeName: "",
        gstin: "",
        pan: "",
        mobile: "",
        email: "",
        city: "",
        state: "",
        supplierType: "DISTRIBUTOR",
        paymentTermsDays: 30,
      });
      await loadVendors();
      setSelectedVendorId(normCreated.id);
    } catch (err: any) {
      onNotification?.("Creation Failed", err?.message || "Could not create vendor.", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      v.legalName?.toLowerCase().includes(q) ||
      v.code?.toLowerCase().includes(q) ||
      v.gstin?.toLowerCase().includes(q) ||
      v.mobile?.toLowerCase().includes(q) ||
      v.city?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* ─────────────────── LEFT: VENDOR DIRECTORY LIST ─────────────────── */}
      <div className="w-80 border-r border-slate-800/80 bg-slate-900/50 flex flex-col shrink-0">
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 size={18} className="text-indigo-400" />
              <span className="font-black text-sm text-white tracking-tight">Vendors Directory</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => {
                  setPrintWithData(false);
                  setShowPrintModal(true);
                }}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center space-x-1"
                title="Print Blank Vendor KYC Onboarding Form"
              >
                <Printer size={13} className="text-indigo-400" />
                <span className="hidden sm:inline text-[11px]">Blank Form</span>
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow flex items-center space-x-1"
              >
                <Plus size={14} />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor, code, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Directory Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">Loading directory...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No vendors found.</div>
          ) : (
            filteredVendors.map((v) => {
              const isSelected = v.id === selectedVendorId;
              const statusChip = STATUS_CHIPS[v.status as VendorStatus] || STATUS_CHIPS.ACTIVE;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVendorId(v.id)}
                  className={`p-3.5 cursor-pointer transition flex flex-col space-y-1.5 ${
                    isSelected ? "bg-indigo-600/10 border-l-4 border-indigo-500" : "hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate max-w-[170px]">
                      {v.legalName}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${statusChip.bg} ${statusChip.text} ${statusChip.border}`}>
                      {v.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-[10px] text-slate-500">{v.code}</span>
                    <span className={`font-mono font-bold ${v.outstanding > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      ₹{v.outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {v.city && (
                    <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                      <MapPin size={10} />
                      <span>{v.city}{v.state ? `, ${v.state}` : ""}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────── RIGHT: VENDOR 360 WORKSPACE ─────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedVendor ? (
          <>
            {/* Top Command Toolbar */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-lg">
                  {selectedVendor.legalName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-black text-white">{selectedVendor.legalName}</h2>
                    <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {selectedVendor.code}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${STATUS_CHIPS[selectedVendor.status as VendorStatus]?.bg} ${STATUS_CHIPS[selectedVendor.status as VendorStatus]?.text} ${STATUS_CHIPS[selectedVendor.status as VendorStatus]?.border}`}>
                      {selectedVendor.status}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${CLASSIFICATION_CHIPS[selectedVendor.commercial?.commercialClassification as CommercialClassification]?.bg}`}>
                      {selectedVendor.commercial?.commercialClassification}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                    <span>{selectedVendor.tradeName || selectedVendor.legalName}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedVendor.gstin || "No GSTIN"}</span>
                    <span>•</span>
                    <span className="font-mono">PAN: {selectedVendor.pan || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {/* Print Form Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowPrintDropdown(!showPrintDropdown)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
                    title="Print Vendor Form (With or Without Data)"
                  >
                    <Printer size={14} className="text-indigo-400" />
                    <span>Print Form</span>
                    <ChevronDown size={12} className="text-slate-400" />
                  </button>

                  {showPrintDropdown && (
                    <div 
                      className="absolute right-0 mt-1.5 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 text-xs divide-y divide-slate-800"
                      onMouseLeave={() => setShowPrintDropdown(false)}
                    >
                      <button
                        onClick={() => {
                          setShowPrintDropdown(false);
                          setPrintWithData(true);
                          setShowPrintModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-600/20 hover:text-indigo-300 flex items-start space-x-2.5 text-slate-200 transition"
                      >
                        <FileText size={15} className="text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-bold text-white flex items-center space-x-1.5">
                            <span>Print with Data</span>
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">Dossier</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Full KYC profile with statutory, banking & contact details for {selectedVendor.code}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowPrintDropdown(false);
                          setPrintWithData(false);
                          setShowPrintModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-600/20 hover:text-indigo-300 flex items-start space-x-2.5 text-slate-200 transition"
                      >
                        <FileSpreadsheet size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-bold text-white flex items-center space-x-1.5">
                            <span>Print without Data</span>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">Blank KYC</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Clean blank vendor registration form for offline onboarding & physical submission
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowMergeModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <GitMerge size={14} />
                  <span>Merge Entity</span>
                </button>

                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow flex items-center space-x-1.5"
                    >
                      <Save size={14} />
                      <span>{saving ? "Saving..." : "Save Changes"}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-semibold"
                  >
                    Edit Vendor
                  </button>
                )}
              </div>
            </div>

            {/* 9-Tab Navigation Bar */}
            <div className="flex items-center space-x-1 px-5 border-b border-slate-800 bg-slate-900/20 overflow-x-auto text-xs font-semibold">
              {[
                { id: "overview", label: "Overview", icon: <Building2 size={13} /> },
                { id: "identity", label: "Statutory & Tax", icon: <ShieldCheck size={13} /> },
                { id: "addresses", label: "Addresses & Godowns", icon: <MapPin size={13} /> },
                { id: "contacts", label: "Key Contacts", icon: <Users size={13} /> },
                { id: "commercial", label: "Commercial Terms", icon: <Clock size={13} /> },
                { id: "banking", label: "Disbursement Banks", icon: <CreditCard size={13} /> },
                { id: "procurement", label: "Purchase Orders", icon: <Package size={13} /> },
                { id: "payables", label: "Payables & Aging", icon: <DollarSign size={13} /> },
                { id: "scorecard", label: "SLA & Scorecard", icon: <Award size={13} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={`py-3 px-3.5 flex items-center space-x-1.5 border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Body Viewport */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="p-12 text-center text-xs text-slate-500">Refreshing vendor details...</div>
              ) : (
                <>
                  {activeTab === "overview" && (
                    <VendorOverviewTab
                      vendor={selectedVendor}
                      onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
                    />
                  )}
                  {activeTab === "identity" && (
                    <VendorIdentityTab
                      vendor={selectedVendor}
                      onChange={handleFieldChange}
                      isEditing={isEditing}
                    />
                  )}
                  {activeTab === "addresses" && (
                    <VendorAddressTab
                      vendor={selectedVendor}
                      onUpdateAddresses={(addrs) => setSelectedVendor({ ...selectedVendor, addresses: addrs })}
                      isEditing={isEditing}
                    />
                  )}
                  {activeTab === "contacts" && (
                    <VendorContactTab
                      vendor={selectedVendor}
                      onUpdateContacts={(cnts) => setSelectedVendor({ ...selectedVendor, contacts: cnts })}
                      isEditing={isEditing}
                    />
                  )}
                  {activeTab === "commercial" && (
                    <VendorCommercialTab
                      vendor={selectedVendor}
                      onChangeCommercial={(f, v) => handleFieldChange(`commercial.${f}`, v)}
                      isEditing={isEditing}
                    />
                  )}
                  {activeTab === "banking" && (
                    <VendorBankingTab
                      vendor={selectedVendor}
                      onUpdateBanks={(banks) => setSelectedVendor({ ...selectedVendor, bankAccounts: banks })}
                      isEditing={isEditing}
                    />
                  )}
                  {activeTab === "procurement" && (
                    <VendorProcurementTab vendor={selectedVendor} />
                  )}
                  {activeTab === "payables" && (
                    <VendorPayablesTab vendor={selectedVendor} />
                  )}
                  {activeTab === "scorecard" && (
                    <VendorScorecardTab vendor={selectedVendor} />
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select a vendor from the directory or create a new vendor.
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {showMergeModal && selectedVendor && (
        <VendorMergeModal
          currentVendorId={selectedVendor.id}
          vendorsList={vendors}
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMergedSuccess={() => {
            loadVendors();
            setSelectedVendorId(selectedVendor.id);
          }}
          onNotification={onNotification}
        />
      )}

      {/* Universal Vendor Print & Export Modal */}
      <VendorPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        vendor={selectedVendor}
        initialWithData={printWithData}
      />

      {/* Rapid Onboarding Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Building2 className="text-indigo-400" size={18} />
              <span>Rapid Vendor Onboarding (Universal Party)</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Legal Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Textile Mills Pvt Ltd"
                  value={newForm.legalName}
                  onChange={(e) => setNewForm({ ...newForm, legalName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Trade / Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Fabrics"
                  value={newForm.tradeName}
                  onChange={(e) => setNewForm({ ...newForm, tradeName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="27AABCA1234A1Z5"
                    value={newForm.gstin}
                    onChange={(e) => setNewForm({ ...newForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="AABCA1234A"
                    value={newForm.pan}
                    onChange={(e) => setNewForm({ ...newForm, pan: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Contact Mobile</label>
                  <input
                    type="text"
                    placeholder="10-digit mobile"
                    value={newForm.mobile}
                    onChange={(e) => setNewForm({ ...newForm, mobile: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="accounts@acmefabrics.com"
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={newForm.city}
                    onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={newForm.paymentTermsDays}
                    onChange={(e) => setNewForm({ ...newForm, paymentTermsDays: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVendor}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
              >
                {saving ? "Creating..." : "Create Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VendorMasterWs = withCapability(VendorMasterWsBase, {
  entity: "vendor",
  capability: "vendor.workspace",
  role: "CANONICAL",
  description: "Enterprise Vendor 360 Master Workspace",
  decisionId: "ADR-VEND-01",
});

export default VendorMasterWs;

