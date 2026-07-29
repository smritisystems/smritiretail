/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0  (SEEF Phase 8 - Theme token cascade)
 * Created      : 2026-07-20
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { DrawerPluginProps } from "../DrawerRegistry";

// Shared input/label classes for all drawer form fields
const fieldLabel = "block text-[10px] font-mono text-theme-muted uppercase mb-1";
const fieldInput = "w-full bg-theme-base border border-theme-divider rounded px-3 py-2 text-theme-heading font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors";

export const TransportDrawer: React.FC<DrawerPluginProps> = ({ data, onSave, onClose }) => {
  const [transporterName, setTransporterName] = useState(data?.transporterName || "");
  const [vehicleNumber, setVehicleNumber] = useState(data?.vehicleNumber || "");
  const [lrNumber, setLrNumber] = useState(data?.lrNumber || "");
  const [ewayBillNo, setEwayBillNo] = useState(data?.ewayBillNo || "");

  const handleSave = () => {
    onSave({ transporterName, vehicleNumber, lrNumber, ewayBillNo });
  };

  return (
    // SEEF Phase 8: bg-theme-surface-2 → bg-theme-base; border-theme-divider → border-theme-divider
    <div className="space-y-4 font-sans text-xs">
      <div>
        <label className={fieldLabel}>Transporter Name</label>
        <input
          type="text"
          value={transporterName}
          onChange={(e) => setTransporterName(e.target.value)}
          placeholder="e.g. VRL Logistics, SafeExpress"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>Vehicle Number</label>
        <input
          type="text"
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
          placeholder="e.g. MH-12-GQ-5432"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>LR / GR Number</label>
        <input
          type="text"
          value={lrNumber}
          onChange={(e) => setLrNumber(e.target.value)}
          placeholder="e.g. LR-9876543"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>12-Digit E-Way Bill Number</label>
        <input
          type="text"
          value={ewayBillNo}
          onChange={(e) => setEwayBillNo(e.target.value)}
          placeholder="12-digit NIC E-Way Bill No"
          className={fieldInput}
        />
      </div>

      <div className="pt-4 flex items-center justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded border border-theme-divider text-theme-muted hover:bg-theme-surface-2 text-xs font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors"
        >
          Save Details
        </button>
      </div>
    </div>
  );
};
