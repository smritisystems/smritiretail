/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Left Vertical Navigation Rail for Customer Master
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React from "react";
import {
  FileText,
  Building2,
  MapPin,
  Store,
  CreditCard,
  Users,
  Network,
  Files,
  History
} from "lucide-react";

export type CustomerMasterSectionId =
  | "basic"
  | "corporate"
  | "addresses"
  | "stores"
  | "commercial"
  | "contacts"
  | "parent-child"
  | "documents"
  | "audit";

export interface NavSectionItem {
  id: CustomerMasterSectionId;
  label: string;
  icon: React.ReactNode;
  domId: string;
}

interface CustomerMasterSideNavProps {
  activeSection: CustomerMasterSectionId;
  onSelectSection: (sectionId: CustomerMasterSectionId) => void;
}

export const NAV_SECTIONS: NavSectionItem[] = [
  { id: "basic", label: "Basic Details", icon: <FileText size={16} />, domId: "sec-basic-details" },
  { id: "corporate", label: "Corporate & Tax", icon: <Building2 size={16} />, domId: "sec-corporate-tax" },
  { id: "addresses", label: "Addresses", icon: <MapPin size={16} />, domId: "sec-addresses" },
  { id: "stores", label: "Store / Outlet Network", icon: <Store size={16} />, domId: "sec-store-network" },
  { id: "commercial", label: "Commercial Terms", icon: <CreditCard size={16} />, domId: "sec-commercial-terms" },
  { id: "contacts", label: "Contacts", icon: <Users size={16} />, domId: "sec-contacts" },
  { id: "parent-child", label: "Parent – Child", icon: <Network size={16} />, domId: "sec-parent-child" },
  { id: "documents", label: "Documents", icon: <Files size={16} />, domId: "sec-documents" },
  { id: "audit", label: "Activity & Audit", icon: <History size={16} />, domId: "sec-activity-audit" },
];

export const CustomerMasterSideNav: React.FC<CustomerMasterSideNavProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <nav className="w-52 shrink-0 bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xs space-y-1 select-none">
      {NAV_SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition text-left ${
              isActive
                ? "bg-sky-50 dark:bg-sky-950/80 text-[#00355f] dark:text-[#8ebdf9] border border-sky-200 dark:border-sky-800 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <span className={isActive ? "text-[#00355f] dark:text-[#8ebdf9]" : "text-slate-400 dark:text-slate-500"}>
              {section.icon}
            </span>
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
