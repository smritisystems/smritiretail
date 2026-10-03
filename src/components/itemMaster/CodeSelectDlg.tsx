/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { X, Sparkles, CheckCircle, Barcode, Hash, ShieldCheck } from "lucide-react";
import { generateSkuCode } from "../../services/skuGenerationEngine.ts";
import {
  generatePlaceholderBarcode,
  fetchAuthoritativePlaceholderBarcode,
  BARCODE_PREFIX_PRESETS
} from "../../services/barcodePlaceholderService";

interface SmritiCodeSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCode: (code: string, barcode: string) => void;
  currentRow?: {
    brand?: string;
    styleCode?: string;
    colour?: string;
    size?: string;
    name?: string;
  };
}

export const CodeSelectDlg: React.FC<SmritiCodeSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelectCode,
  currentRow = {}
}) => {
  const [prefix, setPrefix] = useState<string>("SMRT");
  const [separator, setSeparator] = useState<string>("-");
  const [includeSize, setIncludeSize] = useState<boolean>(true);
  const [includeColor, setIncludeColor] = useState<boolean>(true);

  // Policy-Governed Placeholder Barcode State
  const [barcodePrefix, setBarcodePrefix] = useState<string>("S");
  const [allowNoBarcodePrefix, setAllowNoBarcodePrefix] = useState<boolean>(true);

  const [customSku, setCustomSku] = useState<string>(() => {
    return generateSkuCode({
      brand: currentRow.brand || "SMRITI",
      styleCode: currentRow.styleCode || "ITEM",
      colour: currentRow.colour || "BLK",
      size: currentRow.size || "M"
    });
  });

  const [customBarcode, setCustomBarcode] = useState<string>(() => {
    return generatePlaceholderBarcode("S", true);
  });

  if (!isOpen) return null;

  const handleRegenerate = async (targetPrefix = barcodePrefix, targetAllowNo = allowNoBarcodePrefix) => {
    const newSku = generateSkuCode({
      brand: currentRow.brand || prefix,
      styleCode: currentRow.styleCode || "ITEM",
      colour: includeColor ? currentRow.colour : undefined,
      size: includeSize ? currentRow.size : undefined
    }, {
      mode: "DERIVED",
      delimiter: separator || "-",
      prefix: prefix
    });
    setCustomSku(newSku);

    const newBarcode = await fetchAuthoritativePlaceholderBarcode(targetPrefix, targetAllowNo);
    setCustomBarcode(newBarcode);
  };

  const handleSelectBarcodePreset = (pfxValue: string) => {
    setBarcodePrefix(pfxValue);
    handleRegenerate(pfxValue, allowNoBarcodePrefix);
  };

  const handleApply = () => {
    onSelectCode(customSku, customBarcode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131b2e] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-[#191c1e] dark:text-[#eff1f3]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e]">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#0052cc]" />
            <h3 className="text-sm font-bold">SKU &amp; Placeholder Barcode Generator</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#76777d] hover:text-[#191c1e] dark:hover:text-white p-1 rounded-md transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          
          {/* Live Preview Card */}
          <div className="p-3 bg-[#e9edff] dark:bg-[#1d3054] rounded-lg border border-[#c4d2ff] dark:border-[#434654] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-[#003d9b] dark:text-[#b2c5ff] uppercase flex items-center gap-1.5">
                <Hash size={14} /> Generated SKU Code:
              </span>
              <span className="font-mono font-bold text-xs bg-white dark:bg-[#131b2e] px-2 py-0.5 rounded border border-[#c4d2ff] dark:border-[#434654]">
                {customSku}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-[#003d9b] dark:text-[#b2c5ff] uppercase flex items-center gap-1.5">
                <Barcode size={14} /> Placeholder Barcode:
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0052cc] dark:text-[#8ab4f8] bg-[#0052cc]/10 px-1.5 py-0.5 rounded">
                  <ShieldCheck size={11} /> Service Policy
                </span>
                <span className="font-mono font-bold text-xs bg-white dark:bg-[#131b2e] px-2 py-0.5 rounded border border-[#c4d2ff] dark:border-[#434654]">
                  {customBarcode}
                </span>
              </div>
            </div>
          </div>

          {/* SKU Generator Options */}
          <div className="space-y-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-3">
            <span className="font-bold text-[11px] text-[#515f74] dark:text-[#bec6e0] uppercase tracking-wide">
              SKU Pattern Settings
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Prefix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Separator</label>
                <select
                  value={separator}
                  onChange={e => setSeparator(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value="/">Slash (/)</option>
                  <option value="">None</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={includeSize}
                  onChange={e => setIncludeSize(e.target.checked)}
                  className="rounded"
                />
                <span>Include Size</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={includeColor}
                  onChange={e => setIncludeColor(e.target.checked)}
                  className="rounded"
                />
                <span>Include Color</span>
              </label>
            </div>
          </div>

          {/* Placeholder Barcode Policy Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-[#515f74] dark:text-[#bec6e0] uppercase tracking-wide">
                Placeholder Barcode Policy (Provisional)
              </span>
              <span className="text-[10px] text-[#76777d] italic">Default: &apos;S&apos; prefix</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {BARCODE_PREFIX_PRESETS.map(preset => {
                const isSelected = barcodePrefix === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleSelectBarcodePreset(preset.value)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition border ${
                      isSelected
                        ? "bg-[#0052cc] text-white border-[#0052cc]"
                        : "bg-white dark:bg-[#191c1e] text-[#515f74] dark:text-[#bec6e0] border-[#c6c6cd] dark:border-[#45464d] hover:border-[#0052cc]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Barcode Prefix Input & Bare Option */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">
                  Active Barcode Prefix
                </label>
                <input
                  type="text"
                  value={barcodePrefix}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    setBarcodePrefix(val);
                  }}
                  placeholder="e.g. S, GEN, SKU"
                  className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs"
                />
              </div>
              <div className="flex flex-col justify-center pt-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={allowNoBarcodePrefix}
                    onChange={e => setAllowNoBarcodePrefix(e.target.checked)}
                    className="rounded"
                  />
                  <span>Allow Bare Token (No Prefix)</span>
                </label>
                <span className="text-[9px] text-[#76777d] mt-0.5">
                  When prefix is empty, emits 12-char hex without prefix
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-start pt-1">
            <button
              type="button"
              onClick={() => handleRegenerate()}
              className="text-[#0052cc] hover:underline font-bold text-xs flex items-center gap-1"
            >
              <Sparkles size={12} /> Regenerate Both SKU &amp; Barcode
            </button>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#eceef0] dark:border-[#2d3133] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#76777d] rounded font-semibold text-xs hover:bg-[#eceef0] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle size={14} />
              Apply Code &amp; Barcode
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default CodeSelectDlg;
