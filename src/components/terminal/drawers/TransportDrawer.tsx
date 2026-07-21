/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { DrawerPluginProps } from "../DrawerRegistry";

export const TransportDrawer: React.FC<DrawerPluginProps> = ({ data, onSave, onClose }) => {
  const [transporterName, setTransporterName] = useState(data?.transporterName || "");
  const [vehicleNumber, setVehicleNumber] = useState(data?.vehicleNumber || "");
  const [lrNumber, setLrNumber] = useState(data?.lrNumber || "");
  const [ewayBillNo, setEwayBillNo] = useState(data?.ewayBillNo || "");

  const handleSave = () => {
    onSave({ transporterName, vehicleNumber, lrNumber, ewayBillNo });
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Transporter Name</label>
        <input
          type="text"
          value={transporterName}
          onChange={(e) => setTransporterName(e.target.value)}
          placeholder="e.g. VRL Logistics, SafeExpress"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Vehicle Number</label>
        <input
          type="text"
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
          placeholder="e.g. MH-12-GQ-5432"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">LR / GR Number</label>
        <input
          type="text"
          value={lrNumber}
          onChange={(e) => setLrNumber(e.target.value)}
          placeholder="e.g. LR-9876543"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">12-Digit E-Way Bill Number</label>
        <input
          type="text"
          value={ewayBillNo}
          onChange={(e) => setEwayBillNo(e.target.value)}
          placeholder="12-digit NIC E-Way Bill No"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="pt-4 flex items-center justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider"
        >
          Save Details
        </button>
      </div>
    </div>
  );
};
