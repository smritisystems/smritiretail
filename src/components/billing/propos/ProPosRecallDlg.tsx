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

import React, { useState, useMemo } from "react";
import { SuspendedBill } from "./types.ts";
import { X, Search, History, Trash2, ArrowRight, Clock, User, Package } from "lucide-react";

interface SmritiProPosRecallDlgProps {
  suspendedBills: SuspendedBill[];
  onRecallBill: (bill: SuspendedBill) => void;
  onDeleteSuspendedBill: (id: string) => void;
  onClose: () => void;
}

export const SmritiProPosRecallDlg: React.FC<SmritiProPosRecallDlgProps> = ({
  suspendedBills = [],
  onRecallBill,
  onDeleteSuspendedBill,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return suspendedBills;
    const q = searchQuery.toLowerCase();
    return suspendedBills.filter(b => 
      b.billNo.toLowerCase().includes(q) ||
      b.customer.name.toLowerCase().includes(q) ||
      (b.customer.phone && b.customer.phone.includes(q))
    );
  }, [suspendedBills, searchQuery]);

  const selectedBill = useMemo(() => {
    return suspendedBills.find(b => b.id === selectedBillId) || null;
  }, [suspendedBills, selectedBillId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653] max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center bg-[#f8f9fa] dark:bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white rounded-lg">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191c1d] dark:text-white">Recall Suspended Transaction</h3>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">Select a parked cart to restore to the active terminal.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-hidden flex-1">
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#757684]" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Slip / Bill No, Customer Name, or Mobile..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f3f4f5] dark:bg-[#131b2e] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none text-xs"
            />
          </div>

          {/* Suspended Bills Table */}
          <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-xl overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#edeeef] dark:bg-[#131b2e] sticky top-0 text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
                  <tr>
                    <th className="px-4 py-2.5">Slip / Bill No</th>
                    <th className="px-4 py-2.5">Time Parked</th>
                    <th className="px-4 py-2.5">Customer Name</th>
                    <th className="px-4 py-2.5 text-center">Items</th>
                    <th className="px-4 py-2.5 text-right">Net Value</th>
                    <th className="px-4 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edeeef] dark:divide-[#2d3133]">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#757684]">
                        <Package size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No suspended bills currently parked in queue.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(b => {
                      const isSelected = selectedBillId === b.id;
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBillId(b.id)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-[#dde1ff] dark:bg-[#1e40af]/30 font-semibold"
                              : "hover:bg-[#f8f9fa] dark:hover:bg-[#2d3133]"
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                            {b.billNo}
                          </td>
                          <td className="px-4 py-3 text-[#565e74] dark:text-[#bec6e0] flex items-center gap-1.5">
                            <Clock size={12} />
                            {b.timestamp}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold">{b.customer.name}</div>
                            {b.customer.phone && <div className="text-[10px] text-[#565e74]">{b.customer.phone}</div>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            {b.itemCount} items ({b.totalQty} qty)
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                            ₹{b.netAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRecallBill(b);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-[#00288e] text-white rounded text-[11px] font-bold hover:bg-[#1e40af] transition"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSuspendedBill(b.id);
                                }}
                                className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition"
                                title="Discard Parked Bill"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center">
          <span className="text-xs text-[#565e74] dark:text-[#bec6e0]">
            {suspendedBills.length} Bill{suspendedBills.length !== 1 ? 's' : ''} currently held in terminal memory.
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#565e74] hover:bg-[#e7e8e9] rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedBill}
              onClick={() => {
                if (selectedBill) {
                  onRecallBill(selectedBill);
                  onClose();
                }
              }}
              className="px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-40 shadow-sm"
            >
              <span>Recall Selected [Enter]</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosRecallDlg;
