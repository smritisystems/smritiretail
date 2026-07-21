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

export const GstDrawer: React.FC<DrawerPluginProps> = ({ data, onSave, onClose }) => {
  const [gstin, setGstin] = useState(data?.gstin || "");
  const [legalName, setLegalName] = useState(data?.legalName || "");
  const [placeOfSupply, setPlaceOfSupply] = useState(data?.placeOfSupply || "Maharashtra (27)");

  const handleSave = () => {
    onSave({ gstin, legalName, placeOfSupply });
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">GSTIN Number</label>
        <input
          type="text"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="e.g. 27AAAAA0000A1Z5"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Legal Business Name</label>
        <input
          type="text"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="e.g. Super Textiles Ltd"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Place of Supply (State)</label>
        <select
          value={placeOfSupply}
          onChange={(e) => setPlaceOfSupply(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
        >
          <option value="Maharashtra (27)">Maharashtra (27) — Intrastate (CGST+SGST)</option>
          <option value="Delhi (07)">Delhi (07) — Interstate (IGST)</option>
          <option value="Karnataka (29)">Karnataka (29) — Interstate (IGST)</option>
          <option value="Gujarat (24)">Gujarat (24) — Interstate (IGST)</option>
          <option value="Tamil Nadu (33)">Tamil Nadu (33) — Interstate (IGST)</option>
        </select>
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
