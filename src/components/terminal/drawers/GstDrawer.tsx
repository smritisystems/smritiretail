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

// Shared input/label/select classes for GST drawer form fields
const fieldLabel  = "block text-[10px] font-mono text-theme-muted uppercase mb-1";
const fieldInput  = "w-full bg-theme-base border border-theme-divider rounded px-3 py-2 text-theme-heading font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors";
const fieldSelect = "w-full bg-theme-base border border-theme-divider rounded px-3 py-2 text-theme-heading text-xs focus:outline-none focus:border-blue-500 font-mono transition-colors";

export const GstDrawer: React.FC<DrawerPluginProps> = ({ data, onSave, onClose }) => {
  const [gstin, setGstin] = useState(data?.gstin || "");
  const [legalName, setLegalName] = useState(data?.legalName || "");
  const [placeOfSupply, setPlaceOfSupply] = useState(data?.placeOfSupply || "Maharashtra (27)");

  const handleSave = () => {
    onSave({ gstin, legalName, placeOfSupply });
  };

  return (
    // SEEF Phase 8: bg-slate-900 → bg-theme-base; border-slate-700 → border-theme-divider
    <div className="space-y-4 font-sans text-xs">
      <div>
        <label className={fieldLabel}>GSTIN Number</label>
        <input
          type="text"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="e.g. 27AAAAA0000A1Z5"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>Legal Business Name</label>
        <input
          type="text"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="e.g. Super Textiles Ltd"
          className={fieldInput}
        />
      </div>

      <div>
        <label className={fieldLabel}>Place of Supply (State)</label>
        <select
          value={placeOfSupply}
          onChange={(e) => setPlaceOfSupply(e.target.value)}
          className={fieldSelect}
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
