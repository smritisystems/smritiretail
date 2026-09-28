/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { MapPin, Plus, Trash2, CheckCircle2, Star, Edit2, Loader2, AlertCircle } from "lucide-react";
import { VendorDetail, VendorAddress } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";
import { apiFetchV1 } from "../../../lib/apiFetchV1";

interface VendorAddressTabProps {
  vendor: VendorDetail;
  onUpdateAddresses: (addresses: VendorAddress[]) => void;
  isEditing: boolean;
}

const VendorAddressTabBase: React.FC<VendorAddressTabProps> = ({ vendor, onUpdateAddresses, isEditing }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ status: "success" | "error"; text: string } | null>(null);

  const [newAddr, setNewAddr] = useState<Partial<VendorAddress>>({
    addressType: "BILLING",
    addressTitle: "Dispatch Warehouse",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    stateCode: "",
    pincode: "",
    country: "India",
    gstin: "",
    isPrimary: false,
  });

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setPinFeedback(null);
    setNewAddr({
      addressType: "BILLING",
      addressTitle: "Dispatch Warehouse",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      stateCode: "",
      pincode: "",
      country: "India",
      gstin: "",
      isPrimary: vendor.addresses.length === 0,
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    setPinFeedback(null);
    const target = vendor.addresses[index];
    setNewAddr({
      ...target,
      country: target.country || "India",
    });
    setShowAddModal(true);
  };

  const handlePincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setNewAddr(prev => ({ ...prev, pincode: clean }));

    if (clean.length < 6) {
      setPinFeedback(null);
      return;
    }

    setResolvingPin(true);
    setPinFeedback(null);
    try {
      const res = await apiFetchV1<any>(`/control/reference/postal-codes/${clean}`);
      if (res && res.city) {
        setNewAddr(prev => ({
          ...prev,
          city: res.city,
          state: res.state_name || res.state_code || prev.state,
          stateCode: res.state_code || prev.stateCode,
          addressLine2: prev.addressLine2 ? prev.addressLine2 : (res.locality || ""),
        }));
        setPinFeedback({
          status: "success",
          text: `Resolved: ${res.city}, ${res.state_name || res.state_code}${res.gst_state_code ? ` (GST Code: ${res.gst_state_code})` : ""}${res.locality ? ` • ${res.locality}` : ""}`,
        });
      } else {
        setPinFeedback({
          status: "error",
          text: "PIN not recognized in national postal registry",
        });
      }
    } catch {
      setPinFeedback({
        status: "error",
        text: "PIN lookup failed (network or unregistered)",
      });
    } finally {
      setResolvingPin(false);
    }
  };

  const handleSaveAddress = () => {
    if (!newAddr.addressLine1 || !newAddr.city) return;

    if (editingIndex !== null) {
      const updated = vendor.addresses.map((a, idx) => {
        if (idx === editingIndex) {
          return {
            ...a,
            addressType: (newAddr.addressType as any) || "BILLING",
            addressTitle: newAddr.addressTitle || "Branch",
            addressLine1: newAddr.addressLine1!,
            addressLine2: newAddr.addressLine2 || "",
            city: newAddr.city!,
            state: newAddr.state || "",
            stateCode: newAddr.stateCode || "",
            pincode: newAddr.pincode || "",
            country: newAddr.country || "India",
            gstin: newAddr.gstin || "",
            isPrimary: Boolean(newAddr.isPrimary),
          };
        }
        return newAddr.isPrimary ? { ...a, isPrimary: false } : a;
      });
      onUpdateAddresses(updated);
    } else {
      const item: VendorAddress = {
        id: `va-${Date.now().toString(36)}`,
        addressType: (newAddr.addressType as any) || "BILLING",
        addressTitle: newAddr.addressTitle || "Branch",
        addressLine1: newAddr.addressLine1!,
        addressLine2: newAddr.addressLine2 || "",
        city: newAddr.city!,
        state: newAddr.state || "",
        stateCode: newAddr.stateCode || "",
        pincode: newAddr.pincode || "",
        country: newAddr.country || "India",
        gstin: newAddr.gstin || "",
        isPrimary: Boolean(newAddr.isPrimary),
      };
      const nextAddresses = newAddr.isPrimary
        ? vendor.addresses.map(a => ({ ...a, isPrimary: false })).concat(item)
        : [...vendor.addresses, item];
      onUpdateAddresses(nextAddresses);
    }

    setShowAddModal(false);
    setEditingIndex(null);
  };

  const handleDeleteAddress = (index: number) => {
    const updated = vendor.addresses.filter((_, idx) => idx !== index);
    onUpdateAddresses(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = vendor.addresses.map((a, idx) => ({
      ...a,
      isPrimary: idx === index,
    }));
    onUpdateAddresses(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registered Offices, Warehouses & Godown Coordinates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dispatch locations for purchase orders, e-Way bills, and multi-state GSTIN deliveries</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus size={14} />
          <span>Add Location</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendor.addresses.map((addr, idx) => (
          <div
            key={addr.id || idx}
            className={`group p-4 rounded-xl border transition shadow-xs ${
              addr.isPrimary 
                ? "bg-white dark:bg-slate-900/90 border-indigo-300 dark:border-indigo-500/40 shadow-indigo-500/5" 
                : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm">{addr.addressTitle || "Address"}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700">
                  {addr.addressType}
                </span>
                {addr.isPrimary && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-1 font-bold">
                    <Star size={10} className="fill-emerald-500 text-emerald-500" />
                    <span>Primary</span>
                  </span>
                )}
              </div>
              {/* Inline actions — always accessible on hover, no global edit mode required */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenEdit(idx)}
                  title="Edit address"
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                >
                  <Edit2 size={14} />
                </button>
                {!addr.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(idx)}
                    title="Set as primary address"
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAddress(idx)}
                  title="Remove address"
                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div>{addr.addressLine1}</div>
              {addr.addressLine2 && <div className="text-slate-500 dark:text-slate-400">{addr.addressLine2}</div>}
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                {addr.city}, {addr.state} — <span className="font-mono text-slate-800 dark:text-slate-200">{addr.pincode}</span>
                {addr.stateCode && <span className="ml-1 text-[10px] text-slate-400">({addr.stateCode})</span>}
              </div>
              {addr.gstin && (
                <div className="pt-2 text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                  GSTIN: {addr.gstin}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingIndex !== null ? "Edit Delivery / Warehouse Location" : "Add Delivery / Warehouse Location"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter 6-digit postal PIN to auto-populate City, State & GST details
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Location Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Bhiwandi Central Godown"
                    value={newAddr.addressTitle || ""}
                    onChange={(e) => setNewAddr({ ...newAddr, addressTitle: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Type</label>
                  <select
                    value={newAddr.addressType || "BILLING"}
                    onChange={(e) => setNewAddr({ ...newAddr, addressType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="BILLING">Billing / Registered Office</option>
                    <option value="SHIPPING">Shipping / Delivery Point</option>
                    <option value="WAREHOUSE">Dispatch Godown / Warehouse</option>
                    <option value="REGISTERED_OFFICE">Registered Corporate Office</option>
                    <option value="BRANCH">Regional Branch</option>
                  </select>
                </div>
              </div>

              {/* PIN Code lookup field */}
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1 font-semibold">
                  Postal PIN Code *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 400001 (auto-resolves city & state)"
                    value={newAddr.pincode || ""}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-10 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                  <div className="absolute right-3 top-2.5">
                    {resolvingPin && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                    {!resolvingPin && pinFeedback?.status === "success" && (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    )}
                    {!resolvingPin && pinFeedback?.status === "error" && (
                      <AlertCircle size={16} className="text-amber-500" />
                    )}
                  </div>
                </div>
                {pinFeedback && (
                  <p className={`mt-1 text-[11px] flex items-center space-x-1 ${
                    pinFeedback.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    <span>{pinFeedback.text}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">City / District *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={newAddr.city || ""}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">State / UT</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={newAddr.state || ""}
                    onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  placeholder="Building, Plot, Street Name, Industrial Area"
                  value={newAddr.addressLine1 || ""}
                  onChange={(e) => setNewAddr({ ...newAddr, addressLine1: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Address Line 2 (Locality / Landmark)</label>
                <input
                  type="text"
                  placeholder="Near Post Office, Sector, Landmark"
                  value={newAddr.addressLine2 || ""}
                  onChange={(e) => setNewAddr({ ...newAddr, addressLine2: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Location GSTIN (if state-specific)</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={newAddr.gstin || ""}
                    onChange={(e) => setNewAddr({ ...newAddr, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">Country</label>
                  <input
                    type="text"
                    disabled
                    value={newAddr.country || "India"}
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newAddr.isPrimary)}
                    onChange={(e) => setNewAddr({ ...newAddr, isPrimary: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Set as primary default address for purchase orders & deliveries</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingIndex(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAddress}
                disabled={!newAddr.addressLine1 || !newAddr.city}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow"
              >
                {editingIndex !== null ? "Update Location" : "Add Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VendorAddressTab = withCapability(VendorAddressTabBase, {
  entity: "vendor",
  capability: "vendor.address",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorAddressTab;
