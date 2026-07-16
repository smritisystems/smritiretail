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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDrillDown } from "./drilldown_store.tsx";
import { SmritiScrollArea } from "../SmritiScrollArea.tsx";

const MOCK_RESULTS = [
  { id: "CUST-102", type: "customer", title: "Apex Retailers Ltd." },
  { id: "INV-2041", type: "invoice", title: "Sales Invoice SI-2041" },
  { id: "ITEM-A44", type: "item", title: "Wireless Earbuds Pro" },
  { id: "SUP-08", type: "supplier", title: "Global Electronics Wholesale" },
];

export const GlobalSearch: React.FC = () => {
  const { searchOpen, setSearchOpen, openPanel, pushContext } = useDrillDown();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    if (searchOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  const handleSelect = (item: any) => {
    const context = {
      entityType: item.type as any,
      entityId: item.id,
      title: item.title
    };
    openPanel(context);
    pushContext(context);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <AnimatePresence>
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
            className="fixed inset-0 bg-black"
          />
          
          {/* Search Box */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-xl overflow-hidden font-sans"
          >
            <div className="flex items-center px-4 py-3 border-b border-theme-divider">
              <span className="material-symbols-outlined text-theme-muted mr-3">search</span>
              <input 
                ref={inputRef}
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything (Invoices, Customers, Items, Barcodes)..."
                className="flex-1 bg-transparent border-none text-theme-body text-lg focus:outline-none"
              />
              <span className="text-xs font-mono text-theme-muted bg-theme-surface-2 px-2 py-1 rounded border border-theme-divider">ESC</span>
            </div>
            
            <SmritiScrollArea className="max-h-[60vh]">
               {query.length > 0 ? (
                 <div className="p-2">
                   <div className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono px-3 py-2">Results</div>
                   {MOCK_RESULTS.map(result => (
                     <button 
                       key={result.id}
                       onClick={() => handleSelect(result)}
                       className="w-full text-left flex items-center px-3 py-3 hover:bg-theme-surface-hover rounded-lg transition-colors group"
                     >
                       <span className="material-symbols-outlined text-theme-muted group-hover:text-blue-400 mr-3">
                         {result.type === 'customer' ? 'person' : 
                          result.type === 'invoice' ? 'receipt_long' : 
                          result.type === 'item' ? 'inventory_2' : 'local_shipping'}
                       </span>
                       <div>
                         <div className="text-sm font-semibold text-theme-body group-hover:text-blue-400">{result.title}</div>
                         <div className="text-xs text-theme-muted font-mono mt-0.5">{result.id} • {result.type}</div>
                       </div>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="p-4 text-center text-theme-muted text-sm py-12">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">keyboard</span>
                    <p>Type to start searching across all modules.</p>
                 </div>
               )}
            </SmritiScrollArea>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
