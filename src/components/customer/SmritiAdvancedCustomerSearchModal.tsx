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

import React, { useState, useMemo } from "react";
import { X, Search, RotateCcw, Check, Users, ArrowRight, UserCheck } from "lucide-react";
import { RetailCustomerRecord, CustomerSearchFilterState } from "./types.ts";

interface SmritiAdvancedCustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: RetailCustomerRecord[];
  onSelectCustomer: (customer: RetailCustomerRecord) => void;
}

const initialFilters: CustomerSearchFilterState = {
  code: "",
  name: "",
  priceGroup: "All",
  loyaltyPgmId: "",
  dateOfBirth: "",
  religion: "All",
  ethnicity: "All",
  ageGroup: "All",
  profession: "",
  city: "",
  phone: "",
  state: "",
  locality: "",
  email: ""
};

export const SmritiAdvancedCustomerSearchModal: React.FC<SmritiAdvancedCustomerSearchModalProps> = ({
  isOpen,
  onClose,
  customers = [],
  onSelectCustomer
}) => {
  const [filters, setFilters] = useState<CustomerSearchFilterState>(initialFilters);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const handleFilterChange = (key: keyof CustomerSearchFilterState, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  // Filtered customer records
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (filters.code && !c.code.toLowerCase().includes(filters.code.toLowerCase())) return false;
      if (filters.name && !c.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.phone && !c.phone.toLowerCase().includes(filters.phone.toLowerCase())) return false;
      if (filters.email && !c.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (filters.priceGroup !== "All" && c.priceGroup !== filters.priceGroup) return false;
      if (filters.loyaltyPgmId && !c.loyaltyPgmId.toLowerCase().includes(filters.loyaltyPgmId.toLowerCase())) return false;
      if (filters.dateOfBirth && c.dateOfBirth !== filters.dateOfBirth) return false;
      if (filters.religion !== "All" && c.religion !== filters.religion) return false;
      if (filters.ethnicity !== "All" && c.ethnicity !== filters.ethnicity) return false;
      if (filters.ageGroup !== "All" && c.ageGroup !== filters.ageGroup) return false;
      if (filters.profession && !c.profession.toLowerCase().includes(filters.profession.toLowerCase())) return false;
      
      // Check addresses
      if (filters.city || filters.state || filters.locality) {
        const hasMatch = c.mailingAddresses.some(addr => {
          const matchCity = !filters.city || addr.city.toLowerCase().includes(filters.city.toLowerCase());
          const matchState = !filters.state || addr.state.toLowerCase().includes(filters.state.toLowerCase());
          const matchLocality = !filters.locality || addr.locality.toLowerCase().includes(filters.locality.toLowerCase());
          return matchCity && matchState && matchLocality;
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [customers, filters]);

  if (!isOpen) return null;

  const handleConfirmSelection = () => {
    const found = customers.find(c => c.id === selectedCustomerId || c.code === selectedCustomerId);
    if (found) {
      onSelectCustomer(found);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#191c1e] w-full max-w-6xl rounded-2xl shadow-2xl border border-[#c6c6cd] dark:border-[#45464d] flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <header className="px-6 py-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#d0e1fb] dark:bg-[#0f4c81] text-[#00355f] dark:text-[#8ebdf9] rounded-xl">
              <Search size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">
                Advanced Customer Search Utility
              </h3>
              <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
                Multivariate demographic selection, price group filtering, and catalogue loading.
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

        {/* Search Split Layout */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
          
          {/* Left Filter Panel */}
          <div className="col-span-12 md:col-span-4 bg-[#f7f9fb] dark:bg-[#131b2e]/60 border-r border-[#c6c6cd] dark:border-[#45464d] p-4 overflow-y-auto space-y-4 text-xs">
            
            <div className="flex items-center justify-between border-b border-[#c6c6cd] dark:border-[#45464d] pb-2">
              <span className="font-bold uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9] text-[11px]">
                Search Filters
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-[#515f74] dark:text-[#bec6e0] hover:text-[#00355f] flex items-center gap-1 font-semibold"
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>

            {/* General Selection */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0] tracking-wider">
                1. General Selection
              </h4>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Customer Code</label>
                <input
                  type="text"
                  value={filters.code}
                  onChange={e => handleFilterChange("code", e.target.value)}
                  placeholder="e.g. CUST-001"
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Customer Name</label>
                <input
                  type="text"
                  value={filters.name}
                  onChange={e => handleFilterChange("name", e.target.value)}
                  placeholder="e.g. Farida Jameel"
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Price Group</label>
                <select
                  value={filters.priceGroup}
                  onChange={e => handleFilterChange("priceGroup", e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold"
                >
                  <option value="All">All Price Groups</option>
                  <option value="TI#Tech Infotech Ltd">TI#Tech Infotech Ltd</option>
                  <option value="VIP#Platinum Retail">VIP#Platinum Retail</option>
                  <option value="CORP#Standard Corporate">CORP#Standard Corporate</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Loyalty Pgm ID</label>
                <input
                  type="text"
                  value={filters.loyaltyPgmId}
                  onChange={e => handleFilterChange("loyaltyPgmId", e.target.value)}
                  placeholder="e.g. 024"
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Date of Birth</label>
                <input
                  type="date"
                  value={filters.dateOfBirth}
                  onChange={e => handleFilterChange("dateOfBirth", e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs"
                />
              </div>
            </div>

            {/* Advanced Demographic Selection */}
            <div className="space-y-2.5 pt-2 border-t border-[#c6c6cd] dark:border-[#45464d]">
              <h4 className="font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0] tracking-wider">
                2. Demographic &amp; Geographic Selection
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Religion</label>
                  <select
                    value={filters.religion}
                    onChange={e => handleFilterChange("religion", e.target.value)}
                    className="w-full p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
                  >
                    <option value="All">All</option>
                    <option value="Muslim">Muslim</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Christian">Christian</option>
                    <option value="Sikh">Sikh</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Ethnicity</label>
                  <select
                    value={filters.ethnicity}
                    onChange={e => handleFilterChange("ethnicity", e.target.value)}
                    className="w-full p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
                  >
                    <option value="All">All</option>
                    <option value="Asian">Asian</option>
                    <option value="Arab">Arab</option>
                    <option value="European">European</option>
                    <option value="Australian">Australian</option>
                    <option value="American">American</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Age Group</label>
                <select
                  value={filters.ageGroup}
                  onChange={e => handleFilterChange("ageGroup", e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
                >
                  <option value="All">All Age Groups</option>
                  <option value="<20">&lt;20</option>
                  <option value=">=20 - <35">&gt;=20 - &lt;35</option>
                  <option value=">=35 - <45">&gt;=35 - &lt;45</option>
                  <option value=">=45 - <60">&gt;=45 - &lt;60</option>
                  <option value=">=60">&gt;=60</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Town / City</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={e => handleFilterChange("city", e.target.value)}
                    placeholder="e.g. Bangalore"
                    className="w-full p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block mb-1 text-[#515f74]">Phone</label>
                  <input
                    type="text"
                    value={filters.phone}
                    onChange={e => handleFilterChange("phone", e.target.value)}
                    placeholder="e.g. 9876"
                    className="w-full p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Results Grid */}
          <div className="col-span-12 md:col-span-8 flex flex-col bg-white dark:bg-[#191c1e] overflow-hidden">
            <div className="p-3 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0 text-xs">
              <span className="font-bold text-[#191c1e] dark:text-white font-mono">
                {filteredCustomers.length} Matching Customers Found
              </span>
              <span className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
                Double-click row or press Enter to load into Catalogue
              </span>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-[#f7f9fb] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0]">
                  <tr>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Customer Name</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">City / Town</th>
                    <th className="p-2.5">DOB</th>
                    <th className="p-2.5">Religion</th>
                    <th className="p-2.5">Ethnicity</th>
                    <th className="p-2.5">Age Group</th>
                    <th className="p-2.5">Loyalty</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-[#76777d]">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-xs">No matching customer records found.</p>
                        <p className="text-[11px] mt-0.5">Try widening your search filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const isSelected = selectedCustomerId === c.id || selectedCustomerId === c.code;
                      const primaryAddr = c.mailingAddresses[0];

                      return (
                        <tr
                          key={c.id || c.code}
                          onClick={() => setSelectedCustomerId(c.id || c.code)}
                          onDoubleClick={() => {
                            onSelectCustomer(c);
                            onClose();
                          }}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-[#d0e1fb] dark:bg-[#0f4c81]/50 text-[#00355f] dark:text-white font-bold"
                              : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                          }`}
                        >
                          <td className="p-2.5 font-mono font-bold">{c.code}</td>
                          <td className="p-2.5">{c.name}</td>
                          <td className="p-2.5 font-mono">{c.phone || "—"}</td>
                          <td className="p-2.5">{primaryAddr?.city || "Bangalore"}</td>
                          <td className="p-2.5 font-mono text-[11px]">{c.dateOfBirth || "—"}</td>
                          <td className="p-2.5">{c.religion}</td>
                          <td className="p-2.5">{c.ethnicity}</td>
                          <td className="p-2.5">{c.ageGroup}</td>
                          <td className="p-2.5 font-mono text-[11px] text-[#00355f] dark:text-[#8ebdf9]">
                            {c.loyaltyPgmId || "—"}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#166534] dark:bg-[#166534]/40 dark:text-[#86efac]">
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-[#f2f4f6] dark:bg-[#131b2e] border-t border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0 text-xs">
          <div className="text-[#515f74] dark:text-[#bec6e0] font-medium">
            {selectedCustomerId ? (
              <span>Selected Account: <strong className="text-[#00355f] dark:text-[#8ebdf9]">{selectedCustomerId}</strong></span>
            ) : (
              <span>Click a row to select an account</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={!selectedCustomerId}
              className="px-5 py-2 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] dark:hover:bg-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <UserCheck size={14} />
              Load Customer into Catalogue
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
