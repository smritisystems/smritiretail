/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Formula } from "../types";

interface FormulaRegistryTabProps {
  formulas: Formula[];
  onSelectFormula: (f: Formula) => void;
}

export const FormulaRegistryTab: React.FC<FormulaRegistryTabProps> = ({ 
  formulas, 
  onSelectFormula 
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(formulas.map(f => f.category)))];

  const filteredFormulas = formulas.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.meaning.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.expression.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "All" || f.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      
      {/* Description Header */}
      <div className="bg-theme-surface-1 p-6 rounded-xl border border-theme-divider flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-lg text-theme-body">SMRITI Formula Registry</h3>
          <p className="text-xs text-theme-muted">
            Locked, single-source of truth computed KPI mathematical definitions complying with SMRITI Explainability DOC-01 standards.
          </p>
        </div>
        <span className="text-xs bg-emerald-500 bg-opacity-20 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500">RULE 15 ACTIVE</span>
      </div>

      {/* Filter and Lookup controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Lookup active formula variables, math, descriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-theme-surface-1 border border-theme-divider text-theme-body text-xs px-3 py-2.5 rounded focus:outline-none"
        />
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3.5 py-2 rounded font-semibold border transition-all ${
                selectedCategory === cat 
                  ? "bg-[#2563EB] border-[#2563EB] text-theme-body" 
                  : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:border-[#2563EB]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of registered formula cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFormulas.map(f => (
          <div key={f.id} className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider flex flex-col justify-between hover:border-[#2563EB] transition-all">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] bg-theme-surface-3 text-theme-muted px-2 py-0.5 rounded border border-theme-divider">
                  {f.category}
                </span>
                <span className="font-mono text-xs text-theme-muted">{f.id}</span>
              </div>

              <div>
                <h4 className="font-bold text-theme-body text-base font-display">{f.name}</h4>
                <p className="mt-1.5 text-xs text-theme-muted leading-relaxed">{f.meaning}</p>
              </div>

              {/* Expression */}
              <div className="bg-theme-surface-3 p-3 rounded font-mono text-xs text-[#2563EB] flex items-center justify-center text-center">
                {f.expression}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-theme-divider flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-theme-muted">Live Output:</span>
                <span className="text-theme-body text-sm font-bold font-mono">{f.value}</span>
              </div>

              <button
                onClick={() => onSelectFormula(f)}
                className="bg-[#2563EB] hover:bg-opacity-95 text-theme-body text-xs font-semibold px-3 py-1.5 rounded flex items-center space-x-1"
              >
                <span className="material-symbols-outlined text-xs">info</span>
                <span>ⓘ Explain</span>
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
