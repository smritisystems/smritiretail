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
 * Target UI    : Enterprise Parent–Child Customer Hierarchy Visualizer
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState } from "react";
import {
  Building2,
  Store,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle2,
  Network
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";

export interface HierarchyChildNode {
  id: string;
  code: string;
  name: string;
  storeCode?: string;
  location?: string;
  type?: string;
  status?: string;
  stores?: Array<{
    code: string;
    name: string;
  }>;
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

  // Fallback demo child nodes if none exist in database, matching reference screenshot
  const displayNodes: HierarchyChildNode[] = childrenNodes.length > 0 ? childrenNodes : [
    {
      id: "child-1",
      code: "REL001-001",
      name: "Phoenix Mall",
      storeCode: "REL-MUM-001",
      location: "Mumbai",
      type: "Branch / Store",
      status: "Active"
    },
    {
      id: "child-2",
      code: "REL001-002",
      name: "Inorbit Mall",
      storeCode: "REL-MUM-002",
      location: "Mumbai",
      type: "Branch / Store",
      status: "Active",
      stores: [
        { code: "Store 1", name: "Store 1" },
        { code: "Store 2", name: "Store 2" },
        { code: "Store 3", name: "Store 3" },
        { code: "...", name: "..." },
        { code: "Store N", name: "Store N" }
      ]
    },
    {
      id: "child-3",
      code: "REL001-003",
      name: "Amanora Mall",
      storeCode: "REL-PUN-001",
      location: "Pune",
      type: "Branch / Store",
      status: "Active"
    }
  ];

  const parentCode = customer.code || "REL001";
  const parentName = customer.name || "Reliance Retail Limited";
  const parentGstin = customer.gstin || "27AABCR1234F1Z5";

  return (
    <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Header Bar */}
      <div className="bg-[#00355f] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-sky-300" />
          <h3 className="font-bold text-xs tracking-wide">
            Parent – Child Hierarchy {childrenNodes.length === 0 ? "(Example)" : ""}
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
            <div className="grid grid-cols-3 gap-2 w-full">
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
                    Child Customer
                  </div>
                  <div className="font-mono font-bold text-[10px] text-slate-800 dark:text-slate-200 mt-0.5">
                    {node.code}
                  </div>
                  <div className="font-bold text-[11px] text-slate-900 dark:text-white truncate w-full">
                    {node.name}
                  </div>
                  <div className="text-[9px] text-slate-600 dark:text-slate-400 font-mono mt-1 space-y-0.5 text-left w-full border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1">
                    {node.storeCode && <div>Store Code: <strong>{node.storeCode}</strong></div>}
                    {node.location && <div>Location: <strong>{node.location}</strong></div>}
                    {node.type && <div>Type: <strong>{node.type}</strong></div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Connecting Lines from Child 2 to Stores */}
            <div className="w-full flex flex-col items-center mt-2">
              <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-700" />
              
              {/* Store Nodes Row */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                {["Store 1", "Store 2", "Store 3", "...", "Store N"].map((st, sidx) => (
                  <div
                    key={sidx}
                    className="px-2 py-1 bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700 rounded text-[9px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1 shadow-2xs"
                  >
                    {st !== "..." && <Store size={10} className="text-sky-700 dark:text-sky-300" />}
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </div>

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
