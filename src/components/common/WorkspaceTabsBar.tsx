/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : WorkspaceTabsBar (SMRITI Fiori Row 2 Tab Architecture)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 4.0.0 (Row 2 Fiori Unified Tab Bar)
 */

import React, { useState, useEffect } from "react";
import { X, Pin, Layout, Plus, Printer, ShoppingCart, Package, Users, BarChart2, FileText, Layers } from "lucide-react";
import { WorkspaceLifecycleManager, ManagedWorkspace } from "../../navigation/WorkspaceLifecycleManager.ts";
import { SUNEFKernel } from "../../navigation/SUNEFKernel.ts";

export const WorkspaceTabsBar: React.FC = () => {
  const [openWorkspaces, setOpenWorkspaces] = useState<ManagedWorkspace[]>([]);
  const [activeId, setActiveId] = useState<string>("dashboard");

  const syncState = () => {
    const list = WorkspaceLifecycleManager.getOpenWorkspaces();
    setOpenWorkspaces(list);
    const active = WorkspaceLifecycleManager.getActiveWorkspace();
    if (active) setActiveId(active.workspaceId);
  };

  useEffect(() => {
    WorkspaceLifecycleManager.initialize();
    syncState();

    const handleActivated = () => syncState();
    window.addEventListener("spf_workspaceactivated", handleActivated);
    window.addEventListener("spf_workspaceopened", handleActivated);
    window.addEventListener("spf_workspaceclosed", handleActivated);
    return () => {
      window.removeEventListener("spf_workspaceactivated", handleActivated);
      window.removeEventListener("spf_workspaceopened", handleActivated);
      window.removeEventListener("spf_workspaceclosed", handleActivated);
    };
  }, []);

  const handleSelectTab = (ws: ManagedWorkspace) => {
    SUNEFKernel.navigateWorkspace(ws.workspaceId, ws.title);
    syncState();
  };

  const handleCloseTab = (e: React.MouseEvent, ws: ManagedWorkspace) => {
    e.stopPropagation();
    WorkspaceLifecycleManager.closeWorkspace(ws.workspaceId);
    syncState();
  };

  const formatTitle = (title: string) => {
    if (!title) return "Workspace";
    if (title.toLowerCase().includes("print") || title.toLowerCase().includes("label")) return "Print Studio";
    if (title.toLowerCase().includes("pos") || title.toLowerCase().includes("billing")) return "POS Terminal";
    if (title.toLowerCase().includes("item") || title.toLowerCase().includes("product")) return "Item Master";
    if (title.toLowerCase().includes("purchase")) return "Purchase Studio";
    if (title.toLowerCase().includes("sales")) return "Sales Studio";
    if (title.toLowerCase().includes("dashboard")) return "Dashboard";
    return title.replace(/-/g, " ");
  };

  const getTabIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("print") || t.includes("label")) return <Printer size={13} className="text-indigo-400" />;
    if (t.includes("pos") || t.includes("billing")) return <ShoppingCart size={13} className="text-emerald-400" />;
    if (t.includes("item") || t.includes("product")) return <Package size={13} className="text-amber-400" />;
    if (t.includes("purchase")) return <Layers size={13} className="text-blue-400" />;
    if (t.includes("sales")) return <BarChart2 size={13} className="text-purple-400" />;
    return <Layout size={13} className="text-theme-muted" />;
  };

  if (openWorkspaces.length === 0) return null;

  return (
    <div className="flex items-center bg-theme-surface-2 border-b border-theme-divider px-4 pt-1.5 gap-1.5 overflow-x-auto select-none font-sans text-xs shadow-xs">
      {openWorkspaces.map((ws) => {
        const isActive = ws.workspaceId === activeId;
        const isPinned = ws.cachePolicy === "Pinned";
        const cleanTitle = formatTitle(ws.title);

        return (
          <div
            key={ws.workspaceId}
            onClick={() => handleSelectTab(ws)}
            className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-t-xl border transition-all cursor-pointer ${
              isActive
                ? "bg-theme-surface-1 border-theme-divider border-b-transparent text-theme-heading font-bold shadow-xs"
                : "bg-theme-surface-2/60 border-transparent text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2 font-medium"
            }`}
          >
            {getTabIcon(ws.title)}
            <span className="capitalize whitespace-nowrap text-xs">{cleanTitle}</span>

            {isPinned ? (
              <Pin size={10} className="text-amber-400 shrink-0 ml-1" />
            ) : (
              <button
                type="button"
                onClick={(e) => handleCloseTab(e, ws)}
                className="opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 p-0.5 rounded transition-all text-theme-muted hover:text-rose-400 cursor-pointer ml-1"
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}

      {/* New Workspace (+) Button */}
      <button
        type="button"
        onClick={() => SUNEFKernel.open({ type: "Item" })}
        className="p-1.5 rounded-lg text-theme-muted hover:text-theme-heading hover:bg-theme-surface-1 transition-all cursor-pointer ml-1"
        title="Open New Workspace"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};
