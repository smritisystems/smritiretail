/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Enterprise Organization Selector
 * Feature      : src/features/auth/components/OrganizationSelector.tsx
 */

import React, { useState } from "react";
import { Building2, ChevronDown, Check, Search, Star } from "lucide-react";
import { OrganizationContext } from "../types/auth.types";
import { DEFAULT_ORGANIZATIONS, authStore, useAuthStore } from "../store/authStore";

export const OrganizationSelector: React.FC = () => {
  const { selectedOrganization } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrgs = DEFAULT_ORGANIZATIONS.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (org: OrganizationContext) => {
    authStore.setSelectedOrganization(org);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full text-left font-sans">
      <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
        Workspace / Organization
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500/50 text-slate-100 flex items-center justify-between transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-7 h-7 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
            <Building2 size={15} />
          </div>
          <div className="truncate text-left">
            <div className="font-semibold text-xs text-slate-100 truncate">
              {selectedOrganization?.name || "Select Organization"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {selectedOrganization?.code} • {selectedOrganization?.branchName || "Main"}
            </div>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-800 flex items-center space-x-2">
            <Search size={14} className="text-slate-400 ml-1" />
            <input
              type="text"
              placeholder="Search organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="max-h-48 overflow-y-auto p-1 space-y-1">
            {filteredOrgs.map((org) => {
              const isSelected = selectedOrganization?.id === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs transition-colors ${
                    isSelected ? "bg-indigo-600/20 text-indigo-300 font-semibold" : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {org.isFavorite && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                    <span className="truncate">{org.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-indigo-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
