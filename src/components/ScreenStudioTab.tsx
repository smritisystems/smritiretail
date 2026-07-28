/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 */

import React from "react";
import { useScreenStudio } from "../layout_engine/screen_studio_store.ts";
import { useSAEFExperience, INDUSTRY_PACKS, IndustryPackType } from "../layout_engine/saef_experience_store.ts";

export const ScreenStudioTab: React.FC = () => {
  const { metadata, updateFieldVisibility, setMaxPrimaryButtons } = useScreenStudio();
  const { pack, setActivePack } = useSAEFExperience();

  return (
    <div className="p-6 bg-theme-base w-full h-full text-theme-body font-sans space-y-6 select-none">
      {/* Header */}
      <div className="flex justify-between items-center bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider">
        <div>
          <h1 className="text-xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            SMRITI Screen Studio & Experience Policy Editor v5.1.0
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Visual metadata customizer for field visibility, toolbar action buttons, and Industry Pack layout presets.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-theme-muted">Active Industry Pack:</span>
          <select
            value={pack.id}
            onChange={(e) => setActivePack(e.target.value as IndustryPackType)}
            className="bg-theme-surface-2 text-xs text-theme-heading border border-theme-divider px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider space-y-4">
          <h2 className="text-sm font-semibold text-theme-heading flex items-center justify-between">
            <span>Field Visibility & Ordering ({metadata.screenId.toUpperCase()})</span>
            <span className="text-xs text-theme-muted font-mono">{metadata.fields.length} Fields</span>
          </h2>
          <div className="space-y-2">
            {metadata.fields.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-2 border border-theme-divider hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-theme-muted">#{f.order}</span>
                  <span className="text-xs font-medium text-theme-heading">{f.label}</span>
                </div>
                <label className="flex items-center cursor-pointer space-x-2">
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={(e) => updateFieldVisibility(f.id, e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-theme-surface-2 border-theme-divider"
                  />
                  <span className="text-xs text-theme-muted">{f.visible ? "Visible" : "Hidden"}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Policy Toolbar Editor */}
        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider space-y-4">
          <h2 className="text-sm font-semibold text-theme-heading flex items-center justify-between">
            <span>Toolbar Primary Action Buttons Policy</span>
            <span className="text-xs text-theme-muted font-mono">Max: {metadata.maxPrimaryButtons}</span>
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <label className="text-xs text-theme-muted">Max Primary Buttons Limit:</label>
              <input
                type="number"
                min={1}
                max={15}
                value={metadata.maxPrimaryButtons}
                onChange={(e) => setMaxPrimaryButtons(parseInt(e.target.value) || 7)}
                className="w-20 bg-theme-surface-2 text-xs text-theme-heading border border-theme-divider px-3 py-1.5 rounded-lg text-center"
              />
            </div>
            <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider space-y-2">
              <div className="text-xs font-semibold text-theme-heading">Experience Policy Target:</div>
              <p className="text-[11px] text-theme-muted leading-relaxed">
                Default recommendation = 7 buttons. Admin override configured = {metadata.maxPrimaryButtons} buttons. Overflow actions automatically move to the overflow dropdown menu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
