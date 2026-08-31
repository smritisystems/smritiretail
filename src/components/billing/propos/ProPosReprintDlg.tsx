/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { X, Printer, Search, FileText, CheckCircle, Clock, Calendar } from "lucide-react";

interface SmritiProPosReprintDlgProps {
  onReprintBill: (docType: "BILL" | "RETURN", docNo: string) => void;
  onClose: () => void;
}

const RECENT_DOCUMENTS = [
  { docNo: "INV-84919", docType: "BILL" as const, customer: "Farida Jameel", time: "19:45 PM", amount: 1798.20, itemsCount: 2 },
  { docNo: "INV-84918", docType: "BILL" as const, customer: "Customer01 (Walk-in)", time: "18:30 PM", amount: 899.10, itemsCount: 1 },
  { docNo: "CRN-1002", docType: "RETURN" as const, customer: "Rajesh Kumar", time: "17:15 PM", amount: 999.00, itemsCount: 1 },
  { docNo: "INV-84917", docType: "BILL" as const, customer: "Priya Sharma", time: "16:05 PM", amount: 2697.30, itemsCount: 3 }
];

export const SmritiProPosReprintDlg: React.FC<SmritiProPosReprintDlgProps> = ({
  onReprintBill,
  onClose
}) => {
  const [docType, setDocType] = useState<"BILL" | "RETURN">("BILL");
  const [docPrefix, setDocPrefix] = useState<string>("INV");
  const [docNumber, setDocNumber] = useState<string>("");
  const [selectedDoc, setSelectedDoc] = useState<string>(RECENT_DOCUMENTS[0].docNo);

  const handlePrint = (targetNo?: string) => {
    const finalNo = targetNo || (docNumber.trim() ? `${docPrefix}-${docNumber.trim()}` : selectedDoc);
    if (!finalNo) return;
    onReprintBill(docType, finalNo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653] max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#00288e] text-white rounded-lg">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191c1d] dark:text-white">Reprint Document [Alt+6]</h3>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">Reprint a previously generated Tax Invoice or Sales Return Credit Note.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-4 border-b border-[#eceef0] dark:border-[#2d3133] bg-[#f8f9fa] dark:bg-[#131b2e] flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDocType("BILL");
              setDocPrefix("INV");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              docType === "BILL"
                ? "bg-[#00288e] text-white shadow-xs"
                : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] text-[#565e74]"
            }`}
          >
            <FileText size={15} />
            <span>Tax Invoice / Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDocType("RETURN");
              setDocPrefix("CRN");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              docType === "RETURN"
                ? "bg-[#00288e] text-white shadow-xs"
                : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] text-[#565e74]"
            }`}
          >
            <FileText size={15} />
            <span>Sales Return (Credit Note)</span>
          </button>
        </div>

        {/* Input & Recent Documents */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          
          {/* Direct Search */}
          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#565e74] mb-1">Prefix</label>
              <input
                type="text"
                value={docPrefix}
                onChange={e => setDocPrefix(e.target.value)}
                className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl text-xs font-mono font-bold bg-[#f8f9fa] dark:bg-[#131b2e] text-center"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase text-[#565e74] mb-1">Document Number</label>
              <input
                type="text"
                value={docNumber}
                onChange={e => setDocNumber(e.target.value)}
                placeholder="e.g. 84919"
                className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl text-xs font-mono font-bold bg-white dark:bg-[#131b2e]"
              />
            </div>
          </div>

          {/* Recent Invoices Table */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-2">
              Recent Transactions
            </h4>
            <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-xl overflow-hidden divide-y divide-[#eceef0] dark:divide-[#2d3133]">
              {RECENT_DOCUMENTS.map(doc => {
                const isSelected = selectedDoc === doc.docNo;
                return (
                  <div
                    key={doc.docNo}
                    onClick={() => setSelectedDoc(doc.docNo)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? "bg-[#dde1ff] dark:bg-[#1e40af]/30 font-bold"
                        : "hover:bg-[#f8f9fa] dark:hover:bg-[#191c1e]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-[#00288e] dark:text-[#a8b8ff]" />
                      <div>
                        <span className="font-mono text-xs">{doc.docNo}</span>
                        <div className="text-[11px] text-[#565e74] dark:text-[#bec6e0]">
                          {doc.customer} • {doc.time}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-xs">₹{doc.amount.toFixed(2)}</span>
                      <div className="text-[10px] text-[#565e74] dark:text-[#bec6e0]">{doc.itemsCount} items</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] rounded-xl text-xs font-bold hover:bg-[#eceef0] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handlePrint()}
            className="px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={15} />
            <span>Reprint Slip [Enter]</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosReprintDlg;
