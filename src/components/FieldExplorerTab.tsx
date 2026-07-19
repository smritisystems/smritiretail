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
import { FieldInfo } from "../types";

interface FieldExplorerTabProps {
  fields: FieldInfo[];
}

export const FieldExplorerTab: React.FC<FieldExplorerTabProps> = ({ fields }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("All");

  // Barcode Designer State
  const [selectedFields, setSelectedFields] = useState<string[]>(["item_code", "standard_rate", "hsn_code"]);
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [labelSize, setLabelSize] = useState("50x25");

  const docTypes = ["All", ...Array.from(new Set(fields.map(f => f.docType)))];

  const filteredFields = fields.filter(f => {
    const matchesSearch = f.fieldName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDoc = selectedDocType === "All" || f.docType === selectedDocType;
    return matchesSearch && matchesDoc;
  });

  const toggleFieldSelect = (fieldName: string) => {
    if (selectedFields.includes(fieldName)) {
      setSelectedFields(prev => prev.filter(f => f !== fieldName));
    } else {
      setSelectedFields(prev => [...prev, fieldName]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left panel: Universal Field Explorer (Col span 7) */}
      <div className="lg:col-span-7 bg-theme-surface-1 p-6 rounded-xl border border-theme-divider space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-theme-divider">
          <div>
            <h3 className="font-display font-semibold text-lg text-theme-body">Universal Field Explorer (UFE)</h3>
            <p className="text-xs text-theme-muted">Stable Field Registry & Metadata Registry</p>
          </div>
          <span className="text-xs bg-blue-500 bg-opacity-20 text-blue-400 font-mono font-bold px-2 py-0.5 rounded border border-blue-500">v2.4</span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search field names, descriptors, keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-theme-surface-3 border border-theme-divider text-theme-body text-xs px-3 py-2 rounded focus:outline-none"
          />
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1.5 focus:outline-none"
          >
            {docTypes.map(doc => (
              <option key={doc} value={doc}>{doc === "All" ? "All DocTypes" : doc}</option>
            ))}
          </select>
        </div>

        {/* Fields list */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {filteredFields.map(f => (
            <div key={f.id} className="bg-theme-surface-3 p-3 rounded-lg border border-theme-divider flex justify-between items-start hover:border-[#2563EB] transition-colors">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-theme-body text-xs font-semibold">{f.fieldName}</span>
                  <span className="text-[10px] bg-theme-surface-1 text-theme-muted px-1.5 py-0.2 rounded border border-theme-divider">{f.docType}</span>
                </div>
                <h5 className="text-xs text-theme-body font-medium">{f.label} • <span className="text-theme-muted font-normal">{f.fieldType}</span></h5>
                <p className="text-[11px] text-theme-muted leading-relaxed">{f.description}</p>
                <div className="text-[10px] text-[#22c55e] font-mono">Sample: {f.sampleValue}</div>
              </div>

              <div className="flex flex-col items-end space-y-2 shrink-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  f.isStable 
                    ? "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500" 
                    : "bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500"
                }`}>
                  {f.isStable ? "STABLE FIELD" : "DYNAMIC"}
                </span>

                <button
                  onClick={() => toggleFieldSelect(f.fieldName)}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                    selectedFields.includes(f.fieldName)
                      ? "bg-[#2563EB] text-theme-body hover:bg-opacity-95"
                      : "bg-theme-surface-1 text-theme-muted border border-theme-divider hover:border-[#2563EB] hover:text-theme-body"
                  }`}
                >
                  {selectedFields.includes(f.fieldName) ? "Included" : "Add to Label"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Barcode Studio (Col span 5) */}
      <div className="lg:col-span-5 bg-theme-surface-1 p-6 rounded-xl border border-theme-divider flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-theme-divider">
            <span className="material-symbols-outlined text-emerald-400">qr_code_scanner</span>
            <div>
              <h3 className="font-display font-semibold text-lg text-theme-body">Barcode Studio</h3>
              <p className="text-xs text-theme-muted">Visual Sticker Printability Service</p>
            </div>
          </div>

          {/* Form configurations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-1.5">Print Format:</label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1.5 w-full focus:outline-none"
              >
                <option value="CODE128">Code 128 (Standard)</option>
                <option value="EAN13">EAN-13 (Retail standard)</option>
                <option value="QR">QR Code (2D Token)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-1.5">Label Size:</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
                className="bg-theme-surface-3 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1.5 w-full focus:outline-none"
              >
                <option value="50x25">50mm x 25mm (Classic)</option>
                <option value="100x50">100mm x 50mm (Shipping)</option>
                <option value="38x25">38mm x 25mm (Jewelry)</option>
              </select>
            </div>
          </div>

          {/* Sticker Preview Container */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted uppercase font-display mb-2">Live print mockup render:</label>
            <div className="bg-white rounded-lg p-5 border border-gray-300 text-gray-900 flex flex-col items-center justify-between min-h-[220px]">
              
              {/* Header */}
              <div className="w-full text-center border-b border-gray-300 pb-1.5">
                <span className="text-[10px] font-mono tracking-widest font-bold">SMRITI RETAIL SYSTEM</span>
              </div>

              {/* Dynamic Metadata Fields */}
              <div className="w-full grid grid-cols-2 gap-1 text-[10px] font-mono border-b border-gray-100 pb-2 pt-2">
                {selectedFields.map(fName => {
                  const fObj = fields.find(item => item.fieldName === fName);
                  if (!fObj) return null;
                  return (
                    <div key={fName} className="flex justify-between border-r border-gray-100 pr-2 last:border-0 last:pl-2">
                      <span className="text-gray-400 lowercase">{fObj.label.slice(0, 6)}:</span>
                      <span className="font-bold">{fObj.sampleValue}</span>
                    </div>
                  );
                })}
              </div>

              {/* Barcode representation */}
              <div className="flex flex-col items-center mt-3 space-y-1">
                {barcodeFormat === "QR" ? (
                  <div className="w-16 h-16 bg-theme-surface-1 flex items-center justify-center p-1.5 rounded">
                    <span className="material-symbols-outlined text-theme-body text-4xl">qr_code_2</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="flex items-end justify-center space-x-[1px] h-10 w-48">
                      {/* Barcode lines */}
                      {Array.from({ length: 35 }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className="bg-black" 
                          style={{ 
                            width: idx % 3 === 0 ? "3px" : "1px", 
                            height: idx % 5 === 0 ? "85%" : "100%" 
                          }} 
                        />
                      ))}
                    </div>
                    <span className="text-[8px] font-mono tracking-widest mt-1">SMRITI-BARCODE-302</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Action triggers */}
        <button
          onClick={() => alert("Simulated print payload dispatched to Brother/Zebra TCP raw channel.")}
          className="w-full bg-[#2563EB] hover:bg-opacity-95 text-theme-body font-bold uppercase py-2.5 rounded-lg transition-all flex items-center justify-center space-x-2 mt-4"
        >
          <span className="material-symbols-outlined text-sm">print</span>
          <span>Dispatch Print Test (.PRN)</span>
        </button>
      </div>

    </div>
  );
};
