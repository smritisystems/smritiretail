/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Store Code Multi-Address Management Modal
 */

import React, { useState, useEffect } from "react";
import { X, Plus, Edit2, Trash2, Check, MapPin, Building, Phone, Mail, User, ShieldCheck, AlertCircle } from "lucide-react";
import { CorporateStoreItem, StoreAddressItem } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

interface StoreAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  store: CorporateStoreItem | null;
  onAddressesUpdated?: (updatedAddresses: StoreAddressItem[]) => void;
  readOnly?: boolean;
}

const ADDRESS_TYPES = ["Delivery", "Billing", "Warehouse", "Registered", "Shipping", "Other"];

export const StoreAddressModal: React.FC<StoreAddressModalProps> = ({
  isOpen,
  onClose,
  customerId,
  store,
  onAddressesUpdated,
  readOnly = false,
}) => {
  const [addresses, setAddresses] = useState<StoreAddressItem[]>(() => store?.addresses || []);
  const [loading, setLoading] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Partial<StoreAddressItem> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !store) {
      setAddresses([]);
      setIsFormOpen(false);
      setEditingAddress(null);
      setFeedback(null);
      return;
    }

    if (store.addresses && store.addresses.length > 0) {
      setAddresses(store.addresses);
    } else {
      fetchAddresses();
    }
  }, [isOpen, store]);

  const fetchAddresses = async () => {
    if (!store) return;
    setLoading(true);
    try {
      if (customerId && store.id && !store.id.startsWith("loc-ref-")) {
        const res = await apiFetchV1<StoreAddressItem[]>(
          `/crm/customers/${customerId}/delivery-locations/${store.id}/addresses`
        );
        if (Array.isArray(res) && res.length > 0) {
          setAddresses(res);
          return;
        }
      }
      // Fallback default address from store properties
      const defaultAddr: StoreAddressItem = {
        id: `addr-${store.id || "001"}`,
        address_type: "Delivery",
        address_title: "Main Store Front",
        address_line1: store.address_summary || `${store.store_name}, Central Market`,
        city: store.city,
        state: store.state,
        pincode: "400001",
        country: "India",
        contact_person: store.contact,
        phone: store.phone,
        email: store.email,
        is_primary: true,
        is_active: true,
      };
      setAddresses([defaultAddr]);
    } catch {
      const defaultAddr: StoreAddressItem = {
        id: `addr-${store.id || "001"}`,
        address_type: "Delivery",
        address_title: "Main Store Front",
        address_line1: store.address_summary || `${store.store_name}, Central Market`,
        city: store.city,
        state: store.state,
        pincode: "400001",
        country: "India",
        contact_person: store.contact,
        phone: store.phone,
        email: store.email,
        is_primary: true,
        is_active: true,
      };
      setAddresses([defaultAddr]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = () => {
    setEditingAddress({
      address_type: "Delivery",
      address_title: "",
      address_line1: "",
      address_line2: "",
      locality: "",
      city: store?.city || "",
      district: "",
      state: store?.state || "",
      pincode: "",
      country: "India",
      contact_person: "",
      phone: "",
      email: "",
      is_primary: false,
      is_active: true,
    });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleStartEdit = (addr: StoreAddressItem) => {
    setEditingAddress({ ...addr });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleDeactivate = async (addrId: string) => {
    if (!confirm("Are you sure you want to deactivate this address? Historical transactions will remain preserved.")) {
      return;
    }
    setSaving(true);
    try {
      if (customerId && store?.id && !store.id.startsWith("loc-ref-")) {
        await apiFetchV1(
          `/crm/customers/${customerId}/delivery-locations/${store.id}/addresses/${addrId}`,
          { method: "DELETE" }
        );
      }
      const updated = addresses.map((a) => (a.id === addrId ? { ...a, is_active: false, is_primary: false } : a));
      setAddresses(updated);
      onAddressesUpdated?.(updated);
      setFeedback({ type: "success", text: "Address deactivated successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to deactivate address." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress || !editingAddress.address_line1 || !editingAddress.city || !editingAddress.state || !editingAddress.pincode) {
      setFeedback({ type: "error", text: "Please fill in Address Line 1, City, State, and PIN Code." });
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(editingAddress.id);
      let savedItem: StoreAddressItem;

      if (customerId && store?.id && !store.id.startsWith("loc-ref-")) {
        if (isEdit) {
          savedItem = await apiFetchV1<StoreAddressItem>(
            `/crm/customers/${customerId}/delivery-locations/${store.id}/addresses/${editingAddress.id}`,
            {
              method: "PUT",
              body: JSON.stringify(editingAddress),
            }
          );
        } else {
          savedItem = await apiFetchV1<StoreAddressItem>(
            `/crm/customers/${customerId}/delivery-locations/${store.id}/addresses`,
            {
              method: "POST",
              body: JSON.stringify(editingAddress),
            }
          );
        }
      } else {
        // Local state update for mock/in-memory store
        savedItem = {
          id: editingAddress.id || `addr-${Date.now()}`,
          address_type: editingAddress.address_type || "Delivery",
          address_title: editingAddress.address_title,
          address_line1: editingAddress.address_line1!,
          address_line2: editingAddress.address_line2,
          locality: editingAddress.locality,
          city: editingAddress.city!,
          district: editingAddress.district,
          state: editingAddress.state!,
          pincode: editingAddress.pincode!,
          country: editingAddress.country || "India",
          contact_person: editingAddress.contact_person,
          phone: editingAddress.phone,
          email: editingAddress.email,
          is_primary: Boolean(editingAddress.is_primary),
          is_active: true,
          updated_at: new Date().toISOString(),
        };
      }

      let updatedList = [...addresses];
      if (savedItem.is_primary) {
        // Enforce at most one active primary per address type
        updatedList = updatedList.map((a) =>
          a.address_type === savedItem.address_type ? { ...a, is_primary: false } : a
        );
      }

      if (isEdit) {
        updatedList = updatedList.map((a) => (a.id === savedItem.id ? savedItem : a));
      } else {
        updatedList.push(savedItem);
      }

      setAddresses(updatedList);
      onAddressesUpdated?.(updatedList);
      setIsFormOpen(false);
      setEditingAddress(null);
      setFeedback({ type: "success", text: "Address saved successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to save address." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !store) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8]">
              <MapPin size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-[#0284c7] dark:text-[#38bdf8] font-bold">
                  {store.store_code}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {store.store_name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-address registry: Delivery, Billing, Warehouse & Registered sites.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {feedback.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isFormOpen ? (
            <>
              {/* List Header & Add Button */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Configured Addresses ({addresses.filter((a) => a.is_active).length} Active)
                </span>
                {!readOnly && <button
                  type="button"
                  onClick={handleStartCreate}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus size={14} />
                  <span>Add Typed Address</span>
                </button>}
              </div>

              {/* Addresses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {addresses.map((addr) => {
                  const isActive = addr.is_active !== false;

                  return (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                        isActive
                          ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          : "bg-slate-100/50 dark:bg-slate-900/20 border-slate-200/60 dark:border-slate-800/40 opacity-60"
                      }`}
                    >
                      <div>
                        {/* Badges: Type & Primary */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase">
                              {addr.address_type}
                            </span>
                            {addr.is_primary && isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <ShieldCheck size={11} /> Primary {addr.address_type}
                              </span>
                            )}
                          </div>
                          {!isActive && (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded">
                              Deactivated
                            </span>
                          )}
                        </div>

                        {/* Title & Lines */}
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                          {addr.address_title || `${addr.address_type} Site`}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                          {addr.address_line1}
                          {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                          <br />
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>

                        {/* Contact details */}
                        {(addr.contact_person || addr.phone || addr.email) && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                            {addr.contact_person && (
                              <div className="flex items-center gap-1.5">
                                <User size={12} className="text-slate-400" />
                                <span>{addr.contact_person}</span>
                              </div>
                            )}
                            {addr.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-slate-400" />
                                <span>{addr.phone}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      {!readOnly && <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                        {isActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(addr)}
                              className="text-xs text-slate-600 dark:text-slate-300 hover:text-[#0284c7] font-medium flex items-center gap-1 p-1"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(addr.id)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 p-1"
                            >
                              <Trash2 size={12} /> Deactivate
                            </button>
                          </>
                        )}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Address Form */
            <form onSubmit={handleSaveAddress} className="space-y-3.5 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {editingAddress?.id ? "Edit Address" : "New Typed Address"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Address Type */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Address Type *
                  </label>
                  <select
                    value={editingAddress?.address_type || "Delivery"}
                    onChange={(e) => setEditingAddress({ ...editingAddress, address_type: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  >
                    {ADDRESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Address Title */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Address Title / Label
                  </label>
                  <input
                    type="text"
                    data-field-key="address_title"
                    placeholder="e.g. Inward Goods Dock, Main Accounts Wing"
                    value={editingAddress?.address_title || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, address_title: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* Address Line 1 */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    data-field-key="address_line1"
                    required
                    placeholder="Plot / Gate / Building / Street"
                    value={editingAddress?.address_line1 || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, address_line1: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* Address Line 2 */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    data-field-key="address_line2"
                    placeholder="Industrial Area, Landmark"
                    value={editingAddress?.address_line2 || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, address_line2: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    data-field-key="city"
                    required
                    value={editingAddress?.city || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    data-field-key="state"
                    required
                    value={editingAddress?.state || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, state: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* PIN Code */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    PIN Code (6 digits) *
                  </label>
                  <input
                    type="text"
                    data-field-key="pincode"
                    required
                    maxLength={6}
                    value={editingAddress?.pincode || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, pincode: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none font-mono"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    data-field-key="contact_person"
                    placeholder="Name & Designation"
                    value={editingAddress?.contact_person || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, contact_person: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    data-field-key="mobile_phone"
                    placeholder="+91..."
                    value={editingAddress?.phone || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, phone: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    data-field-key="email_address"
                    placeholder="dispatch@..."
                    value={editingAddress?.email || ""}
                    onChange={(e) => setEditingAddress({ ...editingAddress, email: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-[#0284c7] focus:outline-none"
                  />
                </div>

                {/* Primary Checkbox */}
                <div className="sm:col-span-2 pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-field-key="is_primary_address"
                    id="is_primary_checkbox"
                    checked={Boolean(editingAddress?.is_primary)}
                    onChange={(e) => setEditingAddress({ ...editingAddress, is_primary: e.target.checked })}
                    className="text-[#0284c7] focus:ring-[#0284c7] rounded"
                  />
                  <label htmlFor="is_primary_checkbox" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Set as Primary <strong className="text-slate-900 dark:text-white">{editingAddress?.address_type || "Delivery"}</strong> address for this Store Code.
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{saving ? "Saving..." : "Save Address"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {addresses.filter((a) => a.is_active).length} active addresses for <strong className="font-mono text-slate-700 dark:text-slate-300">{store.store_code}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
