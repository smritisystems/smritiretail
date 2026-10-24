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
 * Target UI    : Add/Edit Key Corporate Contact Modal
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect } from "react";
import { X, Check, Users } from "lucide-react";

export interface KeyContactEntry {
  id?: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

interface AddEditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: KeyContactEntry | null;
  onSave: (entry: KeyContactEntry) => void;
}

export const AddEditContactModal: React.FC<AddEditContactModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave
}) => {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("Purchase Head");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDesignation(initialData.designation || "Purchase Head");
      setEmail(initialData.email || "");
      setPhone(initialData.phone || "");
      setIsPrimary(Boolean(initialData.isPrimary));
      setErrorMsg("");
    } else {
      setName("");
      setDesignation("Purchase Head");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
      setErrorMsg("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Contact Name is required.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setErrorMsg("Please provide at least a phone number or email.");
      return;
    }

    onSave({
      id: initialData?.id || `cnt-${Date.now()}`,
      name: name.trim(),
      designation: designation.trim(),
      email: email.trim(),
      phone: phone.trim(),
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
            <Users size={18} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <h3 className="font-bold text-sm text-[#00355f] dark:text-[#8ebdf9]">
              {initialData ? "Edit Key Contact" : "Add Key Contact"}
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

          {/* Name */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              data-field-key="contact_person"
              required
              placeholder="e.g. Amit Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Designation *
            </label>
            <select
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
            >
              <option value="Purchase Head">Purchase Head</option>
              <option value="Accounts Manager">Accounts Manager</option>
              <option value="Store Operations">Store Operations</option>
              <option value="Category Manager">Category Manager</option>
              <option value="Finance Director">Finance Director</option>
              <option value="Supply Chain Lead">Supply Chain Lead</option>
              <option value="General Manager">General Manager</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              data-field-key="email_address"
              placeholder="e.g. amit.sharma@ril.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              data-field-key="mobile_phone"
              placeholder="e.g. 9820012345"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          {/* Primary Flag Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                data-field-key="is_primary_contact"
                checked={isPrimary}
                onChange={e => setIsPrimary(e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span>Mark as Primary Business Contact</span>
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
              <span>{initialData ? "Update Contact" : "Add Contact"}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
