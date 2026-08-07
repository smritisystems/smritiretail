/**
 * Project      : SMRITI Retail OS
 * Module       : Launchpad Configuration Tab (Admin Settings â€” SLP-001 v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";
import { Grid, Sliders, CheckCircle2, Save, Sparkles, Layout, ShieldCheck } from "lucide-react";
import { WORKSPACE_TEMPLATES, getWorkspaceTemplate } from "../config/workspaceTemplates.ts";
import { LaunchpadCache } from "../cache/launchpadCache.ts";

interface LaunchpadConfigTabProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const LaunchpadConfigTab: React.FC<LaunchpadConfigTabProps> = ({ onNotification }) => {
  const cacheData = LaunchpadCache.get();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    cacheData.activeTemplateId || "general-retail"
  );
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const template = getWorkspaceTemplate(selectedTemplateId);
    LaunchpadCache.update({ activeTemplateId: selectedTemplateId });
    onNotification(
      "Workspace Template Saved",
      `Activated template: ${template.name}. Default landing set to: ${template.defaultLandingTab}.`,
      "success"
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-theme-base text-theme-body p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Banner Header */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-theme-surface-2 text-theme-body border border-theme-divider flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> SLP-001 / Rule SLP-002 Certified
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-theme-heading flex items-center gap-2">
              <Grid className="w-6 h-6 text-[var(--c-seef-accent)]" /> Launchpad Configuration
            </h1>
            <p className="text-sm text-theme-muted">
              Select industry workspace templates and customize digital desktop density.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Workspace Templates Selector */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2 border-b border-theme-divider pb-2">
              <Layout className="w-4 h-4 text-[var(--c-seef-accent)]" /> Industry Workspace Templates
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WORKSPACE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all shadow-xs flex flex-col justify-between ${
                      isSelected
                        ? "bg-[var(--launchpad-tile-active-border)]/10 border-[var(--launchpad-tile-active-border)] ring-1 ring-[var(--launchpad-tile-active-border)]"
                        : "bg-theme-surface-2 border-theme-divider hover:border-theme-heading"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-theme-heading flex items-center gap-2">
                          {tmpl.name}
                        </h3>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[var(--c-seef-accent)]" />}
                      </div>
                      <p className="text-xs text-theme-muted leading-relaxed">{tmpl.description}</p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-theme-divider flex items-center justify-between text-[11px] font-mono text-theme-muted">
                      <span>Landing: <strong>{tmpl.defaultLandingTab}</strong></span>
                      <span>KPIs: {tmpl.kpiMetrics.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Density Settings */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2 border-b border-theme-divider pb-2">
              <Sliders className="w-4 h-4 text-[var(--c-seef-accent)]" /> UI Layout Density
            </h2>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-theme-heading">
                <input
                  type="radio"
                  name="density"
                  value="comfortable"
                  checked={density === "comfortable"}
                  onChange={() => setDensity("comfortable")}
                  className="accent-[var(--c-seef-accent)]"
                />
                Comfortable (Standard spacing)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-theme-heading">
                <input
                  type="radio"
                  name="density"
                  value="compact"
                  checked={density === "compact"}
                  onChange={() => setDensity("compact")}
                  className="accent-[var(--c-seef-accent)]"
                />
                Compact (High data density)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-theme-divider">
            <span className="text-xs font-mono text-theme-muted">
              Rules SLP-002 & SLP-003 Enforced
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
