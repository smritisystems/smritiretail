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
 * Target UI    : Enterprise Customer Parent–Child Hierarchy Card
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Network,
  Store,
  Lightbulb,
  Info
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";

export interface HierarchyChildNode {
  id: string;
  code: string;
  name: string;
  storeCode?: string;
  location?: string;
  status?: string;
  type?: string;
  stores?: Array<{ code: string; name: string }>;
}

interface CustomerHierarchyTreeProps {
  customer: RetailCustomerRecord;
  childrenNodes?: HierarchyChildNode[];
  onSelectCustomer?: (customerCode: string) => void;
}

export const CustomerHierarchyTree: React.FC<CustomerHierarchyTreeProps> = ({
  customer,
  childrenNodes = [],
  onSelectCustomer,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const displayNodes: HierarchyChildNode[] = childrenNodes;

  const parentCode = customer.code || "—";
  const parentName = customer.name || "—";
  const parentGstin = customer.gstin?.trim() || "Not Registered";

  const storeCodes = (customer.mailingAddresses || [])
    .filter(a => a.storeCode || a.shippingStoreCode)
    .map(a => a.storeCode || a.shippingStoreCode || "");

  return (
    <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Header Bar */}
      <div className="bg-[#00355f] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-sky-300" />
          <h3 className="font-bold text-xs tracking-wide">
            Parent – Child Hierarchy ({displayNodes.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sky-200 hover:text-white p-1 rounded hover:bg-white/10 transition"
          title={isExpanded ? "Collapse Tree" : "Expand Tree"}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
          {/* Tree Diagram Container */}
          <div className="flex flex-col items-center">
            
            {/* 1. Root Parent Card */}
            <div className="w-full max-w-sm bg-sky-50 dark:bg-sky-950/60 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-3 shadow-xs relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00355f] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 block">
                    Parent Customer (Corporate / Key Account)
                  </span>
                  <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                    {parentName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Code: <strong className="text-slate-800 dark:text-slate-200">{parentCode}</strong> | GSTIN: <strong className="text-slate-800 dark:text-slate-200">{parentGstin}</strong>
                  </div>
                </div>
              </div>
            </div>

            {displayNodes.length === 0 ? (
              <div className="w-full text-center py-6 px-4 my-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/60">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No Child Accounts Linked
                </div>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  This corporate parent account operates as a direct single entity or delivery locations are managed directly under the store network.
                </p>
              </div>
            ) : (
              <>
                {/* Connecting Vertical Line from Parent */}
                <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />

                {/* Horizontal Branching Line */}
                <div className="w-[85%] h-0.5 bg-slate-300 dark:bg-slate-700 relative">
                  {/* Left drop line */}
                  <div className="absolute left-0 top-0 w-0.5 h-4 bg-slate-300 dark:bg-slate-700" />
                  {/* Center drop line */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-4 bg-slate-300 dark:bg-slate-700" />
                  {/* Right drop line */}
                  <div className="absolute right-0 top-0 w-0.5 h-4 bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Gap for drop lines */}
                <div className="h-4" />

                {/* 2. Child Customer Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                  {displayNodes.slice(0, 3).map((node) => (
                    <div
                      key={node.id}
                      onClick={() => onSelectCustomer?.(node.code)}
                      className="bg-[#ecfdf5] dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/70 rounded-lg p-2.5 text-center flex flex-col items-center hover:border-emerald-500 hover:shadow-xs transition cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-md bg-emerald-700 text-white flex items-center justify-center mb-1.5 shadow-2xs">
                        <Store size={14} />
                      </div>
                      <div className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase leading-none">
                        Child Account
                      </div>
                      <div className="font-mono font-bold text-[10px] text-slate-800 dark:text-slate-200 mt-0.5">
                        {node.code}
                      </div>
                      <div className="font-bold text-[11px] text-slate-900 dark:text-white truncate w-full" title={node.name}>
                        {node.name}
                      </div>
                      <div className="text-[9px] text-slate-600 dark:text-slate-400 font-mono mt-1 space-y-0.5 text-left w-full border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1">
                        {node.storeCode && <div>Store: <strong>{node.storeCode}</strong></div>}
                        {node.location && <div className="truncate">City: <strong>{node.location}</strong></div>}
                      </div>
                    </div>
                  ))}
                </div>

                {displayNodes.length > 3 && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1.5 text-center">
                    + {displayNodes.length - 3} additional child accounts in corporate hierarchy
                  </div>
                )}
              </>
            )}

            {/* Connecting Lines from Child to Delivery Stores */}
            {storeCodes.length > 0 && (
              <div className="w-full flex flex-col items-center mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Associated Physical Delivery Stores ({storeCodes.length})
                </span>
                
                {/* Store Nodes Row */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {storeCodes.slice(0, 4).map((code, sidx) => (
                    <div
                      key={sidx}
                      className="px-2 py-1 bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700 rounded text-[9px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1 shadow-2xs font-mono"
                    >
                      <Store size={10} className="text-sky-700 dark:text-sky-300" />
                      <span>Store {code}</span>
                    </div>
                  ))}
                  {storeCodes.length > 4 && (
                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      +{storeCodes.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Architecture Guidance Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <strong>Note:</strong> All stores do not need to be separate customer records. Use <strong>Store / Outlet</strong> or <strong>Delivery Location</strong> when separate customer identity is not required.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
