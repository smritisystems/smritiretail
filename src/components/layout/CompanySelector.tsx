/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';

interface CompanyOption {
  code: string;
  name: string;
}

export const CompanySelector: React.FC = () => {
  const [selectedCompany, setSelectedCompany] = useState<string>(() => {
    const code = localStorage.getItem("smriti_company_code");
    if (!code) {
      localStorage.setItem("smriti_company_code", "TATTLY");
      return "TATTLY";
    }
    return code;
  });
  const [isOpen, setIsOpen] = useState(false);

  // Available tenant database choices
  const companies: CompanyOption[] = [
    { code: "TATTLY", name: "Tattly Retail Pvt Ltd" },
    { code: "DEMO", name: "SMRITI Enterprise Demo Co" }
  ];

  useEffect(() => {
    if (!localStorage.getItem("smriti_company_code")) {
      localStorage.setItem("smriti_company_code", "TATTLY");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "F3" || e.code === "F3")) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectCompany = (code: string) => {
    localStorage.setItem("smriti_company_code", code);
    setSelectedCompany(code);
    setIsOpen(false);
    // Reload page to re-initialize API connection router
    window.location.reload();
  };

  const currentObj = companies.find(c => c.code === selectedCompany) || companies[0];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 transition-all text-xs font-bold shadow-md cursor-pointer select-none"
        title="Switch Active Business Database Tenant"
      >
        <Building2 className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="max-w-[150px] truncate font-display">{currentObj.name}</span>
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-950 text-emerald-300 rounded border border-blue-400">
          {currentObj.code}
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
                key={comp.code}
                onClick={() => handleSelectCompany(comp.code)}
                className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-theme-surface-hover transition-colors cursor-pointer ${
                  comp.code === selectedCompany ? 'text-emerald-400 font-bold bg-emerald-950/20' : 'text-theme-body'
                }`}
              >
                <div>
                  <div className="font-semibold">{comp.name}</div>
                  <div className="text-[10px] font-mono text-theme-muted mt-0.5">Database: Smritibus_{comp.code}</div>
                </div>
                {comp.code === selectedCompany && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
