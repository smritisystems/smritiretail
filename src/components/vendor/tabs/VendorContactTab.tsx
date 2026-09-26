/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { Users, Phone, Mail, Plus, Trash2, Star, Shield, Briefcase, Truck, CreditCard } from "lucide-react";
import { VendorDetail, VendorContact, ContactCategory } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";

interface VendorContactTabProps {
  vendor: VendorDetail;
  onUpdateContacts: (contacts: VendorContact[]) => void;
  isEditing: boolean;
}

const CATEGORY_BADGES: Record<ContactCategory, { bg: string; text: string; icon: React.ReactNode }> = {
  SALES:      { bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",    text: "text-blue-700 dark:text-blue-400",    icon: <Briefcase size={12} /> },
  ACCOUNTS:   { bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", icon: <CreditCard size={12} /> },
  LOGISTICS:  { bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",  text: "text-amber-800 dark:text-amber-400",  icon: <Truck size={12} /> },
  MANAGEMENT: { bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30", text: "text-purple-700 dark:text-purple-400", icon: <Shield size={12} /> },
  GENERAL:    { bg: "bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30",  text: "text-slate-700 dark:text-slate-400",  icon: <Users size={12} /> },
  OTHER:      { bg: "bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30",  text: "text-slate-700 dark:text-slate-400",  icon: <Users size={12} /> },
};

const VendorContactTabBase: React.FC<VendorContactTabProps> = ({ vendor, onUpdateContacts, isEditing }) => {
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState<Partial<VendorContact>>({
    contactName: "",
    contactCategory: "SALES",
    designation: "",
    department: "",
    mobile: "",
    email: "",
    isPrimary: false,
  });

  const handleAdd = () => {
    if (!newContact.contactName) return;
    const item: VendorContact = {
      id: `vc-${Date.now().toString(36)}`,
      contactName: newContact.contactName,
      contactCategory: (newContact.contactCategory as ContactCategory) || "GENERAL",
      designation: newContact.designation,
      department: newContact.department,
      mobile: newContact.mobile,
      phone: newContact.phone,
      email: newContact.email,
      isPrimary: Boolean(newContact.isPrimary),
    };
    onUpdateContacts([...vendor.contacts, item]);
    setShowModal(false);
    setNewContact({
      contactName: "",
      contactCategory: "SALES",
      designation: "",
      department: "",
      mobile: "",
      email: "",
      isPrimary: false,
    });
  };

  const handleDelete = (index: number) => {
    onUpdateContacts(vendor.contacts.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    onUpdateContacts(vendor.contacts.map((c, i) => ({ ...c, isPrimary: i === index })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">First-Class Contact Directory</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Target PO dispatches, payment advice, and delivery coordination to the right personnel</p>
        </div>
        {isEditing && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus size={14} />
            <span>Add Contact Person</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vendor.contacts.map((c, idx) => {
          const badge = CATEGORY_BADGES[c.contactCategory] || CATEGORY_BADGES.GENERAL;
          return (
            <div
              key={c.id || idx}
              className={`p-4 rounded-xl border transition shadow-xs ${
                c.isPrimary ? "bg-white dark:bg-slate-900/90 border-indigo-300 dark:border-indigo-500/40" : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
                    <span>{c.contactName}</span>
                    {c.isPrimary && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-0.5 font-bold">
                        <Star size={9} className="fill-emerald-500 text-emerald-500" />
                        <span>Primary</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.designation || "Representative"}</div>
                </div>

                <div className="flex items-center space-x-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center space-x-1 ${badge.bg} ${badge.text}`}>
                    {badge.icon}
                    <span>{c.contactCategory}</span>
                  </span>
                  {isEditing && (
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                {c.mobile && (
                  <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-mono">
                    <Phone size={12} className="text-slate-400 dark:text-slate-500" />
                    <span>{c.mobile}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 truncate">
                    <Mail size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
              </div>

              {isEditing && !c.isPrimary && (
                <button
                  onClick={() => handleSetPrimary(idx)}
                  className="mt-3 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold block"
                >
                  Set as Primary Contact
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Add Contact Person</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={newContact.contactName}
                  onChange={(e) => setNewContact({ ...newContact, contactName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Operational Category</label>
                <select
                  value={newContact.contactCategory}
                  onChange={(e) => setNewContact({ ...newContact, contactCategory: e.target.value as ContactCategory })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                >
                  <option value="SALES">Sales Representative (Orders & Quotations)</option>
                  <option value="ACCOUNTS">Accounts Manager (Invoices & Payments)</option>
                  <option value="LOGISTICS">Logistics Dispatcher (Transporter & Delivery)</option>
                  <option value="MANAGEMENT">Executive Management (Director / Partner)</option>
                  <option value="GENERAL">General Support</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Head"
                    value={newContact.designation}
                    onChange={(e) => setNewContact({ ...newContact, designation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial"
                    value={newContact.department}
                    onChange={(e) => setNewContact({ ...newContact, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="10-digit mobile"
                    value={newContact.mobile}
                    onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="rajesh@vendor.com"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VendorContactTab = withCapability(VendorContactTabBase, {
  entity: "vendor",
  capability: "vendor.contact",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorContactTab;

