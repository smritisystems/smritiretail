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

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Check, MapPin, Phone, Mail, Home, Search } from "lucide-react";
import { CustomerAddressEntry, CustomerAddressType, CustomerGSTRegistrationOption, getCustomerAddressFingerprint } from "./types.ts";
import { parseAndValidateGSTIN } from "../../utils/gstEngine.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  ALL_INDIAN_CITIES,
  ALL_INDIAN_PINCODE_OPTIONS,
  INDIAN_STATE_CITY_PIN_DATA,
  INDIAN_STATES,
  getCitySuggestionsForState,
  getPincodeSuggestionsForCity
} from "../../constants/indianLocationData.ts";

interface SmritiCustomerMailingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerId?: string;
  addresses: CustomerAddressEntry[];
  gstRegistrations?: CustomerGSTRegistrationOption[];
  isLoadingGstRegistrations?: boolean;
  onSaveAddresses: (addresses: CustomerAddressEntry[]) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const SmritiCustomerMailingModal: React.FC<SmritiCustomerMailingModalProps> = ({
  isOpen,
  onClose,
  customerName,
  customerId,
  addresses,
  gstRegistrations = [],
  isLoadingGstRegistrations = false,
  onSaveAddresses,
  onNotification
}) => {
  const [addressList, setAddressList] = useState<CustomerAddressEntry[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);
  const [addressFilter, setAddressFilter] = useState("");
  const [addressTypeFilter, setAddressTypeFilter] = useState<"all" | CustomerAddressType>("all");
  const [referenceStates, setReferenceStates] = useState<string[]>([]);
  const [referenceStateCodes, setReferenceStateCodes] = useState<Record<string, string>>({});
  const [referenceStateNamesByCode, setReferenceStateNamesByCode] = useState<Record<string, string>>({});
  const [referenceCities, setReferenceCities] = useState<string[]>([]);
  const [referencePincodes, setReferencePincodes] = useState<string[]>([]);
  const cityResolutionRequest = useRef(0);

  const addressTypeLabel = (type?: CustomerAddressType) => (
    type === "billing" ? "Billing" : type === "shipping" ? "Shipping" : "Mailing"
  );

  const addressDisplayCode = (address: CustomerAddressEntry, index: number) => {
    const code = address.code?.trim();
    return code && !/^c(?:dl|bl)-/i.test(code) ? code : String(index + 1).padStart(3, "0");
  };

  useEffect(() => {
    if (isOpen) {
      if (addresses && addresses.length > 0) {
        setAddressList([...addresses]);
      } else {
        setAddressList([{
          code: "001",
          contactPerson: customerName || "Primary Contact",
          addressType: "mailing",
          storeCode: "",
          billingStoreCode: "",
          shippingStoreCode: "",
          address1: "",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "",
          city: "",
          postalCode: "",
          state: "",
          zone: "",
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

  useEffect(() => {
    if (!isOpen) return;
    apiFetchV1<any[]>("/control/reference/states?country_code=IN")
      .then((states) => {
        const records = Array.isArray(states) ? states : [];
        const names = records.map((state) => String(state.name)).filter(Boolean);
        setReferenceStateCodes(Object.fromEntries(records.map((state) => [String(state.name), String(state.state_code || "")] )));
        setReferenceStateNamesByCode(Object.fromEntries(records.map((state) => [String(state.state_code || "").toUpperCase(), String(state.name)])));
        setReferenceStates(names.length > 0 ? names : INDIAN_STATES);
      })
      .catch(() => {
        setReferenceStateCodes({});
        setReferenceStateNamesByCode({});
        setReferenceStates(INDIAN_STATES);
      });
  }, [isOpen]);

  const currentAddress = addressList[selectedAddressIndex] || addressList[0];
  const currentState = currentAddress?.state || "";
  const currentCity = currentAddress?.city || "";
  const filteredAddressEntries = addressList
    .map((address, index) => ({ address, index }))
    .filter(({ address }) => {
      if (addressTypeFilter !== "all" && address.addressType !== addressTypeFilter) return false;
      const query = addressFilter.trim().toLowerCase();
      if (!query) return true;
      return [
        address.code,
        address.locationName,
        address.address1,
        address.address2,
        address.address3,
        address.address4,
        address.address5,
        address.locality,
        address.city,
        address.state,
        address.postalCode,
        address.storeCode,
        address.billingStoreCode,
        address.shippingStoreCode
      ].some(value => String(value || "").toLowerCase().includes(query));
    });

  useEffect(() => {
    if (!isOpen || !currentState) {
      setReferenceCities([]);
      setReferencePincodes([]);
      return;
    }

    const params = new URLSearchParams({ limit: "100" });
    const stateCode = referenceStateCodes[currentState];
    if (stateCode) params.set("state_code", stateCode);
    if (currentCity) params.set("city", currentCity);

    apiFetchV1<any[]>(`/control/reference/postal-codes?${params.toString()}`)
      .then((postalRecords) => {
        const records = Array.isArray(postalRecords) ? postalRecords : [];
        const cities = [...new Set(records.map((record) => String(record.city || "")).filter(Boolean))];
        const pincodes = [...new Set(records.map((record) => String(record.postal_code || record.postalCode || "")).filter(Boolean))];
        setReferenceCities(cities);
        setReferencePincodes(pincodes);
      })
      .catch(() => {
        setReferenceCities(getCitySuggestionsForState(currentState));
        setReferencePincodes(getPincodeSuggestionsForCity(currentCity, currentState));
      });
  }, [isOpen, currentState, currentCity, referenceStateCodes]);

  if (!isOpen) return null;

  const resolveCitySelection = async (cityName: string) => {
    const cleanCity = cityName.trim();
    if (!cleanCity) return;
    const requestId = ++cityResolutionRequest.current;

    try {
      const params = new URLSearchParams({ city: cleanCity, limit: "100" });
      const records = await apiFetchV1<any[]>(`/control/reference/postal-codes?${params.toString()}`);
      if (requestId !== cityResolutionRequest.current) return;
      const matches = (Array.isArray(records) ? records : []).filter((record) =>
        String(record.city || "").trim().toLowerCase() === cleanCity.toLowerCase()
      );
      const stateCodes = [...new Set(matches.map((record) => String(record.state_code || "").toUpperCase()).filter(Boolean))];
      if (stateCodes.length !== 1) return;

      const selected = matches[0];
      const resolvedState = referenceStateNamesByCode[stateCodes[0]];
      setAddressList(prev => {
        const next = [...prev];
        if (next[selectedAddressIndex]) {
          next[selectedAddressIndex] = {
            ...next[selectedAddressIndex],
            city: selected.city,
            state: resolvedState || next[selectedAddressIndex].state,
            locality: selected.locality || next[selectedAddressIndex].locality
          };
        }
        return next;
      });
    } catch {
      // Static fallback remains available when the reference API is unavailable.
    }
  };

  const resolvePincodeSelection = async (postalCode: string) => {
    const cleanPin = postalCode.trim();
    if (!/^\d{6}$/.test(cleanPin)) return;

    try {
      const record = await apiFetchV1<any>(`/control/reference/postal-codes/${cleanPin}`);
      const resolvedState = referenceStateNamesByCode[String(record.state_code || "").toUpperCase()];
      setAddressList(prev => {
        const next = [...prev];
        if (next[selectedAddressIndex]) {
          next[selectedAddressIndex] = {
            ...next[selectedAddressIndex],
            postalCode: cleanPin,
            city: record.city || next[selectedAddressIndex].city,
            state: resolvedState || next[selectedAddressIndex].state,
            locality: record.locality || next[selectedAddressIndex].locality
          };
        }
        return next;
      });
    } catch {
      // Keep manually entered PIN when the reference record is unavailable.
    }
  };

  const handleFieldChange = (key: keyof CustomerAddressEntry, value: any) => {
    setAddressList(prev => {
      const next = [...prev];
      if (next[selectedAddressIndex]) {
        next[selectedAddressIndex] = { ...next[selectedAddressIndex], [key]: value };

        if (key === "state" && typeof value === "string") {
          const stateName = value.trim();
          const currentCity = next[selectedAddressIndex].city.trim();
          const stateCities = INDIAN_STATE_CITY_PIN_DATA[stateName] || [];
          if (currentCity && !stateCities.some((entry) => entry.city.toLowerCase() === currentCity.toLowerCase())) {
            next[selectedAddressIndex].city = "";
            next[selectedAddressIndex].postalCode = "";
          }
        }

        if (key === "isDefault" && value === true) {
          next.forEach((addr, idx) => {
            if (idx !== selectedAddressIndex && addr.addressType === next[selectedAddressIndex].addressType) addr.isDefault = false;
          });
        }
      }
      return next;
    });
  };

  const handleGstRegistrationChange = (registrationId: string) => {
    const registration = gstRegistrations.find(item => item.id === registrationId);
    setAddressList(prev => {
      const next = [...prev];
      if (next[selectedAddressIndex]) {
        next[selectedAddressIndex] = {
          ...next[selectedAddressIndex],
          gstRegistrationId: registration?.id || "",
          gstin: registration?.gstin || "",
          stateCode: registration?.stateCode || "",
          state: registration?.stateName || next[selectedAddressIndex].state
        };
      }
      return next;
    });
  };

  const handleManualGstinChange = (gstin: string) => {
    setAddressList(prev => {
      const next = [...prev];
      if (next[selectedAddressIndex]) {
        next[selectedAddressIndex] = {
          ...next[selectedAddressIndex],
          gstin: gstin.trim().toUpperCase(),
          gstRegistrationId: ""
        };
      }
      return next;
    });
  };

  const handleAddNewAddress = () => {
    const newCode = String(addressList.length + 1).padStart(3, "0");
    const newEntry: CustomerAddressEntry = {
      code: newCode,
      contactPerson: customerName || "Contact Person",
      addressType: "mailing",
      storeCode: "",
      billingStoreCode: "",
      shippingStoreCode: "",
      address1: "",
      address2: "",
      address3: "",
      address4: "",
      address5: "",
      locality: "",
      city: "",
      postalCode: "",
      state: "",
      zone: "",
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
    const missingStoreCode = addressList.find(address =>
      !address.id && (
        (address.addressType === "billing" && !address.billingStoreCode?.trim()) ||
        (address.addressType === "shipping" && !address.shippingStoreCode?.trim())
      )
    );
    if (missingStoreCode) {
      const label = missingStoreCode.addressType === "billing" ? "Billing Store Code" : "Shipping Store Code";
      onNotification?.("Store Code Required", `${label} is required before saving this address.`, "error");
      return;
    }

    const seenCodes = new Map<string, CustomerAddressEntry>();
    const seenAddresses = new Map<string, CustomerAddressEntry>();
    for (const address of addressList) {
      const addressFingerprint = getCustomerAddressFingerprint(address);
      const previousAddress = addressFingerprint ? seenAddresses.get(addressFingerprint) : undefined;
      if (addressFingerprint && previousAddress && (!address.id || !previousAddress.id)) {
        onNotification?.("Duplicate Address", `This ${addressTypeLabel(address.addressType).toLowerCase()} address already exists in the customer address list.`, "error");
        return;
      }
      if (addressFingerprint && !previousAddress) seenAddresses.set(addressFingerprint, address);

      const code = (address.addressType === "billing"
        ? address.billingStoreCode
        : address.addressType === "shipping"
          ? address.shippingStoreCode || address.storeCode
          : address.storeCode)?.trim().toUpperCase();
      if (code) {
        const key = `${address.addressType || "mailing"}:${code}`;
        const previousAddress = seenCodes.get(key);
        if (previousAddress && (!address.id || !previousAddress.id)) {
          onNotification?.("Duplicate Store Code", `${code} is used more than once for ${addressTypeLabel(address.addressType)} addresses.`, "error");
          return;
        }
        if (!previousAddress) seenCodes.set(key, address);
      }

      if (address.gstin && !address.id) {
        const validation = parseAndValidateGSTIN(address.gstin);
        if (!validation.isValid) {
          onNotification?.("Invalid GSTIN", `${address.gstin} is not a valid 15-character GSTIN.`, "error");
          return;
        }
        const stateCode = address.stateCode?.trim().padStart(2, "0") || "";
        if (stateCode && validation.stateCode && stateCode !== validation.stateCode) {
          onNotification?.("GSTIN State Mismatch", `${address.gstin} belongs to state code ${validation.stateCode}, but this address is set to ${stateCode}.`, "error");
          return;
        }
      }
    }

    onSaveAddresses(addressList);
    onClose();
    onNotification?.("Mailing List Updated", `Saved ${addressList.length} address profiles.`, "success");
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
              <div className="mb-2 rounded border border-[#c6c6cd] bg-white/70 px-2 py-1.5 text-[10px] text-[#515f74] dark:border-[#45464d] dark:bg-[#191c1e]/60 dark:text-[#bec6e0]">
                {addressList.filter(address => address.addressType === "billing").length} billing · {addressList.filter(address => address.addressType === "shipping").length} shipping · {addressList.filter(address => address.addressType === "mailing").length} mailing
              </div>
              <div className="mb-2 space-y-1.5">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-2 text-[#515f74]" />
                  <input
                    type="search"
                    value={addressFilter}
                    onChange={event => setAddressFilter(event.target.value)}
                    placeholder="City, PIN, locality, store code"
                    aria-label="Filter customer addresses"
                    className="w-full p-1.5 pl-7 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-[10px]"
                  />
                </div>
                <select
                  value={addressTypeFilter}
                  onChange={event => setAddressTypeFilter(event.target.value as "all" | CustomerAddressType)}
                  aria-label="Filter address type"
                  className="w-full p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-[10px]"
                >
                  <option value="all">All address types</option>
                  <option value="billing">Billing only</option>
                  <option value="shipping">Shipping only</option>
                  <option value="mailing">Mailing only</option>
                </select>
                <div className="text-[9px] text-[#515f74] dark:text-[#bec6e0]">
                  Showing {filteredAddressEntries.length} of {addressList.length}
                </div>
              </div>
              {filteredAddressEntries.map(({ address: addr, index: idx }) => (
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
                    <span className="truncate">#{addressDisplayCode(addr, idx)} {addressTypeLabel(addr.addressType)} · {addr.locationName || addr.locality || addr.city || "New address"}</span>
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
                    value={addressDisplayCode(currentAddress, selectedAddressIndex)}
                    onChange={e => {
                      if (!/^c(?:dl|bl)-/i.test(currentAddress.code || "")) {
                        handleFieldChange("code", e.target.value);
                      }
                    }}
                    readOnly={/^c(?:dl|bl)-/i.test(currentAddress.code || "")}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    Address Type
                  </label>
                  <select
                    value={currentAddress.addressType || "mailing"}
                    onChange={e => handleFieldChange("addressType", e.target.value as CustomerAddressType)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs"
                  >
                    <option value="mailing">Mailing Address</option>
                    <option value="billing">Billing Address</option>
                    <option value="shipping">Shipping Address</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    {currentAddress.addressType === "billing" ? "Billing Store Code" : currentAddress.addressType === "shipping" ? "Shipping Store Code" : "Store Code"}
                  </label>
                  <input
                    type="text"
                    value={currentAddress.addressType === "billing" ? currentAddress.billingStoreCode || "" : currentAddress.addressType === "shipping" ? currentAddress.shippingStoreCode || "" : currentAddress.storeCode || ""}
                    onChange={e => handleFieldChange(currentAddress.addressType === "billing" ? "billingStoreCode" : currentAddress.addressType === "shipping" ? "shippingStoreCode" : "storeCode", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    Select GSTIN Registration
                  </label>
                  <select
                    value={currentAddress.gstRegistrationId || ""}
                    onChange={e => handleGstRegistrationChange(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-bold text-xs"
                    disabled={isLoadingGstRegistrations}
                  >
                    <option value="">{isLoadingGstRegistrations ? "Loading registrations..." : "No GST registration"}</option>
                    {gstRegistrations.map(registration => (
                      <option key={registration.id} value={registration.id}>
                        {registration.gstin} · {registration.stateName} ({registration.stateCode})
                      </option>
                    ))}
                  </select>
                  {currentAddress.gstin && !currentAddress.gstRegistrationId && (
                    <span className="mt-1 block text-[9px] font-medium text-[#8a4b08]">Manual GSTIN will be saved with this address.</span>
                  )}
                </div>

                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                    Add New GSTIN
                  </label>
                  <input
                    type="text"
                    value={currentAddress.gstin || ""}
                    onChange={e => handleManualGstinChange(e.target.value)}
                    placeholder="15-character GSTIN"
                    maxLength={15}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs uppercase"
                  />
                  <span className="mt-1 block text-[9px] text-[#515f74] dark:text-[#bec6e0]">
                    Enter a GSTIN that is not available in the registration list.
                  </span>
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
                    list="india-city-list"
                    value={currentAddress.city}
                    onChange={e => {
                      const nextValue = e.target.value;
                      handleFieldChange("city", nextValue);
                      if (nextValue.trim()) {
                        void resolveCitySelection(nextValue);
                      }
                    }}
                    onBlur={() => void resolveCitySelection(currentAddress.city)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                  <datalist id="india-city-list">
                    {(referenceCities.length > 0 ? referenceCities : (currentAddress.state ? getCitySuggestionsForState(currentAddress.state) : ALL_INDIAN_CITIES)).map((city) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">Postal Code (PIN)</label>
                  <input
                    type="text"
                    list="india-pincode-list"
                    value={currentAddress.postalCode}
                    onChange={e => {
                      const nextValue = e.target.value;
                      handleFieldChange("postalCode", nextValue);
                      if (/^\d{6}$/.test(nextValue.trim())) {
                        void resolvePincodeSelection(nextValue.trim());
                      }
                    }}
                    onBlur={() => void resolvePincodeSelection(currentAddress.postalCode)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs font-bold"
                  />
                  <datalist id="india-pincode-list">
                    {(referencePincodes.length > 0 ? referencePincodes : (currentAddress.city ? getPincodeSuggestionsForCity(currentAddress.city, currentAddress.state) : ALL_INDIAN_PINCODE_OPTIONS)).map((pincode) => (
                      <option key={pincode} value={pincode} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">State / Province</label>
                  <input
                    type="text"
                    list="india-state-list"
                    value={currentAddress.state}
                    onChange={e => handleFieldChange("state", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                  />
                  <datalist id="india-state-list">
                    {(referenceStates.length > 0 ? referenceStates : INDIAN_STATES).map((state) => (
                      <option key={state} value={state} />
                    ))}
                  </datalist>
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
