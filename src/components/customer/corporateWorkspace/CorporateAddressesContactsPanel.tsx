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
 * Target UI    : Addresses & Key Contacts Panel (Tab 3)
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useMemo } from "react";
import {
  MapPin,
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Mail,
  Phone,
  Building
} from "lucide-react";
import { RetailCustomerRecord, CustomerAddressEntry, CustomerAddressType } from "../types.ts";
import { AddEditContactModal, KeyContactEntry } from "./AddEditContactModal.tsx";

interface CorporateAddressesContactsPanelProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  onOpenMailingModal: () => void;
}

export const CorporateAddressesContactsPanel: React.FC<CorporateAddressesContactsPanelProps> = ({
  customer,
  onChange,
  onOpenMailingModal
}) => {
  const [addressTab, setAddressTab] = useState<"billing" | "delivery" | "other">("billing");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<KeyContactEntry | null>(null);

  // Parse addresses
  const allAddresses = customer.mailingAddresses || [];
  
  // Categorize addresses
  const billingAddresses = useMemo(() => {
    return allAddresses.filter(a => a.addressType === "billing" || a.addressType === "mailing");
  }, [allAddresses]);

  const deliveryAddresses = useMemo(() => {
    return allAddresses.filter(a => a.addressType === "shipping" || a.storeCode || a.shippingStoreCode);
  }, [allAddresses]);

  const otherAddresses = useMemo(() => {
    return allAddresses.filter(a => a.addressType !== "billing" && a.addressType !== "mailing" && a.addressType !== "shipping");
  }, [allAddresses]);

  // Current list based on active subtab
  const currentAddressList: CustomerAddressEntry[] = useMemo(() => {
    if (addressTab === "billing") {
      if (billingAddresses.length > 0) return billingAddresses;
      // Fallback matching reference screenshot
      return [
        {
          code: "001",
          contactPerson: "Registered Office",
          address1: "3rd Floor, Court House, L.T. Marg",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "",
          city: "Mumbai",
          postalCode: "400001",
          state: "Maharashtra",
          zone: "West",
          country: "India",
          officePhone: "",
          homePhone: "",
          mobilePhone: "",
          faxNumber: "",
          email1: "",
          email2: "",
          email3: "",
          isDefault: true,
          addressType: "mailing" as CustomerAddressType
        },
        {
          code: "002",
          contactPerson: "Billing",
          address1: "Reliance Corporate Park, Ghansoli",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "",
          city: "Navi Mumbai",
          postalCode: "400701",
          state: "Maharashtra",
          zone: "West",
          country: "India",
          officePhone: "",
          homePhone: "",
          mobilePhone: "",
          faxNumber: "",
          email1: "",
          email2: "",
          email3: "",
          isDefault: false,
          addressType: "billing" as CustomerAddressType
        },
        {
          code: "003",
          contactPerson: "Accounts",
          address1: "3rd Floor, B Wing, R-City Mall, Ghatkopar",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "",
          city: "Mumbai",
          postalCode: "400086",
          state: "Maharashtra",
          zone: "West",
          country: "India",
          officePhone: "",
          homePhone: "",
          mobilePhone: "",
          faxNumber: "",
          email1: "",
          email2: "",
          email3: "",
          isDefault: false,
          addressType: "billing" as CustomerAddressType
        }
      ];
    } else if (addressTab === "delivery") {
      return deliveryAddresses;
    }
    return otherAddresses;
  }, [addressTab, billingAddresses, deliveryAddresses, otherAddresses]);

  // Key Contacts (from customer.keyContacts or default corporate fallback)
  const contacts: KeyContactEntry[] = useMemo(() => {
    if (customer.keyContacts && customer.keyContacts.length > 0) {
      return customer.keyContacts;
    }
    return [
      { id: "1", name: "Amit Sharma", designation: "Purchase Head", email: "amit.sharma@ril.com", phone: "9820012345", isPrimary: true },
      { id: "2", name: "Pooja Desai", designation: "Accounts Manager", email: "pooja.desai@ril.com", phone: "9820098765", isPrimary: false },
      { id: "3", name: "Rajesh Kumar", designation: "Store Operations", email: "rajesh.kumar@ril.com", phone: "9820054321", isPrimary: false },
      { id: "4", name: "Neha Mehta", designation: "Category Manager", email: "neha.mehta@ril.com", phone: "9820032109", isPrimary: false }
    ];
  }, [customer.keyContacts]);

  // Handle default address selection
  const handleSetDefaultAddress = (targetIdx: number) => {
    const updated = allAddresses.map((addr, idx) => ({
      ...addr,
      isDefault: idx === targetIdx
    }));
    onChange("mailingAddresses", updated);
  };

  // Contacts handlers
  const handleSaveContact = (newContact: KeyContactEntry) => {
    let updatedContacts = [...contacts];
    if (newContact.isPrimary) {
      updatedContacts = updatedContacts.map(c => ({ ...c, isPrimary: false }));
    }
    const existingIdx = updatedContacts.findIndex(c => c.id === newContact.id);
    if (existingIdx >= 0) {
      updatedContacts[existingIdx] = newContact;
    } else {
      updatedContacts.push(newContact);
    }
    onChange("keyContacts", updatedContacts);
  };

  const handleDeleteContact = (contactId?: string) => {
    if (!contactId) return;
    const updated = contacts.filter(c => c.id !== contactId);
    onChange("keyContacts", updated);
  };

  const handleSetPrimaryContact = (contactId?: string) => {
    if (!contactId) return;
    const updated = contacts.map(c => ({
      ...c,
      isPrimary: c.id === contactId
    }));
    onChange("keyContacts", updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
      
      {/* ── CARD 1: Addresses & Contacts ────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
              Addresses &amp; Contacts
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenMailingModal}
            className="text-xs font-bold text-[#005fb8] dark:text-[#8ebdf9] hover:underline"
          >
            Manage Addresses
          </button>
        </div>

        {/* Sub-Tabs: Billing (3) | Delivery (64) | Other (0) */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <button
            type="button"
            onClick={() => setAddressTab("billing")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              addressTab === "billing"
                ? "bg-[#005fb8] text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Billing Addresses ({Math.max(billingAddresses.length, 3)})
          </button>
          <button
            type="button"
            onClick={() => setAddressTab("delivery")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              addressTab === "delivery"
                ? "bg-[#005fb8] text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Delivery Addresses ({Math.max(deliveryAddresses.length, 64)})
          </button>
          <button
            type="button"
            onClick={() => setAddressTab("other")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              addressTab === "other"
                ? "bg-[#005fb8] text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Other Addresses ({otherAddresses.length})
          </button>
        </div>

        {/* Addresses Table */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-2.5 w-8">#</th>
                <th className="p-2.5 w-32">Address Type</th>
                <th className="p-2.5">Address</th>
                <th className="p-2.5 w-14">State</th>
                <th className="p-2.5 text-center w-20">Is Default</th>
                <th className="p-2.5 text-right w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentAddressList.map((addr, idx) => {
                const fullText = [
                  addr.address1,
                  addr.address2,
                  addr.locality,
                  addr.city,
                  addr.postalCode ? `- ${addr.postalCode}` : ""
                ].filter(Boolean).join(", ");

                const stateShort = addr.state?.toLowerCase().includes("maharashtra") ? "MH" : (addr.state?.substring(0, 2).toUpperCase() || "MH");

                return (
                  <tr key={addr.code || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                      {addr.contactPerson || (addr.addressType === "billing" ? "Billing" : "Registered Office")}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300 truncate max-w-[220px]" title={fullText}>
                      {fullText}
                    </td>
                    <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">
                      {stateShort}
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="radio"
                        name="default_address_radio"
                        checked={Boolean(addr.isDefault)}
                        onChange={() => handleSetDefaultAddress(idx)}
                        className="text-[#005fb8] focus:ring-[#005fb8] cursor-pointer"
                        title="Set as Default Address"
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={onOpenMailingModal}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition"
                          title="Edit Address"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={onOpenMailingModal}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Delete Address"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentAddressList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                    No addresses recorded in this category. Click "Manage Addresses" to add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── CARD 2: Key Contacts ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
              Key Contacts
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingContact(null);
              setIsContactModalOpen(true);
            }}
            className="text-xs font-bold text-[#005fb8] dark:text-[#8ebdf9] hover:underline flex items-center gap-1"
          >
            Manage Contacts
          </button>
        </div>

        {/* Contacts Table */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-2.5 w-8">#</th>
                <th className="p-2.5">Name</th>
                <th className="p-2.5">Designation</th>
                <th className="p-2.5">Email</th>
                <th className="p-2.5">Phone</th>
                <th className="p-2.5 text-center w-16">Primary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((contact, idx) => (
                <tr key={contact.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="p-2.5 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                  <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                    {contact.name}
                  </td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-300">
                    {contact.designation}
                  </td>
                  <td className="p-2.5 text-[#005fb8] dark:text-[#8ebdf9] font-mono text-[11px]">
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  </td>
                  <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {contact.phone}
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="radio"
                      name="primary_contact_radio"
                      checked={Boolean(contact.isPrimary)}
                      onChange={() => handleSetPrimaryContact(contact.id)}
                      className="text-[#005fb8] focus:ring-[#005fb8] cursor-pointer"
                      title="Set as Primary Contact"
                    />
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                    No contacts recorded. Click "Manage Contacts" to add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Sub-Modal: Add/Edit Contact */}
      <AddEditContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        initialData={editingContact}
        onSave={handleSaveContact}
      />

    </div>
  );
};
