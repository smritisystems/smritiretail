/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Platform Architecture Inspector (DevTools — Ctrl+Shift+K)
 * Standard     : PR-001 through PR-005 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * Developer inspection modal triggered via Ctrl+Shift+K.
 * Displays live platform diagnostics:
 *   - Kernel Versioning & Health
 *   - Registered UPR Entities, Forms, and Permissions
 *   - Registered UCIF Inspectors & Telemetry
 *   - Registered UDCP Discovery Providers & Sessions
 *   - Active Industry Packs
 */

import React, { useState, useEffect } from "react";
import { SPK } from "../../kernel/SPK.js";
import { EntityRegistry } from "../../kernel/upr/forms/EntityRegistry.js";
import { FormRegistry } from "../../kernel/upr/forms/FormRegistry.js";
import { InspectorRegistry } from "../../kernel/upr/context/InspectorRegistry.js";

export const ArchitectureInspector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"kernels" | "entities" | "inspectors" | "providers" | "plugins">("kernels");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const versions = SPK.version();
  const health = SPK.health();
  const plugins = SPK.plugins();
  const entities = EntityRegistry.getEntities();
  const forms = FormRegistry.getForms();
  const inspectorEntities = InspectorRegistry.getRegisteredEntityTypes();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
    >
      <div className="w-full max-w-4xl bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-theme-accent text-xl">terminal</span>
            <div>
              <h2 className="text-sm font-bold text-theme-text">SMRITI Platform DevTools</h2>
              <p className="text-xs text-theme-muted">Architecture Inspector & Kernel Diagnostics (Ctrl+Shift+K)</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-theme-muted hover:text-theme-text hover:bg-theme-surface-1"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center px-4 py-2 border-b border-theme-divider bg-theme-surface-1 gap-2">
          {(["kernels", "entities", "inspectors", "providers", "plugins"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors
                ${activeTab === tab
                  ? "bg-theme-accent/15 text-theme-accent border border-theme-accent/30"
                  : "text-theme-muted hover:text-theme-text hover:bg-theme-surface-2"
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "kernels" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-2">Kernel Versions</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(versions).map(([k, v]) => (
                    <div key={k} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                      <p className="text-xs text-theme-muted uppercase">{k}</p>
                      <p className="text-sm font-bold text-theme-text font-mono mt-0.5">v{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-2">Kernel Health</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(health).map(([k, status]) => (
                    <div key={k} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg flex items-center justify-between">
                      <span className="text-xs font-medium text-theme-text">{k} Kernel</span>
                      <span className="px-2 py-0.5 text-xs bg-emerald-500/15 text-emerald-500 rounded-full font-semibold">
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "entities" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Registered UPR Entities ({entities.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {entities.map((e) => (
                  <div key={e.id} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-theme-text">{e.name}</p>
                      <span className="text-xs font-mono bg-theme-surface-1 px-1.5 py-0.5 rounded text-theme-muted">{e.id}</span>
                    </div>
                    <p className="text-xs text-theme-muted mt-1">{e.fields.length} Registered Fields • Domain: {e.domainId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "inspectors" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Registered UCIF Inspectors ({inspectorEntities.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {inspectorEntities.map((et) => (
                  <div key={et} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                    <p className="text-sm font-bold text-theme-text capitalize">{et}</p>
                    <p className="text-xs text-theme-muted mt-1">Variants: compact, preview, full</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Loaded Industry Packs ({plugins.length})</h3>
              <div className="space-y-2">
                {plugins.map((p) => (
                  <div key={p.id} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-theme-text">{p.name}</p>
                      <p className="text-xs text-theme-muted font-mono">{p.id} • SDK v{p.sdkVersion}</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs bg-theme-accent/15 text-theme-accent rounded-full font-semibold">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-between text-xs text-theme-muted">
          <span>PR-001 Metadata First • PR-002 Registry First • PR-003 Kernel First</span>
          <span>SMRITI Platform OS v6.0</span>
        </div>
      </div>
    </div>
  );
};
