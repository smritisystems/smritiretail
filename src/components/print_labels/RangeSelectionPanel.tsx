/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (18-Field Range Selection Panel Sub-Component + Operators)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Sliders, Filter } from "lucide-react";

export type FilterOperator = "range" | "contains" | "starts_with" | "ends_with" | "equals" | "in_list" | "not_equal" | "regex";

export interface SelectionCriteriaState {
  stockNoFrom: string; stockNoTo: string;
  barcodeFrom: string; barcodeTo: string;
  productFrom: string; productTo: string;
  brandFrom: string; brandTo: string;
  categoryFrom: string; categoryTo: string;
  subCategoryFrom: string; subCategoryTo: string;
  departmentFrom: string; departmentTo: string;
  sectionFrom: string; sectionTo: string;
  styleFrom: string; styleTo: string;
  shadeFrom: string; shadeTo: string;
  colorFrom: string; colorTo: string;
  sizeFrom: string; sizeTo: string;
  batchFrom: string; batchTo: string;
  serialFrom: string; serialTo: string;
  supplierFrom: string; supplierTo: string;
  warehouseFrom: string; warehouseTo: string;
  locationFrom: string; locationTo: string;
  hsnFrom: string; hsnTo: string;
}

export interface RangeSelectionPanelProps {
  criteria: SelectionCriteriaState;
  onCriteriaChange: (updated: SelectionCriteriaState) => void;
  productsList: string[];
  brandsList: string[];
  stylesList: string[];
  shadesList: string[];
  sizesList: string[];
}

export const RangeSelectionPanel: React.FC<RangeSelectionPanelProps> = ({
  criteria,
  onCriteriaChange,
  productsList,
  brandsList,
  stylesList,
  shadesList,
  sizesList
}) => {
  const [operator, setOperator] = useState<FilterOperator>("range");

  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl font-mono text-xs">
      <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-2 gap-2">
        <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
          <Sliders size={16} className="text-amber-400" />
          18-Field Selection Criteria Range Boundaries
        </span>

        {/* Enterprise Operator Selector */}
        <div className="flex items-center gap-2 bg-[#0a0c14] border border-slate-800 rounded-xl p-1 text-[11px]">
          <span className="text-[10px] text-slate-400 font-bold px-1 uppercase flex items-center gap-1">
            <Filter size={11} /> Filter Operator:
          </span>
          <select 
            value={operator} 
            onChange={e => setOperator(e.target.value as FilterOperator)} 
            className="bg-[#141726] border border-slate-700 rounded px-2 py-0.5 text-amber-300 font-bold outline-none"
          >
            <option value="range">Range (From → To)</option>
            <option value="contains">Contains (*text*)</option>
            <option value="starts_with">Starts With (text*)</option>
            <option value="ends_with">Ends With (*text)</option>
            <option value="equals">Exact Equals (=)</option>
            <option value="in_list">In List (A, B, C)</option>
            <option value="not_equal">Not Equal (!=)</option>
            <option value="regex">Regex Operator (Dev Mode)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0a0c14] text-slate-400 uppercase text-[10px] sticky top-0">
            <tr>
              <th className="p-2 border border-slate-800">Criteria Boundary Field</th>
              <th className="p-2 border border-slate-800 text-center w-1/3">From Boundary Value</th>
              <th className="p-2 border border-slate-800 text-center w-1/3">To Boundary Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {/* 1. Item Code */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold text-amber-300">1. Item Code / Stock No</td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.stockNoFrom} onChange={e => onCriteriaChange({ ...criteria, stockNoFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center font-bold text-amber-300 outline-none" />
              </td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.stockNoTo} onChange={e => onCriteriaChange({ ...criteria, stockNoTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center font-bold text-amber-300 outline-none" />
              </td>
            </tr>

            {/* 2. Barcode */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold text-indigo-300">2. Barcode Symbol</td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.barcodeFrom} onChange={e => onCriteriaChange({ ...criteria, barcodeFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-indigo-300 outline-none" />
              </td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.barcodeTo} onChange={e => onCriteriaChange({ ...criteria, barcodeTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-indigo-300 outline-none" />
              </td>
            </tr>

            {/* 3. Product */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold">3. Product / Category</td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.productFrom} onChange={e => onCriteriaChange({ ...criteria, productFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {productsList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.productTo} onChange={e => onCriteriaChange({ ...criteria, productTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {productsList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
            </tr>

            {/* 4. Brand */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold">4. Brand Name</td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.brandFrom} onChange={e => onCriteriaChange({ ...criteria, brandFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.brandTo} onChange={e => onCriteriaChange({ ...criteria, brandTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </td>
            </tr>

            {/* 5. Style */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold">5. Style Code</td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.styleFrom} onChange={e => onCriteriaChange({ ...criteria, styleFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.styleTo} onChange={e => onCriteriaChange({ ...criteria, styleTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>

            {/* 6. Shade / Color */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold">6. Shade / Color</td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.shadeFrom} onChange={e => onCriteriaChange({ ...criteria, shadeFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {shadesList.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                </select>
              </td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.shadeTo} onChange={e => onCriteriaChange({ ...criteria, shadeTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {shadesList.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                </select>
              </td>
            </tr>

            {/* 7. Size */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold">7. Size</td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.sizeFrom} onChange={e => onCriteriaChange({ ...criteria, sizeFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {sizesList.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </td>
              <td className="p-2 border border-slate-800">
                <select value={criteria.sizeTo} onChange={e => onCriteriaChange({ ...criteria, sizeTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-xs outline-none">
                  {sizesList.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </td>
            </tr>

            {/* 8. Batch Number */}
            <tr className="hover:bg-slate-800/40">
              <td className="p-2 border border-slate-800 font-bold text-emerald-300">8. Batch Number</td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.batchFrom} onChange={e => onCriteriaChange({ ...criteria, batchFrom: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-emerald-300 outline-none" placeholder="ALL" />
              </td>
              <td className="p-2 border border-slate-800">
                <input type="text" value={criteria.batchTo} onChange={e => onCriteriaChange({ ...criteria, batchTo: e.target.value })} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-center text-emerald-300 outline-none" placeholder="ALL" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
