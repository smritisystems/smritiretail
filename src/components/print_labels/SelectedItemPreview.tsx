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
import { Eye, FileCode, Printer, Download, FolderOpen } from "lucide-react";
import { UniversalLabelItem, PrinterProfile } from "../../services/universalLabelPrinterService.ts";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

export interface SelectedItemPreviewProps {
  item: UniversalLabelItem | null;
  activePrinter?: PrinterProfile;
  evaluatedPRNPayload: string;
  itemIndex: number;
  totalItems: number;
  onPrintSelected?: () => void;
  onOpenPRNFile?: () => void;
  onSavePRNFile?: () => void;
}

export const SelectedItemPreview: React.FC<SelectedItemPreviewProps> = ({
  item,
  activePrinter,
  evaluatedPRNPayload,
  itemIndex,
  totalItems,
  onPrintSelected,
  onOpenPRNFile,
  onSavePRNFile
}) => {
  const stockNo = item?.stock_no || item?.item_code || "000001";
  const barcode = item?.barcode || "8901234560001";
  const name = item?.name || "Custom PRN Template / Stock Tag";
  const brand = item?.brand || "SMRITI";
  const style = item?.style || "STYLE-01";
  const shade = item?.shade || item?.color || "Standard";
  const size = item?.size || "STD";
  const price = item?.price || 1499;
  const mrp = item?.mrp || 2999;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Item Details Metadata */}
        <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-2">
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Stock No:</span><span className="text-amber-300 font-bold">{stockNo}</span></div>
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Barcode:</span><span className="text-indigo-300 font-bold">{barcode}</span></div>
          </div>

          <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Product Name:</span><span className="text-white font-bold truncate block">{name}</span></div>

          <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-800 py-1.5">
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Brand:</span><span className="text-slate-200">{brand}</span></div>
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Style:</span><span className="text-slate-200">{style}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-1.5">
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Shade:</span><span className="text-slate-200">{shade}</span></div>
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Size:</span><span className="text-slate-200">{size}</span></div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">MRP:</span><span className="text-slate-400 line-through">₹{mrp}</span></div>
            <div><span className="text-[9px] text-slate-500 block uppercase font-bold">Selling Price:</span><span className="text-emerald-400 font-bold text-sm">₹{price}</span></div>
          </div>
        </div>

        {/* Visual 2D Tag Render & Evaluated RAW Script */}
        <div className="space-y-3 flex flex-col">
          <div className="bg-[#08090e] border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[130px]">
            <div className="max-w-[220px] w-full">
              <BarcodeLabel data={{ items: [{ name, rate: price, barcode }] }} />
            </div>
          </div>

          <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-2.5 space-y-1 text-[10px]">
            <span className="text-slate-400 font-bold uppercase block flex items-center gap-1">
              <FileCode size={12} className="text-amber-400" />
              Evaluated RAW Script ({activePrinter?.protocol || "ZPL"})
            </span>
            <pre className="text-amber-300 max-h-20 overflow-x-auto bg-black/60 p-2 rounded font-mono">
              {evaluatedPRNPayload}
            </pre>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {onOpenPRNFile && (
              <button 
                type="button" 
                onClick={onOpenPRNFile}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 shadow-md flex items-center justify-center gap-1.5"
                title="Open a PRN / ZPL file from computer"
              >
                <FolderOpen size={14} className="text-amber-400" /> Open PRN File
              </button>
            )}

            {onSavePRNFile && (
              <button 
                type="button" 
                onClick={onSavePRNFile}
                className="flex-1 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-200 font-bold rounded-xl text-xs border border-indigo-800/40 shadow-md flex items-center justify-center gap-1.5"
                title="Save evaluated PRN script to local file"
              >
                <Download size={14} className="text-indigo-400" /> Save PRN File
              </button>
            )}
          </div>

          {onPrintSelected && (
            <button 
              type="button" 
              onClick={onPrintSelected}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-amber-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-xl flex items-center justify-center gap-2 tracking-wide uppercase transition-all"
            >
              <Printer size={16} /> Print Selected Label ({name})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
