/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Printer Output Checkboxes Panel Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";
import { CheckSquare } from "lucide-react";

export interface OutputOptionsState {
  doPrint: boolean;
  doPreview: boolean;
  doExportPDF: boolean;
  doSavePRN: boolean;
  doSaveZPL: boolean;
  doSaveEPL: boolean;
  doSaveTSPL: boolean;
}

export interface OutputPanelProps {
  options: OutputOptionsState;
  onOptionsChange: (updated: OutputOptionsState) => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  options,
  onOptionsChange
}) => {
  const toggle = (key: keyof OutputOptionsState) => {
    onOptionsChange({ ...options, [key]: !options[key] });
  };

  return (
    <div className="bg-[#141726] border border-theme-divider rounded-2xl p-4 space-y-3 shadow-xl font-mono text-xs">
      <div className="flex items-center gap-1.5 border-b border-theme-divider pb-2">
        <CheckSquare size={15} className="text-amber-400" />
        <span className="font-bold text-white uppercase text-xs">Printer Output Formats & Actions</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold">
        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-emerald-300">
          <input type="checkbox" checked={options.doPrint} onChange={() => toggle("doPrint")} className="accent-emerald-500" />
          <span>☑ Direct Print</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-indigo-300">
          <input type="checkbox" checked={options.doPreview} onChange={() => toggle("doPreview")} className="accent-indigo-500" />
          <span>☑ Tag Preview</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-amber-300">
          <input type="checkbox" checked={options.doExportPDF} onChange={() => toggle("doExportPDF")} className="accent-amber-500" />
          <span>☑ Export PDF</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-theme-body">
          <input type="checkbox" checked={options.doSavePRN} onChange={() => toggle("doSavePRN")} className="accent-purple-500" />
          <span>☑ Save PRN</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-theme-body">
          <input type="checkbox" checked={options.doSaveZPL} onChange={() => toggle("doSaveZPL")} className="accent-purple-500" />
          <span>☑ Save ZPL</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-theme-body">
          <input type="checkbox" checked={options.doSaveEPL} onChange={() => toggle("doSaveEPL")} className="accent-purple-500" />
          <span>☑ Save EPL</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-theme-divider text-theme-body">
          <input type="checkbox" checked={options.doSaveTSPL} onChange={() => toggle("doSaveTSPL")} className="accent-purple-500" />
          <span>☑ Save TSPL</span>
        </label>
      </div>
    </div>
  );
};
