/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Add/Edit Customer GST Registration Modal
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect } from "react";
import { X, Check, FileText } from "lucide-react";
import { fetchCanonicalIndianStates, IndianState } from "../../../constants/indianStates.ts";
import { parseAndValidateGSTIN } from "../../../utils/gstEngine.ts";

export interface GstRegistrationEntry {
  id?: string;
  gstin: string;
  state: string;
  stateCode?: string;
  registrationType: "Regular" | "Composition" | "SEZ" | string;
  status: "Active" | "Inactive";
  isPrimary?: boolean;
}

interface AddEditGstModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: GstRegistrationEntry | null;
  onSave: (entry: GstRegistrationEntry) => void;
}

export const AddEditGstModal: React.FC<AddEditGstModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave
}) => {
  const [gstin, setGstin] = useState("");
  const [stateName, setStateName] = useState("Maharashtra");
  const [stateCode, setStateCode] = useState("27");
  const [registrationType, setRegistrationType] = useState<string>("Regular");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [isPrimary, setIsPrimary] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statesList, setStatesList] = useState<IndianState[]>([]);

  useEffect(() => {
    fetchCanonicalIndianStates()
      .then(res => setStatesList(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData) {
      setGstin(initialData.gstin || "");
      setStateName(initialData.state || "Maharashtra");
      setStateCode(initialData.stateCode || "27");
      setRegistrationType(initialData.registrationType || "Regular");
      setStatus(initialData.status || "Active");
      setIsPrimary(Boolean(initialData.isPrimary));
      setErrorMsg("");
    } else {
      setGstin("");
      setStateName("Maharashtra");
      setStateCode("27");
      setRegistrationType("Regular");
      setStatus("Active");
      setIsPrimary(false);
      setErrorMsg("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Handle GSTIN change with automatic state detection from 2-digit prefix
  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = upper.substring(0, 2);
      setStateCode(code);
      const matched = statesList.find(s => s.code === code);
      if (matched) {
        setStateName(matched.name);
      }
    }
    setErrorMsg("");
  };

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sName = e.target.value;
    setStateName(sName);
    const matched = statesList.find(s => s.name === sName);
    if (matched) {
      setStateCode(matched.code);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGstin = gstin.trim().toUpperCase();
    if (!cleanGstin) {
      setErrorMsg("GSTIN is required.");
      return;
    }

    const validation = parseAndValidateGSTIN(cleanGstin);
    if (!validation.isValid && cleanGstin.length !== 15) {
      setErrorMsg("Please enter a valid 15-character GSTIN.");
      return;
    }

    onSave({
      id: initialData?.id || `gst-reg-${Date.now()}`,
      gstin: cleanGstin,
      state: stateName,
      stateCode: stateCode,
      registrationType,
      status,
      isPrimary
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <h3 className="font-bold text-sm text-[#00355f] dark:text-[#8ebdf9]">
              {initialData ? "Edit GST Registration" : "Add GST Registration"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* GSTIN Input */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              GSTIN *
            </label>
            <input
              type="text"
              data-field-key="gst_number"
              required
              maxLength={15}
              placeholder="e.g. 27AAACR9121R1Z5"
              value={gstin}
              onChange={e => handleGstinChange(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-xs uppercase focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          {/* State Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              State *
            </label>
            <select
              value={stateName}
              onChange={handleStateSelect}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
            >
              {statesList.map(s => (
                <option key={s.code} value={s.name}>
                  {s.code} - {s.name}
                </option>
              ))}
              {statesList.length === 0 && (
                <>
                  <option value="Maharashtra">27 - Maharashtra</option>
                  <option value="Karnataka">29 - Karnataka</option>
                  <option value="Gujarat">24 - Gujarat</option>
                  <option value="Delhi">07 - Delhi</option>
                  <option value="Uttar Pradesh">09 - Uttar Pradesh</option>
                  <option value="Tamil Nadu">33 - Tamil Nadu</option>
                  <option value="Telangana">36 - Telangana</option>
                </>
              )}
            </select>
          </div>

          {/* Registration Type & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Registration Type
              </label>
              <select
                value={registrationType}
                onChange={e => setRegistrationType(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="Regular">Regular</option>
                <option value="Composition">Composition</option>
                <option value="SEZ">SEZ Unit</option>
                <option value="ISD">Input Service Distributor</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as "Active" | "Inactive")}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Primary Flag Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={e => setIsPrimary(e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span>Set as Primary GST Registration for Billing</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] font-bold hover:bg-[#0f4c81] transition flex items-center gap-1.5 text-xs shadow-xs"
            >
              <Check size={14} />
              <span>{initialData ? "Update GSTIN" : "Add GSTIN"}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
