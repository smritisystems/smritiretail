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
 * Target UI    : Integrations & Data Exchange Panel (Tab 5)
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState } from "react";
import {
  Share2,
  CheckCircle2,
  Clock,
  Sliders,
  FileSpreadsheet,
  FileCode,
  Layers,
  Database
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";
import { IntegrationLogsModal } from "./IntegrationLogsModal.tsx";

interface CorporateIntegrationsPanelProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
}

export const CorporateIntegrationsPanel: React.FC<CorporateIntegrationsPanelProps> = ({
  customer,
  onChange,
}) => {
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  const ediEnabled = customer.ediEnabled ?? true;

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5 text-xs">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Share2 size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
            Integrations &amp; Data Exchange
          </h3>
        </div>
      </div>

      {/* Row 1: Core Integration Fields (Matching Reference Screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* External Customer Code */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            External Customer Code
          </label>
          <input
            type="text"
            value={customer.externalCustomerCode || customer.companyCode || (customer.code?.startsWith("RRL") ? "RRL001" : "")}
            onChange={e => {
              onChange("externalCustomerCode", e.target.value);
              onChange("companyCode", e.target.value);
            }}
            placeholder="e.g. RRL001"
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

        {/* Environment */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Environment
          </label>
          <select
            value={customer.environment || "Corporate"}
            onChange={e => onChange("environment", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          >
            <option value="Corporate">Corporate</option>
            <option value="Retail">Retail</option>
            <option value="Enterprise Hub">Enterprise Hub</option>
            <option value="Sandbox">Sandbox</option>
          </select>
        </div>

        {/* Flat File Format */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Flat File Format
          </label>
          <select
            value={customer.flatFileFormat || "GUI with Delimiter Format"}
            onChange={e => onChange("flatFileFormat", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
          >
            <option value="GUI with Delimiter Format">GUI with Delimiter Format</option>
            <option value="Standard CSV">Standard CSV</option>
            <option value="Fixed Width Text">Fixed Width Text</option>
            <option value="JSON Stream">JSON Stream</option>
            <option value="XML EDI">XML EDI</option>
          </select>
        </div>

        {/* Delimiter */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Delimiter
          </label>
          <input
            type="text"
            maxLength={3}
            value={customer.delimiter || ";"}
            onChange={e => onChange("delimiter", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold text-center focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

      </div>

      {/* Row 2: Status, Last Sync & Logs Action (Matching Reference Screenshot) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        
        {/* Left: EDI Toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={ediEnabled}
              onChange={e => onChange("ediEnabled", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00355f] dark:peer-checked:bg-[#8ebdf9]"></div>
          </label>
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
            EDI / File Integration:{" "}
            <span className={ediEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
              {ediEnabled ? "Enabled" : "Disabled"}
            </span>
          </span>
        </div>

        {/* Middle: Last File Received & Status */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Last File Received
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              15 Oct 2026 14:30
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
            <CheckCircle2 size={13} />
            <span>Success</span>
          </div>
        </div>

        {/* Right: Button */}
        <div>
          <button
            type="button"
            onClick={() => setIsLogsModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] transition shadow-2xs flex items-center gap-1.5"
          >
            <Share2 size={13} />
            <span>View Integration Logs</span>
          </button>
        </div>

      </div>

      {/* Sub-Modal: Integration Logs */}
      <IntegrationLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        customerCode={customer.code}
      />

    </div>
  );
};
