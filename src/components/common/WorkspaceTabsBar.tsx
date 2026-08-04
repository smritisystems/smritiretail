/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : WorkspaceTabsBar (Chrome / VS Code Style Workspace Tabs Container)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.5.0
 */

import React, { useState, useEffect } from "react";
import { X, Pin, Layout, Plus } from "lucide-react";
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

  if (openWorkspaces.length === 0) return null;

  return (
    <div className="flex items-center bg-theme-surface-3 border-b border-theme-divider px-2 pt-1.5 gap-1 overflow-x-auto select-none font-sans text-xs">
      {openWorkspaces.map((ws) => {
        const isActive = ws.workspaceId === activeId;
        const isPinned = ws.cachePolicy === "Pinned";

        return (
          <div
            key={ws.workspaceId}
            onClick={() => handleSelectTab(ws)}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-xl border transition-all cursor-pointer ${
              isActive
                ? "bg-theme-surface-2 border-theme-divider border-b-slate-900 text-white font-semibold shadow-md"
                : "bg-theme-surface-2 border-transparent text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"
            }`}
          >
            {/* Status Dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ws.status === "Activated" ? "bg-emerald-400" : "bg-amber-400/60"
              }`}
            />

            <Layout size={12} className={isActive ? "text-blue-400" : "text-theme-muted"} />
            <span className="truncate max-w-[130px]">{ws.title}</span>

            {isPinned ? (
              <Pin size={10} className="text-amber-400/80" />
            ) : (
              <button
                onClick={(e) => handleCloseTab(e, ws)}
                className="opacity-0 group-hover:opacity-100 hover:bg-theme-surface-hover p-0.5 rounded transition-all text-theme-muted hover:text-rose-400"
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}

      {/* New Workspace (+) Button */}
      <button
        onClick={() => SUNEFKernel.open({ type: "Item" })}
        className="p-1.5 rounded-lg text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2 transition-all cursor-pointer ml-1"
        title="Open New Workspace"
      >
        <Plus size={13} />
      </button>
    </div>
  );
};
