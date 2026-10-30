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
import { Users, Phone, Mail, Plus, Trash2, Star, Shield, Briefcase, Truck, CreditCard, Loader2, Lock } from "lucide-react";
import { VendorDetail, VendorContact, ContactCategory } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { VendorDeleteConfirmationModal, DeleteItemPayload } from "../VendorDeleteConfirmationModal";

interface VendorContactTabProps {
  vendor: VendorDetail;
  onUpdateContacts: (contacts: VendorContact[]) => void;
  isEditing: boolean;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const CATEGORY_BADGES: Record<ContactCategory, { bg: string; text: string; icon: React.ReactNode }> = {
  SALES:      { bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",    text: "text-blue-700 dark:text-blue-400",    icon: <Briefcase size={12} /> },
  ACCOUNTS:   { bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", icon: <CreditCard size={12} /> },
  LOGISTICS:  { bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",  text: "text-amber-800 dark:text-amber-400",  icon: <Truck size={12} /> },
  MANAGEMENT: { bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30", text: "text-purple-700 dark:text-purple-400", icon: <Shield size={12} /> },
  GENERAL:    { bg: "bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30",  text: "text-slate-700 dark:text-slate-400",  icon: <Users size={12} /> },
  OTHER:      { bg: "bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30",  text: "text-slate-700 dark:text-slate-400",  icon: <Users size={12} /> },
};

const VendorContactTabBase: React.FC<VendorContactTabProps> = ({ vendor, onUpdateContacts, isEditing, onNotification }) => {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{ index: number; payload: DeleteItemPayload } | null>(null);
  const [newContact, setNewContact] = useState<Partial<VendorContact>>({
    contactName: "",
    contactCategory: "SALES",
    designation: "",
    department: "",
    mobile: "",
    email: "",
    isPrimary: false,
  });

  const handleAdd = async () => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before adding contacts.", "warning");
      return;
    }
    if (!newContact.contactName) return;
    setSaving(true);
    try {
      const payload = {
        contactName: newContact.contactName.trim(),
        contactCategory: (newContact.contactCategory as ContactCategory) || "GENERAL",
        designation: newContact.designation ? newContact.designation.trim() : null,
        department: newContact.department ? newContact.department.trim() : null,
        mobile: newContact.mobile ? newContact.mobile.trim() : null,
        phone: newContact.phone ? newContact.phone.trim() : null,
        email: newContact.email ? newContact.email.trim() : null,
        isPrimary: Boolean(newContact.isPrimary),
      };

      const persisted: any = await apiFetchV1(`/purchase/vendors/${vendor.id}/contacts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const canonicalItem: VendorContact = {
        id: persisted.id || `pc_${Date.now().toString(36)}`,
        contactName: persisted.contactName || payload.contactName,
        contactCategory: (persisted.contactCategory || payload.contactCategory) as ContactCategory,
        designation: persisted.designation || payload.designation,
        department: persisted.department || payload.department,
        mobile: persisted.mobile || payload.mobile,
        phone: persisted.phone || payload.phone,
        email: persisted.email || payload.email,
        isPrimary: Boolean(persisted.isPrimary ?? payload.isPrimary),
      };

      const nextContacts = canonicalItem.isPrimary
        ? vendor.contacts.map((c) => ({ ...c, isPrimary: false })).concat(canonicalItem)
        : [...vendor.contacts, canonicalItem];

      onUpdateContacts(nextContacts);
      onNotification?.("Contact Saved", `Contact person '${canonicalItem.contactName}' saved to database.`, "success");
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
    } catch (err: any) {
      onNotification?.("Save Failed", err?.message || "Failed to persist contact person.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDelete = (index: number) => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before deleting contacts.", "warning");
      return;
    }
    const target = vendor.contacts[index];
    if (!target) return;
    setPendingDeleteItem({
      index,
      payload: {
        entityType: "CONTACT",
        id: target.id || `idx-${index}`,
        title: target.contactName || "Contact Representative",
        details: [
          { label: "Category", value: target.contactCategory },
          { label: "Designation", value: target.designation },
          { label: "Department", value: target.department },
          { label: "Mobile Phone", value: target.mobile },
          { label: "Landline Phone", value: target.phone },
          { label: "Email Address", value: target.email },
          { label: "Primary Status", value: target.isPrimary },
        ],
      },
    });
  };

  const handleConfirmDelete = async (item: DeleteItemPayload) => {
    if (!pendingDeleteItem) return;
    const targetIndex = pendingDeleteItem.index;
    const target = vendor.contacts[targetIndex];
    if (!target) return;

    if (target.id && !target.id.startsWith("vc-")) {
      await apiFetchV1(`/purchase/vendors/${vendor.id}/contacts/${target.id}`, {
        method: "DELETE",
      });
    }

    const updated = vendor.contacts.filter((_, idx) => idx !== targetIndex);
    onUpdateContacts(updated);
    onNotification?.("Contact Removed", `Contact person '${target.contactName}' deleted permanently. Compliance audit log recorded.`, "success");
    setPendingDeleteItem(null);
  };

  const handleSetPrimary = async (index: number) => {
    if (!isEditing) {
      onNotification?.("View Mode Active", "Click 'Edit Vendor' in the top toolbar to enter Edit Mode before setting primary contact.", "warning");
      return;
    }
    const target = vendor.contacts[index];
    if (!target) return;
    if (target.id && !target.id.startsWith("vc-")) {
      setActionLoadingId(target.id);
      try {
        await apiFetchV1(`/purchase/vendors/${vendor.id}/contacts`, {
          method: "POST",
          body: JSON.stringify({ ...target, isPrimary: true }),
        });
        onNotification?.("Primary Contact Updated", `'${target.contactName}' is now designated as primary contact.`, "success");
      } catch (err: any) {
        onNotification?.("Update Failed", err?.message || "Could not update primary contact.", "error");
        setActionLoadingId(null);
        return;
      }
      setActionLoadingId(null);
    }
    onUpdateContacts(vendor.contacts.map((c, i) => ({ ...c, isPrimary: i === index })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">First-Class Contact Directory</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Target PO dispatches, payment advice, and delivery coordination to the right personnel</p>
        </div>
        {isEditing ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus size={14} />
            <span>Add Contact Person</span>
          </button>
        ) : (
          <div 
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed border border-slate-200 dark:border-slate-700 select-none"
            title="Locked in View Mode. Click 'Edit Vendor' in toolbar to add new contacts."
          >
            <Lock size={13} />
            <span>Add Contact Person (Locked)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vendor.contacts.map((c, idx) => {
          const badge = CATEGORY_BADGES[c.contactCategory] || CATEGORY_BADGES.GENERAL;
          return (
            <div
              key={c.id || idx}
              className={`group p-4 rounded-xl border transition shadow-xs ${
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
                  {/* Delete button strictly gated behind Edit Mode and double confirmation */}
                  {isEditing ? (
                    <button
                      onClick={() => handleRequestDelete(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-opacity"
                      title="Remove contact (Requires Double Confirmation)"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 flex items-center gap-0.5 opacity-60">
                      <Lock size={10} />
                    </div>
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
                  className="mt-3 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold block opacity-0 group-hover:opacity-100 transition-opacity"
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
                disabled={!newContact.contactName || saving}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow flex items-center space-x-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                <span>{saving ? "Saving..." : "Add Contact"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Entity Double-Confirmation Deletion Protection Modal */}
      <VendorDeleteConfirmationModal
        isOpen={Boolean(pendingDeleteItem)}
        vendorName={vendor.legalName}
        vendorCode={vendor.code}
        item={pendingDeleteItem?.payload || null}
        onClose={() => setPendingDeleteItem(null)}
        onConfirmDelete={handleConfirmDelete}
      />
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

