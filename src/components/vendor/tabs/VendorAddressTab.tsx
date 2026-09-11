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
import { MapPin, Plus, Trash2, CheckCircle2, Building, Star } from "lucide-react";
import { VendorDetail, VendorAddress } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";

interface VendorAddressTabProps {
  vendor: VendorDetail;
  onUpdateAddresses: (addresses: VendorAddress[]) => void;
  isEditing: boolean;
}

const VendorAddressTabBase: React.FC<VendorAddressTabProps> = ({ vendor, onUpdateAddresses, isEditing }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddr, setNewAddr] = useState<Partial<VendorAddress>>({
    addressType: "BILLING",
    addressTitle: "Dispatch Warehouse",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isPrimary: false,
  });

  const handleAddAddress = () => {
    if (!newAddr.addressLine1 || !newAddr.city) return;
    const item: VendorAddress = {
      id: `va-${Date.now().toString(36)}`,
      addressType: newAddr.addressType || "BILLING",
      addressTitle: newAddr.addressTitle || "Branch",
      addressLine1: newAddr.addressLine1,
      addressLine2: newAddr.addressLine2,
      city: newAddr.city,
      state: newAddr.state || "",
      pincode: newAddr.pincode || "",
      country: newAddr.country || "India",
      gstin: newAddr.gstin,
      isPrimary: Boolean(newAddr.isPrimary),
    };
    onUpdateAddresses([...vendor.addresses, item]);
    setShowAddModal(false);
    setNewAddr({
      addressType: "BILLING",
      addressTitle: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isPrimary: false,
    });
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
        {isEditing && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus size={14} />
            <span>Add Location</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendor.addresses.map((addr, idx) => (
          <div
            key={addr.id || idx}
            className={`p-4 rounded-xl border transition shadow-xs ${
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
              {isEditing && (
                <div className="flex items-center space-x-1">
                  {!addr.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(idx)}
                      title="Set as primary"
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(idx)}
                    title="Delete location"
                    className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div>{addr.addressLine1}</div>
              {addr.addressLine2 && <div className="text-slate-500 dark:text-slate-400">{addr.addressLine2}</div>}
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                {addr.city}, {addr.state} — <span className="font-mono text-slate-800 dark:text-slate-200">{addr.pincode}</span>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Add Delivery / Warehouse Location</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Location Title</label>
                <input
                  type="text"
                  placeholder="e.g. Bhiwandi Central Godown"
                  value={newAddr.addressTitle}
                  onChange={(e) => setNewAddr({ ...newAddr, addressTitle: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Type</label>
                <select
                  value={newAddr.addressType}
                  onChange={(e) => setNewAddr({ ...newAddr, addressType: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                >
                  <option value="BILLING">Billing / Registered Office</option>
                  <option value="SHIPPING">Shipping / Delivery Point</option>
                  <option value="WAREHOUSE">Dispatch Godown / Warehouse</option>
                  <option value="BRANCH">Regional Branch</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  placeholder="Building, Street, Landmark"
                  value={newAddr.addressLine1}
                  onChange={(e) => setNewAddr({ ...newAddr, addressLine1: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">City *</label>
                  <input
                    type="text"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    value={newAddr.state}
                    onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-400 mb-1">Pincode</label>
                <input
                  type="text"
                  maxLength={6}
                  value={newAddr.pincode}
                  onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAddress}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
              >
                Add Location
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

