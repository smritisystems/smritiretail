/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.6.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Customer Price Group Master Window
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  X, 
  Check, 
  RotateCcw, 
  Plus, 
  Edit3, 
  Trash2, 
  LogOut, 
  Layers, 
  CreditCard, 
  DollarSign, 
  Percent, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { CustomerPriceGroup } from "./types.ts";
import { 
  getCustomerPriceGroups, 
  saveCustomerPriceGroups, 
  addCustomerPriceGroup, 
  updateCustomerPriceGroup, 
  deleteCustomerPriceGroup 
} from "../../services/customerStore.ts";

export interface SmritiCustomerPriceGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGroupCode?: string;
  onSelectGroup?: (group: CustomerPriceGroup) => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const DEFAULT_FORM_STATE: CustomerPriceGroup = {
  id: "CPP",
  code: "CPP",
  description: "Platinum Privilege",
  paymentTerms: "PT",
  creditDays: 60,
  destTaxType: "Local",
  creditLimit: 500000,
  itemClassificationPriceFactorApplicable: true,
  allowCreditInvoice: true,
  allowCashInvoice: true,
  taxExclusiveInvoice: false,
  allowMiscIssue: false,
  status: "Active"
};

const PAYMENT_TERMS_OPTIONS = [
  { value: "PT", label: "PT (Standard Payment Terms)" },
  { value: "Net 15", label: "Net 15 (15 Days Credit)" },
  { value: "Net 30", label: "Net 30 (30 Days Credit)" },
  { value: "Net 45", label: "Net 45 (45 Days Credit)" },
  { value: "Net 60", label: "Net 60 (60 Days Credit)" },
  { value: "Net 90", label: "Net 90 (90 Days Credit)" },
  { value: "Immediate", label: "Immediate / Cash on Delivery (COD)" },
  { value: "PDC", label: "PDC (Post Dated Cheque)" },
  { value: "Advance", label: "100% Advance Payment" }
];

const DEST_TAX_TYPE_OPTIONS = [
  { value: "Local", label: "Local (Intra-State GST)" },
  { value: "Interstate", label: "Interstate (Inter-State IGST)" },
  { value: "Export", label: "Export (Zero Rated with LUT)" },
  { value: "SEZ (With Tax)", label: "SEZ (With Payment of Tax)" },
  { value: "SEZ (Without Tax)", label: "SEZ (Without Payment of Tax)" },
  { value: "Exempt", label: "Exempt / Non-GST" }
];

