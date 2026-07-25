/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Selected Item WYSIWYG Preview Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";
import { Eye, FileCode } from "lucide-react";
import { UniversalLabelItem, PrinterProfile } from "../../services/universalLabelPrinterService.ts";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

export interface SelectedItemPreviewProps {
  item: UniversalLabelItem | null;
  activePrinter?: PrinterProfile;
  evaluatedPRNPayload: string;
  itemIndex: number;
  totalItems: number;
}

export const SelectedItemPreview: React.FC<SelectedItemPreviewProps> = ({
  item,
  activePrinter,
  evaluatedPRNPayload,
  itemIndex,
  totalItems
}) => {
  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl flex-1 flex flex-col font-mono text-xs">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-white uppercase flex items-center gap-2">
          <Eye size={16} className="text-indigo-400" />
          Selected Item Detail & Live 2D WYSIWYG Tag Inspector
        </span>

        {totalItems > 0 && (
          <span className="text-[10px] text-amber-300 font-bold bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-500/30">
            Item {itemIndex + 1} of {totalItems}
          </span>
        )}
      </div>

      {item ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {/* Item Details Metadata */}
          <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-2">
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Stock No:</span><span className="text-amber-300 font-bold">{item.stock_no || item.item_code}</span></div>
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Barcode:</span><span className="text-indigo-300 font-bold">{item.barcode}</span></div>
            </div>

            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Product Name:</span><span className="text-white font-bold truncate block">{item.name}</span></div>

            <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-800 py-1.5">
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Brand:</span><span className="text-slate-200">{item.brand || "SMRITI"}</span></div>
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Style:</span><span className="text-slate-200">{item.style || "STYLE-01"}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-1.5">
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Shade:</span><span className="text-slate-200">{item.shade || item.color || "Standard"}</span></div>
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Size:</span><span className="text-slate-200">{item.size || "34"}</span></div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">MRP:</span><span className="text-slate-400 line-through">₹{item.mrp}</span></div>
              <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Selling Price:</span><span className="text-emerald-400 font-bold text-sm">₹{item.price}</span></div>
            </div>
          </div>

          {/* Visual 2D Tag Render & Evaluated RAW Script */}
          <div className="space-y-3 flex flex-col">
            <div className="bg-[#08090e] border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[130px]">
              <div className="max-w-[220px] w-full">
                <BarcodeLabel data={{ items: [{ name: item.name, rate: item.price || 0, barcode: item.barcode }] }} />
              </div>
            </div>

            <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-2.5 space-y-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase block flex items-center gap-1">
                <FileCode size={12} className="text-amber-400" />
                Evaluated RAW Script ({activePrinter?.protocol || "ZPL"})
              </span>
              <pre className="text-amber-300 max-h-20 overflow-x-auto bg-black/60 p-2 rounded">
                {evaluatedPRNPayload}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 text-xs">
          No record matched selection criteria.
        </div>
      )}
    </div>
  );
};
