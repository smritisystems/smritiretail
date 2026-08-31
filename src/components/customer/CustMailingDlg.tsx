/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Check, MapPin, Phone, Mail, Home } from "lucide-react";
import { CustomerAddressEntry } from "./types.ts";

interface SmritiCustomerMailingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  addresses: CustomerAddressEntry[];
  onSaveAddresses: (addresses: CustomerAddressEntry[]) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const SmritiCustomerMailingModal: React.FC<SmritiCustomerMailingModalProps> = ({
  isOpen,
  onClose,
  customerName,
  addresses,
  onSaveAddresses,
  onNotification
}) => {
  const [addressList, setAddressList] = useState<CustomerAddressEntry[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (addresses && addresses.length > 0) {
        setAddressList([...addresses]);
      } else {
        setAddressList([{
          code: "001",
          contactPerson: customerName || "Primary Contact",
          address1: "",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "Jayanagar",
          city: "Bangalore",
          postalCode: "560027",
          state: "Karnataka",
          zone: "South",
          country: "India",
          officePhone: "",
          homePhone: "",
          mobilePhone: "",
          faxNumber: "",
          email1: "",
          email2: "",
          email3: "",
          isDefault: true
        }]);
      }
      setSelectedAddressIndex(0);
    }
  }, [isOpen, addresses, customerName]);

  if (!isOpen) return null;

  const currentAddress = addressList[selectedAddressIndex] || addressList[0];

  const handleFieldChange = (key: keyof CustomerAddressEntry, value: any) => {
    setAddressList(prev => {
      const next = [...prev];
      if (next[selectedAddressIndex]) {
        next[selectedAddressIndex] = { ...next[selectedAddressIndex], [key]: value };
        if (key === "isDefault" && value === true) {
          next.forEach((addr, idx) => {
            if (idx !== selectedAddressIndex) addr.isDefault = false;
          });
        }
      }
      return next;
    });
  };

  const handleAddNewAddress = () => {
    const newCode = String(addressList.length + 1).padStart(3, "0");
    const newEntry: CustomerAddressEntry = {
      code: newCode,
      contactPerson: customerName || "Contact Person",
      address1: "",
      address2: "",
      address3: "",
      address4: "",
      address5: "",
      locality: "",
      city: "Bangalore",
      postalCode: "",
      state: "Karnataka",
      zone: "South",
      country: "India",
      officePhone: "",
      homePhone: "",
      mobilePhone: "",
      faxNumber: "",
      email1: "",
      email2: "",
      email3: "",
      isDefault: addressList.length === 0
    };
    setAddressList(prev => [...prev, newEntry]);
    setSelectedAddressIndex(addressList.length);
  };

  const handleDeleteAddress = (indexToDelete: number) => {
    if (addressList.length <= 1) {
      onNotification?.("Action Restricted", "At least one mailing address record is required.", "error");
      return;
    }
    setAddressList(prev => prev.filter((_, idx) => idx !== indexToDelete));
    setSelectedAddressIndex(0);
  };

  const handleSaveAndClose = () => {
    onSaveAddresses(addressList);
    onNotification?.("Mailing List Updated", `Saved ${addressList.length} address profiles.`, "success");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#191c1e] w-full max-w-4xl rounded-2xl shadow-2xl border border-[#c6c6cd] dark:border-[#45464d] flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <header className="px-6 py-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#d0e1fb] dark:bg-[#0f4c81] text-[#00355f] dark:text-[#8ebdf9] rounded-xl">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">
                Mailing Address Sub-Form
              </h3>
              <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
                Customer: <span className="font-bold text-[#00355f] dark:text-[#8ebdf9]">{customerName || "New Customer"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Addresses List Sidebar */}
          <div className="w-48 bg-[#f7f9fb] dark:bg-[#131b2e]/60 border-r border-[#c6c6cd] dark:border-[#45464d] p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1.5 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0]">
                  Addresses ({addressList.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddNewAddress}
                  className="p-1 bg-[#00355f] hover:bg-[#0f4c81] text-white rounded text-[10px] flex items-center gap-1 font-bold"
                  title="Add New Address Location"
                >
                  <Plus size={11} /> Add
                </button>
              </div>

              {addressList.map((addr, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedAddressIndex(idx)}
                  className={`p-2 rounded-lg cursor-pointer text-xs transition border flex items-center justify-between ${
                    selectedAddressIndex === idx
                      ? "bg-white dark:bg-[#2d3133] border-[#00355f] dark:border-[#8ebdf9] shadow-xs font-bold text-[#00355f] dark:text-white"
                      : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-[#2d3133]/60 text-[#515f74] dark:text-[#bec6e0]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Home size={12} className="shrink-0" />
                    <span className="truncate">#{addr.code} {addr.locality || addr.city}</span>
                  </div>
                  {addr.isDefault && (
                    <span className="w-2 h-2 rounded-full bg-[#0c9488] shrink-0" title="Default Address" />
                  )}
                </div>
              ))}
            </div>

            {addressList.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteAddress(selectedAddressIndex)}
                className="mt-3 w-full py-1.5 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] rounded text-[11px] font-bold flex items-center justify-center gap-1 transition"
              >
                <Trash2 size={12} /> Remove Address
              </button>
            )}
          </div>

          {/* Right Address Editor Form */}
          {currentAddress && (
            <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs">
              
              {/* Header Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#f7f9fb] dark:bg-[#2d3133]/40 p-3 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    Address Code
                  </label>
                  <input
                    type="text"
                    value={currentAddress.code}
                    onChange={e => handleFieldChange("code", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={currentAddress.contactPerson}
                    onChange={e => handleFieldChange("contactPerson", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-bold text-xs"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentAddress.isDefault}
                      onChange={e => handleFieldChange("isDefault", e.target.checked)}
                      className="rounded text-[#00355f] focus:ring-[#00355f]"
                    />
                    <span className="font-bold text-xs text-[#00355f] dark:text-[#8ebdf9]">
                      Set as Primary Default Address
                    </span>
                  </label>
                </div>
              </div>

              {/* Address Lines 1 to 5 */}
              <div className="space-y-2.5">
                <h4 className="font-bold uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9] text-[11px] flex items-center gap-1.5">
                  <MapPin size={13} /> Street &amp; Building Address Lines
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Address Line 1 (Flat, Building, Block)"
                    value={currentAddress.address1}
                    onChange={e => handleFieldChange("address1", e.target.value)}
                    className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Address Line 2 (Street, Landmark)"
                    value={currentAddress.address2}
                    onChange={e => handleFieldChange("address2", e.target.value)}
                    className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Address Line 3 (Area / Cross)"
                    value={currentAddress.address3}
                    onChange={e => handleFieldChange("address3", e.target.value)}
                    className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Address Line 4 (Delivery Notes)"
                    value={currentAddress.address4}
                    onChange={e => handleFieldChange("address4", e.target.value)}
                    className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Address Line 5 (Additional Landmarks)"
                    value={currentAddress.address5}
                    onChange={e => handleFieldChange("address5", e.target.value)}
                    className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs md:col-span-2"
                  />
                </div>
              </div>

              {/* Demographics Location Fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">Locality</label>
                  <input
                    type="text"
                    value={currentAddress.locality}
                    onChange={e => handleFieldChange("locality", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">City / Town</label>
                  <input
                    type="text"
                    value={currentAddress.city}
                    onChange={e => handleFieldChange("city", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">Postal Code (PIN)</label>
                  <input
                    type="text"
                    value={currentAddress.postalCode}
                    onChange={e => handleFieldChange("postalCode", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">State / Province</label>
                  <input
                    type="text"
                    value={currentAddress.state}
                    onChange={e => handleFieldChange("state", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">Zone</label>
                  <input
                    type="text"
                    value={currentAddress.zone}
                    onChange={e => handleFieldChange("zone", e.target.value)}
                    placeholder="e.g. South, North, West"
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">Country</label>
                  <input
                    type="text"
                    value={currentAddress.country}
                    onChange={e => handleFieldChange("country", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Contact Numbers */}
              <div className="space-y-2.5">
                <h4 className="font-bold uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9] text-[11px] flex items-center gap-1.5">
                  <Phone size={13} /> Direct Contact Numbers
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Mobile Phone</label>
                    <input
                      type="text"
                      value={currentAddress.mobilePhone}
                      onChange={e => handleFieldChange("mobilePhone", e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Office Phone</label>
                    <input
                      type="text"
                      value={currentAddress.officePhone}
                      onChange={e => handleFieldChange("officePhone", e.target.value)}
                      placeholder="080-26654321"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Home Phone</label>
                    <input
                      type="text"
                      value={currentAddress.homePhone}
                      onChange={e => handleFieldChange("homePhone", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Fax Number</label>
                    <input
                      type="text"
                      value={currentAddress.faxNumber}
                      onChange={e => handleFieldChange("faxNumber", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Email Addresses 1 to 3 */}
              <div className="space-y-2.5">
                <h4 className="font-bold uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9] text-[11px] flex items-center gap-1.5">
                  <Mail size={13} /> Email Contacts
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Primary Email (1)</label>
                    <input
                      type="email"
                      value={currentAddress.email1}
                      onChange={e => handleFieldChange("email1", e.target.value)}
                      placeholder="primary@domain.com"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Secondary Email (2)</label>
                    <input
                      type="email"
                      value={currentAddress.email2}
                      onChange={e => handleFieldChange("email2", e.target.value)}
                      placeholder="alt@domain.com"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] block mb-1">Billing Email (3)</label>
                    <input
                      type="email"
                      value={currentAddress.email3}
                      onChange={e => handleFieldChange("email3", e.target.value)}
                      placeholder="accounts@domain.com"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3.5 bg-[#f2f4f6] dark:bg-[#131b2e] border-t border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] dark:hover:bg-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Check size={14} />
            Apply Mailing Details
          </button>
        </footer>

      </div>
    </div>
  );
};
