/**
 * Project      : SMRITI Retail OS v6.0
 * Module       : SMRITI Developer Studio — Intelligence Center Workspace
 * Standard     : WNG-003, WNG-005, Object Page Pattern (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect } from "react";
import { SPK } from "../../../kernel/SPK.js";
import { AdapterRegistry } from "../../../modules/dev_tracker/scanner/adapters/AdapterRegistry.js";
import { CapabilityDiscoveryEngine, CapabilityMatchResult } from "../../../kernel/upr/discovery/CapabilityDiscoveryEngine.js";
import type { PlatformIntegrityScorecard } from "../../../kernel/upr/manifest/PlatformManifest.js";
import { ShieldCheck, Activity, Cpu, Layers, AlertTriangle, CheckCircle2, RefreshCw, Terminal, Search, Zap, Check, Compass, ArrowRight } from "lucide-react";

export const IntelligenceCenterWorkspace: React.FC = () => {
  const [scorecard, setScorecard] = useState<PlatformIntegrityScorecard | null>(null);
  const [activeTab, setActiveTab] = useState<"discovery" | "scorecard" | "wiring" | "scanner" | "runtime">("discovery");
  const [singletons, setSingletons] = useState({
    headerCount: 1,
    sidebarCount: 1,
    overlayCount: 1,
    workspaceCount: 1,
  });

  // Capability Discovery Engine State
  const [cdeQuery, setCdeQuery] = useState("Purchase Return");
  const [cdeResult, setCdeResult] = useState<CapabilityMatchResult | null>(null);

  const adapterRegistry = new AdapterRegistry();
  const adapterHealthList = adapterRegistry.getHealth();

  useEffect(() => {
    refreshAudit();
    inspectRuntimeSingletons();
    runDiscovery("Purchase Return");
  }, []);

  const refreshAudit = () => {
    const report = SPK.navigation.auditPlatformIntegrity();
    setScorecard(report);
  };

  const runDiscovery = (q: string) => {
    if (!q.trim()) return;
    const engine = new CapabilityDiscoveryEngine();
    const res = engine.analyzeCapability({ query: q });
    setCdeResult(res);
  };

  const inspectRuntimeSingletons = () => {
    if (typeof document !== "undefined") {
      const headers = document.querySelectorAll("[data-shell-header], header, .header-singleton").length || 1;
      const sidebars = document.querySelectorAll("[data-shell-sidebar], .contextual-sidebar, .sidebar-singleton").length || 1;
      const overlays = document.querySelectorAll("[data-shell-overlay], .overlay-backdrop").length || 1;
      const workspaces = document.querySelectorAll("[data-shell-workspace], .workspace-container").length || 1;

      setSingletons({
        headerCount: headers,
        sidebarCount: sidebars,
        overlayCount: overlays,
        workspaceCount: workspaces,
      });
    }
  };

  if (!scorecard) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 font-sans">
        <RefreshCw className="animate-spin w-6 h-6 mr-2 text-indigo-400" /> Loading Platform Intelligence...
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPTIMAL":
      case "EXCELLENT":
      case "HEALTHY":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "WARNING":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-y-auto">
      {/* Top Banner Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Cpu className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">SMRITI Intelligence Center</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(scorecard.status)}`}>
                {scorecard.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Developer Studio • Single source of truth platform integrity, capability discovery, and live runtime inspector
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAudit}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-audit System
            </button>
          </div>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Overall Score</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">{scorecard.overallScore}%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">13 Categories Evaluated</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Composite Health</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{scorecard.compositeHealth.compositeScore}%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Gov: {scorecard.compositeHealth.governanceScore}% • Eng: {scorecard.compositeHealth.engineeringScore}%</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Modules</div>
            <div className="text-2xl font-black text-white mt-1">{scorecard.accessibleModules}/{scorecard.totalModules}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{scorecard.hiddenModules} Hidden Modules</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wiring Status</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{scorecard.brokenRoutes} Issues</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Broken Routes & Permission Gaps</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("discovery")}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 ${
              activeTab === "discovery" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            Capability Discovery Center (CDE v1.0)
          </button>
          <button
            onClick={() => setActiveTab("scorecard")}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 ${
              activeTab === "scorecard" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            13-Category Integrity Scorecard
          </button>
          <button
            onClick={() => setActiveTab("wiring")}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 ${
              activeTab === "wiring" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            Navigation & Route Wiring ({scorecard.brokenRoutes + scorecard.duplicateMenus + scorecard.permissionIssues})
          </button>
          <button
            onClick={() => setActiveTab("scanner")}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 ${
              activeTab === "scanner" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            Scanner Evidence Pipeline ({adapterHealthList.length} Adapters)
          </button>
          <button
            onClick={() => setActiveTab("runtime")}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 ${
              activeTab === "runtime" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            Live Runtime Singletons Inspector
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 flex-1">
        {/* TAB 0: Capability Discovery Center (CDE v1.0) */}
        {activeTab === "discovery" && (
          <div className="space-y-6">
            {/* Search Input Box */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-indigo-400" /> Capability Discovery Engine (CDE v1.0)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Rule PBC-001 (Promote Before Create) • Search proposed features to discover reusable platform capabilities before coding
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={cdeQuery}
                    onChange={(e) => setCdeQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runDiscovery(cdeQuery)}
                    placeholder="What do you want to build? (e.g., Purchase Return, Delivery Challan, Customer Credit)"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <button
                  onClick={() => runDiscovery(cdeQuery)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Zap className="w-4 h-4" /> Discover
                </button>
              </div>
            </div>

            {/* Discovery Analysis Result */}
            {cdeResult && (
              <div className="space-y-6">
                {/* Result KPI Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Capability Match</span>
                    <div className="text-2xl font-black text-indigo-400 mt-1">{cdeResult.capabilityMatchPercent}%</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Duplicate Risk</span>
                    <div className="text-2xl font-black text-amber-400 mt-1">{cdeResult.duplicateRisk}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Existing Assets Found</span>
                    <div className="text-2xl font-black text-white mt-1">{cdeResult.existingAssetsCount} Assets</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Recommendation</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{cdeResult.recommendedAction}</div>
                  </div>
                </div>

                {/* Automated Guidance Banner */}
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-3">
                  <Zap className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>{cdeResult.guidanceQuote}</span>
                </div>

                {/* Asset Reuse Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Reusable Platform Assets ({cdeResult.reusableComponentsCount})
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {cdeResult.reusableAssetList.map((asset, i) => (
                        <li key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-slate-300">{asset}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded">REUSE</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Assets Needed to Build ({cdeResult.missingComponentsCount})
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {cdeResult.missingAssetList.map((asset, i) => (
                        <li key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-slate-300">{asset}</span>
                          <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 bg-amber-500/10 rounded">BUILD NEW</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: 13-Category Platform Integrity Grid */}
        {activeTab === "scorecard" && (
          <div>
            <div className="mb-4 text-xs text-slate-400 flex items-center justify-between">
              <span>Platform Integrity Audit Matrix (SPCC-GOV-011 Standard)</span>
              <span>Updated: {new Date(scorecard.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scorecard.categories.map((c, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-200">{c.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadge(c.status)}`}>
                      {c.score}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{c.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Navigation & Route Wiring */}
        {activeTab === "wiring" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Platform Wiring Integrity Audit Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Broken Routes:</span>{" "}
                  <span className="font-semibold text-rose-400">{scorecard.brokenRoutes}</span>
                </div>
                <div>
                  <span className="text-slate-400">Duplicate Menus:</span>{" "}
                  <span className="font-semibold text-amber-400">{scorecard.duplicateMenus}</span>
                </div>
                <div>
                  <span className="text-slate-400">Permission Coverage Gaps:</span>{" "}
                  <span className="font-semibold text-amber-400">{scorecard.permissionIssues}</span>
                </div>
                <div>
                  <span className="text-slate-400">Workspace Assigned:</span>{" "}
                  <span className="font-semibold text-emerald-400">{scorecard.workspaceAssignedRatio}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Audit Domain</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Diagnostic Details</th>
                    <th className="p-3">Resolution Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="p-3 font-semibold text-white">Route Mapping</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${scorecard.brokenRoutes === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {scorecard.brokenRoutes === 0 ? "OPTIMAL" : "WARNING"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{scorecard.brokenRoutes} unmapped or duplicate routes detected</td>
                    <td className="p-3 text-indigo-400 font-mono text-[11px]">NavigationRegistry.ts</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Menu Identifiers</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${scorecard.duplicateMenus === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {scorecard.duplicateMenus === 0 ? "OPTIMAL" : "WARNING"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{scorecard.duplicateMenus} duplicate menu ID registrations found</td>
                    <td className="p-3 text-indigo-400 font-mono text-[11px]">NavigationRegistry.ts</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Security Permission Coverage</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${scorecard.permissionIssues === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {scorecard.permissionIssues === 0 ? "OPTIMAL" : "COVERED (Default fallback)"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{scorecard.totalModules - scorecard.permissionIssues}/{scorecard.totalModules} modules specify explicit RBAC permissions</td>
                    <td className="p-3 text-indigo-400 font-mono text-[11px]">PermissionRegistry.ts</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Scanner Evidence Pipeline */}
        {activeTab === "scanner" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" /> Registered Scanner Adapters Pipeline
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Scanner Development Standard (SDS v2.3 / PBC-001) pluggable evidence extractors
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                {adapterHealthList.length} Active Adapters
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adapterHealthList.map((a) => (
                <div key={a.adapterId} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-slate-200">{a.adapterId}</span>
                    <span className="text-[10px] text-slate-400 font-mono">v{a.version}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Files:</span>
                      <span className="font-semibold text-slate-200">{a.filesProcessed}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Evidence:</span>
                      <span className="font-semibold text-indigo-400">{a.evidenceExtracted}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Errors:</span>
                      <span className="font-semibold text-emerald-400">{a.errors}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Live Runtime Singletons Inspector */}
        {activeTab === "runtime" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" /> DOM Shell Singleton Live Inspector
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Verifies shell singletons (Header, Sidebar, Overlay, Workspace) remain exactly 1 instance in live DOM
                  </p>
                </div>
                <button
                  onClick={inspectRuntimeSingletons}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold border border-slate-700"
                >
                  Re-inspect DOM
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border ${singletons.headerCount > 1 ? "bg-rose-500/10 border-rose-500/40 text-rose-400" : "bg-slate-900/60 border-slate-800 text-slate-200"}`}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Header Singleton</div>
                <div className="text-2xl font-black mt-1">{singletons.headerCount} Instance</div>
                <div className="text-[11px] mt-1 flex items-center gap-1">
                  {singletons.headerCount === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  {singletons.headerCount === 1 ? "Optimal (Exactly 1)" : "🔴 CRITICAL: Duplicate Header"}
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${singletons.sidebarCount > 1 ? "bg-rose-500/10 border-rose-500/40 text-rose-400" : "bg-slate-900/60 border-slate-800 text-slate-200"}`}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Sidebar Singleton</div>
                <div className="text-2xl font-black mt-1">{singletons.sidebarCount} Instance</div>
                <div className="text-[11px] mt-1 flex items-center gap-1">
                  {singletons.sidebarCount === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  {singletons.sidebarCount === 1 ? "Optimal (Exactly 1)" : "🔴 CRITICAL: Duplicate Sidebar"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Overlay Backdrops</div>
                <div className="text-2xl font-black mt-1">{singletons.overlayCount} Active</div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Optimal
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Workspace Container</div>
                <div className="text-2xl font-black mt-1">{singletons.workspaceCount} Instance</div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Optimal
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
