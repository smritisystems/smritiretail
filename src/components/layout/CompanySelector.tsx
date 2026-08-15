/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { apiFetchV1 } from '../../lib/apiFetchV1';

export interface CompanyOption {
  company_id: string;
  company_code: string;
  company_name: string;
  database_name: string;
  status?: string;
}

const DEFAULT_COMPANIES: CompanyOption[] = [
  {
    company_id: "COMP-001",
    company_code: "001",
    company_name: "Tattly Retail Pvt Ltd",
    database_name: "smriti001",
    status: "READY"
  }
];

export const CompanySelector: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyOption[]>(DEFAULT_COMPANIES);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return localStorage.getItem("smriti_company_id") || "COMP-001";
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("smriti_company_id")) {
      localStorage.setItem("smriti_company_id", "COMP-001");
    }
    if (!localStorage.getItem("smriti_company_code")) {
      localStorage.setItem("smriti_company_code", "001");
    }
    if (!localStorage.getItem("smriti_database_name")) {
      localStorage.setItem("smriti_database_name", "smriti001");
    }

    let isMounted = true;
    const loadCompanyRegistry = async () => {
      try {
        const data = await apiFetchV1('/control-center/companies');
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped: CompanyOption[] = data.map((item: any) => ({
            company_id: item.company_id || "COMP-001",
            company_code: item.company_code || "001",
            company_name: item.company_name || "Tattly Retail Pvt Ltd",
            database_name: item.database_name || "smriti001",
            status: item.status || "READY"
          }));
          setCompanies(mapped);
        }
      } catch {
        // Fallback to default company registry
      }
    };

    loadCompanyRegistry();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "F3" || e.code === "F3")) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectCompany = (comp: CompanyOption) => {
    localStorage.setItem("smriti_company_id", comp.company_id);
    localStorage.setItem("smriti_company_code", comp.company_code);
    localStorage.setItem("smriti_database_name", comp.database_name);
    setSelectedCompanyId(comp.company_id);
    setIsOpen(false);
    // Reload page to re-initialize API connection router
    window.location.reload();
  };

  const currentObj = companies.find(c => c.company_id === selectedCompanyId) || companies[0];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 transition-all text-xs font-bold shadow-md cursor-pointer select-none"
        title="Switch Active Business Database Tenant"
      >
        <Building2 className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="max-w-[150px] truncate font-display">{currentObj.company_name}</span>
        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-blue-700 text-white rounded border border-blue-500">
          {currentObj.company_code}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-blue-200 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-theme-surface-2 border border-theme-divider shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
            <div className="px-3.5 py-2 text-[10px] font-mono font-bold text-theme-muted border-b border-theme-divider uppercase tracking-wider bg-theme-surface-3">
              Select Active Business Tenant
            </div>
            {companies.map((comp) => (
              <button
                key={comp.company_id}
                onClick={() => handleSelectCompany(comp)}
                className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-theme-surface-hover transition-colors cursor-pointer ${
                  comp.company_id === selectedCompanyId ? 'text-blue-700 font-bold bg-blue-50 border-l-2 border-blue-600' : 'text-theme-body'
                }`}
              >
                <div>
                  <div className="font-semibold">{comp.company_name}</div>
                  <div className="text-[10px] font-mono text-theme-muted mt-0.5">Database: {comp.database_name}</div>
                </div>
                {comp.company_id === selectedCompanyId && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
