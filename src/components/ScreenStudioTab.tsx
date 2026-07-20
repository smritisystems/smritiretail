/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.2.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { useScreenStudio } from "../layout_engine/screen_studio_store.ts";
import { useSAEFExperience, INDUSTRY_PACKS, IndustryPackType } from "../layout_engine/saef_experience_store.ts";

export const ScreenStudioTab: React.FC = () => {
  const { metadata, updateFieldVisibility, setMaxPrimaryButtons } = useScreenStudio();
  const { pack, setActivePack } = useSAEFExperience();

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            SMRITI Screen Studio & Experience Policy Editor v4.2.0
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual metadata customizer for field visibility, toolbar action buttons, and Industry Pack layout presets.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400">Active Industry Pack:</span>
          <select
            value={pack.id}
            onChange={(e) => setActivePack(e.target.value as IndustryPackType)}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.values(INDUSTRY_PACKS).map((ip) => (
              <option key={ip.id} value={ip.id}>
                {ip.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid customization layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Field Visibility Studio */}
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
            <span>Field Visibility & Ordering ({metadata.screenId.toUpperCase()})</span>
            <span className="text-xs text-slate-400 font-mono">{metadata.fields.length} Fields</span>
          </h2>
          <div className="space-y-2">
            {metadata.fields.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-slate-500">#{f.order}</span>
                  <span className="text-xs font-medium text-slate-200">{f.label}</span>
                </div>
                <label className="flex items-center cursor-pointer space-x-2">
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={(e) => updateFieldVisibility(f.id, e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                  />
                  <span className="text-xs text-slate-400">{f.visible ? "Visible" : "Hidden"}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Policy Toolbar Editor */}
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
            <span>Toolbar Primary Action Buttons Policy</span>
            <span className="text-xs text-slate-400 font-mono">Max: {metadata.maxPrimaryButtons}</span>
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <label className="text-xs text-slate-400">Max Primary Buttons Limit:</label>
              <input
                type="number"
                min={1}
                max={15}
                value={metadata.maxPrimaryButtons}
                onChange={(e) => setMaxPrimaryButtons(parseInt(e.target.value) || 7)}
                className="w-20 bg-slate-800 text-xs text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-center"
              />
            </div>
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Experience Policy Target:</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Default recommendation = 7 buttons. Admin override configured = {metadata.maxPrimaryButtons} buttons. Overflow actions automatically move to the overflow dropdown menu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
