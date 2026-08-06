/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WSP-001 (Workspace Presentation Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import React, { useState, useEffect } from "react";
import { WorkspaceManifest, WorkspacePolicyRegistry, WorkspaceMode } from "../../kernel/upr/workspace/WorkspaceManifest.js";
import { WorkspaceStatusService, WorkspaceStatusPayload, WorkspaceNotification } from "../../kernel/services/WorkspaceStatusService.js";
import { WorkspaceExtensionRegistry } from "../../kernel/upr/workspace/WorkspaceExtensionRegistry.js";
import { LayoutGrid, Layers, SlidersHorizontal, Eye, Bell, CheckCircle2, AlertCircle, Info, RefreshCw, ChevronRight, X } from "lucide-react";
import { SPK } from "../../kernel/SPK.js";
import { useDrillDown } from "../drilldown/drilldown_store.js";
import "../../kernel/upr/context/context.manifest.js";
import { UniversalCommandPalette } from "./UniversalCommandPalette.js";

interface AdaptiveWorkspaceLayoutProps {
  manifest: WorkspaceManifest;
  toolbar?: React.ReactNode;
  ribbon?: React.ReactNode;
  content?: React.ReactNode;
  inspector?: React.ReactNode;
  console?: React.ReactNode;
  emptyState?: React.ReactNode;
  statusBar?: React.ReactNode;
  hasErrors?: boolean;
}

const LAYOUT_STORAGE_KEY_PREFIX = "smriti_workspace_layout_";

export const AdaptiveWorkspaceLayout: React.FC<AdaptiveWorkspaceLayoutProps> = ({
  manifest,
  toolbar,
  ribbon,
  content,
  inspector,
  console: consoleNode,
  emptyState,
  statusBar,
  hasErrors = false,
}) => {
  const policy = WorkspacePolicyRegistry.getPolicy(manifest.id);
  const storageKey = `${LAYOUT_STORAGE_KEY_PREFIX}${manifest.id}`;

  // Layout states initialized from LocalStorage or Policy defaults
  const [mode, setMode] = useState<WorkspaceMode>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_mode`);
      if (saved === "simple" || saved === "standard" || saved === "advanced") return saved;
    } catch {}
    return policy.defaultMode || "standard";
  });

  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [inspectorWidth, setInspectorWidth] = useState<number>(360);
  const [consoleOpen, setConsoleOpen] = useState<boolean>(false);

  // Status & Notification Dock states
  const [status, setStatus] = useState<WorkspaceStatusPayload>(WorkspaceStatusService.getStatus());
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);

  const { openPanel } = useDrillDown();

  // Wire UCIF panel opener bridge to useDrillDown
  useEffect(() => {
    SPK.ucif._injectPanelOpener((ctx) => {
      openPanel({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        title: ctx.title,
        metadata: { variant: ctx.variant },
      });
    });
  }, [openPanel]);

  // Execute lifecycle hook on mount & unmount
  useEffect(() => {
    manifest.hooks?.onOpen?.();
    return () => {
      manifest.hooks?.onClose?.();
    };
  }, [manifest]);

  // Subscribe to status changes & transient notifications
  useEffect(() => {
    const unsubStatus = WorkspaceStatusService.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
    const unsubNotif = WorkspaceStatusService.onNotification((notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 4));
      // Auto-remove notification after 4 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 4000);
    });

    return () => {
      unsubStatus();
      unsubNotif();
    };
  }, []);

  // Auto-expand diagnostic console when validation / save conflicts occur
  useEffect(() => {
    if (hasErrors) {
      setConsoleOpen(true);
      manifest.hooks?.onModeChanged?.(mode);
    }
  }, [hasErrors, manifest, mode]);

  // Persist user mode selection
  const handleModeChange = (newMode: WorkspaceMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(`${storageKey}_mode`, newMode);
    } catch {}
    manifest.hooks?.onModeChanged?.(newMode);
  };

  // Resolve JSX components from manifest if slot props are not directly passed
  const ToolbarComponent = toolbar || (manifest.toolbar ? <manifest.toolbar /> : null);
  const RibbonComponent = ribbon || (manifest.ribbon ? <manifest.ribbon /> : null);
  const ContentComponent = content || (manifest.content ? <manifest.content /> : null);
  const InspectorComponent = inspector || (manifest.inspector ? <manifest.inspector /> : null);
  const ConsoleComponent = consoleNode || (manifest.console ? <manifest.console /> : null);
  const EmptyStateComponent = emptyState || (manifest.emptyState ? <manifest.emptyState /> : null);
  const StatusBarComponent = statusBar || (manifest.statusBar ? <manifest.statusBar /> : null);

  const toolbarExtensions = WorkspaceExtensionRegistry.getExtensions(manifest.id, "Toolbar");
  const ribbonExtensions = WorkspaceExtensionRegistry.getExtensions(manifest.id, "Ribbon");
  const statusBarExtensions = WorkspaceExtensionRegistry.getExtensions(manifest.id, "StatusBar");

  return (
    <div className="w-full flex flex-col min-h-screen bg-theme-surface-0 text-theme-body font-sans select-none">
      
      {/* ── 1. WORKSPACE TOOLBAR ─────────────────────────────────────────────── */}
      <header className="bg-theme-surface-1 border-b border-theme-divider px-4 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-theme-heading font-display tracking-tight leading-tight">
              {manifest.title}
            </h1>
            <div className="text-[10px] text-theme-muted font-mono flex items-center space-x-2">
              <span>SCS-WSP-001</span>
              <span>•</span>
              <span className="uppercase font-semibold text-indigo-400">{mode} Mode</span>
            </div>
          </div>
        </div>

        {/* Toolbar Center / Action Slot */}
        <div className="flex-1 max-w-xl mx-4">
          {ToolbarComponent}
          {toolbarExtensions.map((ext) => (
            <ext.component key={ext.id} />
          ))}
        </div>

        {/* Workspace Mode Switcher (Simple | Standard | Advanced) */}
        <div className="flex items-center space-x-2">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-1 flex items-center space-x-1 font-mono text-[10px]">
            {(["simple", "standard", "advanced"] as WorkspaceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-colors cursor-pointer ${
                  mode === m
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-theme-muted hover:text-theme-heading"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              inspectorOpen
                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-heading"
            }`}
            title="Toggle Workspace Inspector"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </header>

      {/* ── 2. CONTEXT RIBBON (SCS-WCM-001) ─────────────────────────────────── */}
      {mode !== "simple" && (RibbonComponent || ribbonExtensions.length > 0) && (
        <nav className="bg-theme-surface-1/90 border-b border-theme-divider/60 px-4 py-2 flex items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
            {RibbonComponent}
            {ribbonExtensions.map((ext) => (
              <ext.component key={ext.id} />
            ))}
          </div>
        </nav>
      )}

      {/* ── 3 & 4. MAIN CONTENT & WORKSPACE INSPECTOR ───────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Main Content / Grid Area */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {ContentComponent || EmptyStateComponent}
        </main>

        {/* Workspace Inspector Panel */}
        {inspectorOpen && InspectorComponent && (
          <aside
            style={{ width: `${inspectorWidth}px` }}
            className="w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-theme-divider bg-theme-surface-1 p-4 overflow-y-auto flex flex-col shrink-0 space-y-4 shadow-lg transition-all"
          >
            {InspectorComponent}
          </aside>
        )}
      </div>

      {/* ── 5 & 6. DIAGNOSTIC CONSOLE & NOTIFICATION DOCK ───────────────────── */}
      {mode === "advanced" && ConsoleComponent && consoleOpen && (
        <section className="bg-theme-surface-2 border-t border-theme-divider p-3 font-mono text-xs max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-theme-divider/40 pb-1.5 mb-2">
            <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={13} /> Studio Diagnostic Console
            </span>
            <button onClick={() => setConsoleOpen(false)} className="text-theme-muted hover:text-white p-0.5">
              <X size={13} />
            </button>
          </div>
          {ConsoleComponent}
        </section>
      )}

      {/* ── 7. NOTIFICATION DOCK (Transient Toasts) ─────────────────────────── */}
      {notifications.length > 0 && (
        <div className="fixed bottom-12 right-6 z-50 space-y-2 max-w-sm pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl border shadow-xl flex items-center space-x-2.5 font-mono text-xs animate-in slide-in-from-bottom duration-200 pointer-events-auto ${
                n.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
                  : n.type === "error"
                  ? "bg-rose-950/90 border-rose-500/40 text-rose-300"
                  : n.type === "warning"
                  ? "bg-amber-950/90 border-amber-500/40 text-amber-300"
                  : "bg-blue-950/90 border-blue-500/40 text-blue-300"
              }`}
            >
              {n.type === "success" ? <CheckCircle2 size={15} /> : <Info size={15} />}
              <span className="font-semibold">{n.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 8. WORKSPACE STATUS BAR (SCS-WST-001) ────────────────────────────── */}
      <footer className="bg-theme-surface-1 border-t border-theme-divider px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-theme-muted">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status.state === "saved"
                  ? "bg-emerald-400"
                  : status.state === "saving"
                  ? "bg-amber-400 animate-ping"
                  : status.state === "error"
                  ? "bg-rose-400"
                  : "bg-blue-400"
              }`}
            />
            <span className="font-bold text-theme-heading capitalize">{status.message || status.state}</span>
          </div>

          {status.unsavedCount !== undefined && status.unsavedCount > 0 && (
            <span className="text-amber-400 font-bold">
              • {status.unsavedCount} Unsaved Changes
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {StatusBarComponent}
          {statusBarExtensions.map((ext) => (
            <ext.component key={ext.id} />
          ))}
          <span>Workspace: <strong className="text-indigo-300">{manifest.id}</strong></span>
        </div>
      </footer>
      {/* Global Universal Command Palette (USCP v1.0 / Ctrl+K) */}
      <UniversalCommandPalette />
    </div>
  );
};