export const SmritiCustomerPriceGroupModal: React.FC<SmritiCustomerPriceGroupModalProps> = ({
  isOpen,
  onClose,
  selectedGroupCode,
  onSelectGroup,
  onNotification
}) => {
  const [groups, setGroups] = useState<CustomerPriceGroup[]>(() => getCustomerPriceGroups());
  const [selectedCode, setSelectedCode] = useState<string>(() => selectedGroupCode || "CPP");
  const [formData, setFormData] = useState<CustomerPriceGroup>(() => {
    const existing = groups.find(g => g.code.toUpperCase() === (selectedGroupCode || "CPP").toUpperCase());
    return existing || DEFAULT_FORM_STATE;
  });
  const [mode, setMode] = useState<"view" | "edit" | "add">("edit");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState<boolean>(true);

  // Reload groups when opened or on external store updates
  useEffect(() => {
    const refresh = () => {
      const current = getCustomerPriceGroups();
      setGroups(current);
    };
    window.addEventListener("smriti_customer_price_groups_updated", refresh);
    return () => window.removeEventListener("smriti_customer_price_groups_updated", refresh);
  }, []);

  // Sync formData when selection changes
  useEffect(() => {
    if (selectedCode) {
      const match = groups.find(g => g.code.toUpperCase() === selectedCode.toUpperCase());
      if (match) {
        setFormData(match);
        setMode("edit");
        setErrorMessage(null);
      }
    }
  }, [selectedCode, groups]);

  const handleFieldChange = (field: keyof CustomerPriceGroup, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleNumericChange = (field: "creditDays" | "creditLimit", rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    handleFieldChange(field, isNaN(num) ? 0 : num);
  };

  const handleStartAdd = () => {
    const newGroup: CustomerPriceGroup = {
      id: "",
      code: "",
      description: "",
      paymentTerms: "PT",
      creditDays: 30,
      destTaxType: "Local",
      creditLimit: 100000,
      itemClassificationPriceFactorApplicable: false,
      allowCreditInvoice: true,
      allowCashInvoice: true,
      taxExclusiveInvoice: false,
      allowMiscIssue: false,
      status: "Active"
    };
    setFormData(newGroup);
    setMode("add");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleCancel = () => {
    const match = groups.find(g => g.code.toUpperCase() === selectedCode.toUpperCase());
    if (match) {
      setFormData(match);
      setMode("edit");
    } else {
      setFormData(DEFAULT_FORM_STATE);
    }
    setErrorMessage(null);
    setSuccessMessage("Changes reverted.");
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleSave = () => {
    const trimmedCode = formData.code.trim().toUpperCase();
    const trimmedDesc = formData.description.trim();

    if (!trimmedCode) {
      setErrorMessage("Please enter a valid Customer Price Group Code.");
      return;
    }
    if (!trimmedDesc) {
      setErrorMessage("Please enter a meaningful Description for the entered code.");
      return;
    }

    const payload: CustomerPriceGroup = {
      ...formData,
      id: trimmedCode,
      code: trimmedCode,
      description: trimmedDesc,
      creditDays: Number(formData.creditDays) || 0,
      creditLimit: Number(formData.creditLimit) || 0
    };

    const updated = addCustomerPriceGroup(payload);
    setGroups(updated);
    setSelectedCode(trimmedCode);
    setMode("edit");
    setErrorMessage(null);
    setSuccessMessage(`Customer Price Group [${trimmedCode}] saved successfully.`);

    if (onSelectGroup) {
      onSelectGroup(payload);
    }
    if (onNotification) {
      onNotification("Customer Price Group Saved", `Price Group ${trimmedCode} - ${trimmedDesc} successfully updated.`, "success");
    }

    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDelete = () => {
    if (!selectedCode) return;
    if (confirm(`Are you sure you want to delete Customer Price Group [${selectedCode}]?`)) {
      const updated = deleteCustomerPriceGroup(selectedCode);
      setGroups(updated);
      const next = updated[0] || DEFAULT_FORM_STATE;
      setSelectedCode(next.code);
      setFormData(next);
      setSuccessMessage(`Customer Price Group [${selectedCode}] deleted.`);
      if (onNotification) {
        onNotification("Customer Price Group Deleted", `Price Group ${selectedCode} removed from catalogue.`, "info");
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Keyboard navigation & Shortcuts (Alt+O = Save, Alt+C = Cancel, Alt+A = Add, Alt+E = Edit, Alt+D = Delete, Alt+X/Escape = Exit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.altKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        handleSave();
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleCancel();
      } else if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleStartAdd();
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setMode("edit");
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDelete();
      } else if (e.altKey && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, formData, selectedCode, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#eef4f9] dark:bg-[#1b222d] rounded-lg shadow-2xl border-2 border-[#005a9e] dark:border-[#3884d8] flex flex-col overflow-hidden text-[#1e293b] dark:text-[#e2e8f0] font-sans"
        role="dialog"
        aria-labelledby="customer-price-group-title"
      >
        {/* Titlebar (Classic Windows Desktop Dialog Appearance with SMRITI Enterprise Theme) */}
        <div className="bg-linear-to-r from-[#005a9e] via-[#004578] to-[#002f52] dark:from-[#1e3a5f] dark:to-[#0f2038] text-white px-3 py-1.5 flex items-center justify-between select-none shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black tracking-wider px-1 py-0.5 bg-white/20 rounded-xs text-yellow-300 font-mono">
              SMRITI
            </span>
            <h2 id="customer-price-group-title" className="text-xs font-bold tracking-wide flex items-center gap-1.5">
              <Layers size={14} className="text-cyan-300" />
              Customer Price Group
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 px-2 py-0.5 rounded-xs transition text-xs font-bold"
            title="Exit [Alt+X / Esc]"
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>

        {/* Banner Messages */}
        {errorMessage && (
          <div className="bg-red-100 dark:bg-red-950/60 border-b border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
            <AlertCircle size={14} className="text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-100 dark:bg-emerald-950/60 border-b border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[80vh]">
          {/* Row 1: Code & Description */}
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
              <label htmlFor="cpg-code" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-14 shrink-0">
                <u>C</u>ode
              </label>
              <input
                id="cpg-code"
                type="text"
                maxLength={20}
                value={formData.code}
                onChange={e => handleFieldChange("code", e.target.value.toUpperCase())}
                placeholder="e.g. CPP"
                disabled={mode === "view"}
                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold uppercase bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e] focus:ring-1 focus:ring-[#005a9e]"
              />
            </div>

            <div className="col-span-12 sm:col-span-8 flex items-center gap-2">
              <label htmlFor="cpg-desc" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-24 shrink-0">
                <u>D</u>escription
              </label>
              <input
                id="cpg-desc"
                type="text"
                value={formData.description}
                onChange={e => handleFieldChange("description", e.target.value)}
                placeholder="e.g. Platinum Privilege"
                disabled={mode === "view"}
                className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e] focus:ring-1 focus:ring-[#005a9e]"
              />
            </div>
          </div>

          {/* Row 2: Payment Terms & Credit Days */}
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
              <label htmlFor="cpg-payment-terms" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-28 shrink-0">
                <u>P</u>ayment Terms
              </label>
              <select
                id="cpg-payment-terms"
                value={formData.paymentTerms}
                onChange={e => handleFieldChange("paymentTerms", e.target.value)}
                disabled={mode === "view"}
                className="flex-1 px-2 py-1 text-xs font-semibold bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e]"
              >
                {PAYMENT_TERMS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
              <label htmlFor="cpg-credit-days" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-24 shrink-0">
                Credit Da<u>y</u>s
              </label>
              <input
                id="cpg-credit-days"
                type="number"
                min="0"
                step="1"
                value={formData.creditDays}
                onChange={e => handleNumericChange("creditDays", e.target.value)}
                disabled={mode === "view"}
                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold text-right bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e]"
              />
            </div>
          </div>

          {/* Row 3: Dest. Tax Type & Credit Limit */}
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
              <label htmlFor="cpg-dest-tax" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-28 shrink-0">
                Des<u>t</u>. Tax Type
              </label>
              <select
                id="cpg-dest-tax"
                value={formData.destTaxType}
                onChange={e => handleFieldChange("destTaxType", e.target.value)}
                disabled={mode === "view"}
                className="flex-1 px-2 py-1 text-xs font-semibold bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e]"
              >
                {DEST_TAX_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
              <label htmlFor="cpg-credit-limit" className="text-xs font-bold text-[#1e293b] dark:text-[#cbd5e1] w-24 shrink-0">
                Credit <u>L</u>imit
              </label>
              <input
                id="cpg-credit-limit"
                type="number"
                min="0"
                step="1000"
                value={formData.creditLimit}
                onChange={e => handleNumericChange("creditLimit", e.target.value)}
                disabled={mode === "view"}
                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold text-right bg-white dark:bg-[#0f172a] border border-[#94a3b8] dark:border-[#475569] rounded-xs shadow-inner outline-none focus:border-[#005a9e]"
              />
            </div>
          </div>

          {/* Row 4: Item Classification-wise Price Factor Applicable Checkbox */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#00355f] dark:text-[#93c5fd] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.itemClassificationPriceFactorApplicable}
                onChange={e => handleFieldChange("itemClassificationPriceFactorApplicable", e.target.checked)}
                disabled={mode === "view"}
                className="w-4 h-4 rounded border-gray-400 text-[#005a9e] focus:ring-[#005a9e]"
              />
              <span>Item Classification-wise Price Factor Applicable</span>
            </label>
          </div>

          {/* Group Box: Transactions Allowed & Save/Cancel Action Cluster */}
          <div className="border border-[#94a3b8] dark:border-[#475569] rounded-xs p-3 relative mt-3 bg-white/50 dark:bg-black/20">
            <span className="absolute -top-2.5 left-3 bg-[#eef4f9] dark:bg-[#1b222d] px-1.5 text-[11px] font-bold text-[#005a9e] dark:text-[#60a5fa] uppercase tracking-wider">
              Transactions Allowed
            </span>

            <div className="grid grid-cols-12 gap-3 items-center">
              {/* Checkboxes Area */}
              <div className="col-span-12 sm:col-span-8 grid grid-cols-2 gap-y-2.5 gap-x-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.allowCreditInvoice}
                    onChange={e => handleFieldChange("allowCreditInvoice", e.target.checked)}
                    disabled={mode === "view"}
                    className="w-4 h-4 rounded border-gray-400 text-[#005a9e]"
                  />
                  <span>C<u>r</u>edit Invoice</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.allowCashInvoice}
                    onChange={e => handleFieldChange("allowCashInvoice", e.target.checked)}
                    disabled={mode === "view"}
                    className="w-4 h-4 rounded border-gray-400 text-[#005a9e]"
                  />
                  <span>Ca<u>s</u>h Invoice</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.taxExclusiveInvoice}
                    onChange={e => handleFieldChange("taxExclusiveInvoice", e.target.checked)}
                    disabled={mode === "view"}
                    className="w-4 h-4 rounded border-gray-400 text-[#005a9e]"
                  />
                  <span><u>T</u>ax Exclusive Invoice</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.allowMiscIssue}
                    onChange={e => handleFieldChange("allowMiscIssue", e.target.checked)}
                    disabled={mode === "view"}
                    className="w-4 h-4 rounded border-gray-400 text-[#005a9e]"
                  />
                  <span><u>M</u>isc. Issue (Goods Issue)</span>
                </label>
              </div>

              {/* Form Save/Cancel Buttons (matching desktop right cluster) */}
              <div className="col-span-12 sm:col-span-4 flex items-center justify-end gap-2 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] text-[#00355f] dark:text-[#93c5fd] border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5 focus:ring-2 focus:ring-[#005a9e]"
                >
                  <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span><u>O</u>k</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] text-[#475569] dark:text-[#cbd5e1] border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span><u>C</u>ancel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Catalogue Drawer / Table for rapid switching */}
          <div className="border border-[#cbd5e1] dark:border-[#334155] rounded-xs overflow-hidden bg-white dark:bg-[#0f172a]">
            <div 
              onClick={() => setShowCatalog(!showCatalog)}
              className="bg-[#e2e8f0] dark:bg-[#1e293b] px-3 py-1.5 flex justify-between items-center cursor-pointer select-none text-xs font-bold text-[#00355f] dark:text-[#93c5fd]"
            >
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet size={13} />
                Existing Customer Price Groups Catalogue ({groups.length})
              </span>
              <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                {showCatalog ? "▲ Hide" : "▼ Show"}
              </span>
            </div>

            {showCatalog && (
              <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1">Code</th>
                      <th className="px-2.5 py-1">Description</th>
                      <th className="px-2.5 py-1">Terms</th>
                      <th className="px-2.5 py-1 text-right">Days</th>
                      <th className="px-2.5 py-1 text-right">Limit (₹)</th>
                      <th className="px-2.5 py-1">Dest. Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => {
                      const isSelected = g.code.toUpperCase() === selectedCode.toUpperCase();
                      return (
                        <tr
                          key={g.code}
                          onClick={() => setSelectedCode(g.code)}
                          className={`cursor-pointer transition ${
                            isSelected 
                              ? "bg-blue-100 dark:bg-blue-950/80 font-bold text-[#00355f] dark:text-cyan-300" 
                              : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                          }`}
                        >
                          <td className="px-2.5 py-1 font-mono">{g.code}</td>
                          <td className="px-2.5 py-1">{g.description}</td>
                          <td className="px-2.5 py-1">{g.paymentTerms}</td>
                          <td className="px-2.5 py-1 font-mono text-right">{g.creditDays}</td>
                          <td className="px-2.5 py-1 font-mono text-right">{Number(g.creditLimit).toLocaleString("en-IN")}</td>
                          <td className="px-2.5 py-1">{g.destTaxType}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Desktop Navigation Toolbar (Add, Edit, Delete, Exit) */}
        <div className="bg-[#dbe4ee] dark:bg-[#131b27] px-4 py-2 border-t border-[#94a3b8] dark:border-[#475569] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-4 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] text-[#1e293b] dark:text-white border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5"
              title="Add New [Alt+A]"
            >
              <Plus size={13} className="text-blue-600 dark:text-blue-400" />
              <span><u>A</u>dd</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("edit")}
              className="px-4 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] text-[#1e293b] dark:text-white border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5"
              title="Edit Current [Alt+E]"
            >
              <Edit3 size={13} className="text-amber-600 dark:text-amber-400" />
              <span><u>E</u>dit</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-[#e2e8f0] dark:hover:bg-[#475569] text-red-700 dark:text-red-400 border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5"
              title="Delete Current [Alt+D]"
            >
              <Trash2 size={13} />
              <span><u>D</u>elete</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 bg-[#f1f5f9] dark:bg-[#334155] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300 text-[#1e293b] dark:text-white border border-[#64748b] dark:border-[#94a3b8] rounded-xs font-bold text-xs shadow-xs active:translate-y-0.5 transition flex items-center gap-1.5"
              title="Exit Screen [Alt+X / Esc]"
            >
              <LogOut size={13} />
              <span>E<u>x</u>it</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
