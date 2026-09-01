/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.85.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface WavePickItem {
  id: string;
  sku_code: string;
  item_name: string;
  aisle: string;
  bin_location: string;
  bin_rfid_tag: string;
  ordered_qty: number;
  picked_qty: number;
  status: "PENDING" | "IN_PROGRESS" | "PICKED" | "SHORTAGE";
}

interface WarehouseWavePickingModalProps {
  isOpen: boolean;
  onClose: () => void;
  waveId?: string;
  assignedWarehouse?: string;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const WarehouseWavePickingModal: React.FC<WarehouseWavePickingModalProps> = ({
  isOpen,
  onClose,
  waveId = "WAVE-20260828-09",
  assignedWarehouse = "Central Distribution Hub (WH-01)",
  onNotification,
}) => {
  const [rfidScanInput, setRfidScanInput] = useState<string>("");
  const [items, setItems] = useState<WavePickItem[]>([
    {
      id: "WP-01",
      sku_code: "APP-TSHIRT-BLK-M",
      item_name: "Premium Cotton Crew T-Shirt - Black (M)",
      aisle: "Aisle A-01",
      bin_location: "BIN-A01-R02",
      bin_rfid_tag: "RFID-BIN-A01-002",
      ordered_qty: 25,
      picked_qty: 25,
      status: "PICKED",
    },
    {
      id: "WP-02",
      sku_code: "APP-TSHIRT-WHT-L",
      item_name: "Premium Cotton Crew T-Shirt - White (L)",
      aisle: "Aisle A-01",
      bin_location: "BIN-A01-R04",
      bin_rfid_tag: "RFID-BIN-A01-004",
      ordered_qty: 30,
      picked_qty: 18,
      status: "IN_PROGRESS",
    },
    {
      id: "WP-03",
      sku_code: "APP-JEANS-SLIM-32",
      item_name: "Slim Fit Denim Jeans - Indigo (32)",
      aisle: "Aisle B-03",
      bin_location: "BIN-B03-R01",
      bin_rfid_tag: "RFID-BIN-B03-001",
      ordered_qty: 15,
      picked_qty: 0,
      status: "PENDING",
    },
    {
      id: "WP-04",
      sku_code: "ACC-LEATHER-BELT-BRN",
      item_name: "Genuine Leather Dress Belt - Brown",
      aisle: "Aisle C-02",
      bin_location: "BIN-C02-R05",
      bin_rfid_tag: "RFID-BIN-C02-005",
      ordered_qty: 10,
      picked_qty: 0,
      status: "PENDING",
    },
  ]);

  const stats = useMemo(() => {
    const totalOrdered = items.reduce((sum, item) => sum + item.ordered_qty, 0);
    const totalPicked = items.reduce((sum, item) => sum + item.picked_qty, 0);
    const progressPercent = totalOrdered > 0 ? Math.round((totalPicked / totalOrdered) * 100) : 0;
    const isCompleted = progressPercent === 100;

    return { totalOrdered, totalPicked, progressPercent, isCompleted };
  }, [items]);

  const handleSimulateScan = (rfidTag: string) => {
    const target = items.find((i) => i.bin_rfid_tag === rfidTag || i.sku_code === rfidTag);
    if (!target) {
      onNotification?.("Unrecognized RFID Tag", `No matching bin or item for tag: ${rfidTag}`, "error");
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === target.id) {
          const newPicked = Math.min(item.ordered_qty, item.picked_qty + 1);
          return {
            ...item,
            picked_qty: newPicked,
            status: newPicked === item.ordered_qty ? "PICKED" : "IN_PROGRESS",
          };
        }
        return item;
      })
    );

    onNotification?.("RFID Tag Verified", `Picked 1 unit of ${target.sku_code} from ${target.bin_location}`, "success");
    setRfidScanInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <span className="material-symbols-outlined text-2xl">warehouse</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-3">
                Warehouse Wave Picking & RFID Verification Studio
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  {waveId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">{assignedWarehouse} • Optimized Pick Path Routing</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Progress & RFID Scanner Bar */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">
                Picking Progress: <strong className="text-cyan-400">{stats.totalPicked}</strong> / {stats.totalOrdered} Units
              </span>
              <span className="font-mono font-bold text-cyan-300">{stats.progressPercent}% Completed</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </div>

          {/* RFID Scan Input */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">sensors</span>
              <input
                type="text"
                value={rfidScanInput}
                data-field-key="barcode"
                onChange={(e) => setRfidScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rfidScanInput.trim()) {
                    handleSimulateScan(rfidScanInput.trim());
                  }
                }}
                placeholder="Scan Bin RFID / Barcode..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => rfidScanInput.trim() && handleSimulateScan(rfidScanInput.trim())}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow"
            >
              Verify
            </button>
          </div>
        </div>

        {/* Pick Manifest Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950/50">
                <th className="py-2.5 px-3">Location / Bin</th>
                <th className="py-2.5 px-3">SKU & Item Details</th>
                <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                <th className="py-2.5 px-3 text-right">Picked Qty</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/20">
                  <td className="py-3 px-3 font-sans">
                    <span className="font-bold text-cyan-300 block">{item.bin_location}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.aisle} • {item.bin_rfid_tag}</span>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span className="text-slate-100 font-medium block">{item.item_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.sku_code}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300 font-bold">{item.ordered_qty}</td>
                  <td className="py-3 px-3 text-right text-cyan-400 font-bold">{item.picked_qty}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.status === "PICKED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : item.status === "IN_PROGRESS"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleSimulateScan(item.bin_rfid_tag)}
                      disabled={item.status === "PICKED"}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        item.status === "PICKED"
                          ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                          : "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30"
                      }`}
                    >
                      + Scan RFID
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-mono text-[11px]">
              Assigned Staging Bay: <strong className="text-slate-200">BAY-04 (High Street Dispatch)</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              onClick={() => {
                onNotification?.("Wave Dispatched", `Wave ${waveId} committed and moved to Staging Bay 04.`, "success");
                onClose();
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              <span>Complete Wave & Dispatch to Staging</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseWavePickingModal;
