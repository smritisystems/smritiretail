/**
 * Workspace Kernel Header
 * - Centralized adaptive header rendered by WorkspaceShell
 * - Listens for header updates via WorkspaceEventBus
 * - Responsible for responsive layout (desktop/tablet/mobile) and POS focus mode
 */
import React, { useEffect, useState } from "react";
import { WorkspaceEventBus } from "../WorkspaceEventBus.js";
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";
import { Menu, Search, Bell, User } from "lucide-react";
import { CompanySwitcherBadge } from "../../components/CompanySwitcherBadge.tsx";

export interface KernelHeaderPayload {
  title?: string;
  subtitle?: string;
  documentNo?: string;
  status?: string;
  posFocus?: boolean;
}

export const WorkspaceKernelHeader: React.FC<{ initialTitle?: string }> = ({ initialTitle }) => {
  const { mode, canRender, compactMode, touchMode } = useSmritiExperience();
  const [payload, setPayload] = useState<KernelHeaderPayload>({ title: initialTitle || "" });

  useEffect(() => {
    // subscribe to header updates from studios
    const unsub = WorkspaceEventBus.subscribe("HeaderUpdate", (evt) => {
      setPayload((p) => ({ ...p, ...(evt.payload || {}) }));
    });
    return unsub;
  }, []);

  const isPOS = !!payload.posFocus;

  const headerStyle: React.CSSProperties = {
    height: 'var(--workspace-header-height, clamp(56px, 6vh, 72px))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0 clamp(12px, 2vw, 24px)',
    borderBottom: '1px solid var(--c-theme-divider)',
    background: 'var(--workspace-header-bg, var(--c-theme-surface-2))',
    position: 'sticky',
    top: 0,
    zIndex: 60,
    // respect safe area insets
    paddingTop: 'env(safe-area-inset-top, 0px)',
  };

  const leftStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 };
  const centerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, justifyContent: isPOS ? 'flex-start' : 'center' };
  const rightStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };

  return (
    <header className="sxp-kernel-header" style={headerStyle}>
      <div style={leftStyle}>
        <button aria-label="Open navigation" className="sxp-btn" style={{display:'inline-flex',alignItems:'center',gap:8}}>
          <Menu size={18} />
        </button>
        <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
          <div style={{fontWeight:700,fontSize:16,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {payload.title || initialTitle || 'SMRITI Workspace'}
          </div>
          {payload.subtitle && (
            <div style={{fontSize:11,opacity:0.8,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {payload.subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={centerStyle}>
        {/* Global search — visible on tablet+; keep compact on mobile */}
        <div style={{display: isPOS ? 'none' : 'flex', alignItems:'center', gap:8, width: 'min(640px, 60%)', maxWidth: '100%'}}>
          <Search size={16} />
          <input
            aria-label="Global search"
            placeholder="Search workspaces, customers, invoices..."
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--c-theme-body)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={rightStyle}>
        {/* SCS-WSC-002: Company switcher — hidden in POS focus mode */}
        {!isPOS && <CompanySwitcherBadge />}

        {!isPOS && (
          <button aria-label="Notifications" className="sxp-btn" title="Notifications">
            <Bell size={16} />
          </button>
        )}

        <button aria-label="Profile" className="sxp-btn" title="Profile">
          <User size={16} />
        </button>
      </div>
    </header>
  );
};

export default WorkspaceKernelHeader;
