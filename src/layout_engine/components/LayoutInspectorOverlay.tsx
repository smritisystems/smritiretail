/**
 * Project      : SMRITI Retail OS
 * Module       : Developer Layout Inspector Overlay (SLGP-001 v2.0 Debug Tool)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";
import { Eye, EyeOff, Layout, Layers, ShieldCheck, Box } from "lucide-react";
import { LAYOUT_TOKENS } from "../tokens/layoutTokens.ts";
import { useLayoutBounds } from "../services/layoutService.ts";

export const LayoutInspectorOverlay: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const bounds = useLayoutBounds();

  const isDev = (import.meta as any)?.env?.DEV;
  if (!isDev) return null;

  if (!isEnabled) {
    return (
      <button
        onClick={() => setIsEnabled(true)}
        className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-50 p-2 rounded-full bg-[var(--c-seef-accent)] text-white shadow-lg hover:scale-105 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
        title="Toggle Layout Inspector Overlay"
      >
        <Layout className="w-4 h-4" />
        <span className="font-mono text-[10px] hidden md:inline">Layout Inspector</span>
      </button>
    );
  }

  return (
    <>
      {/* Visual Bounding Overlay Masks */}
      <div className="fixed inset-0 z-40 pointer-events-none border-4 border-dashed border-[var(--c-seef-accent)]/50">
        {/* Header Bounds Mask */}
        <div
          style={{ height: `${bounds.headerHeight}px` }}
          className="w-full bg-[var(--c-seef-accent)]/10 border-b-2 border-dashed border-[var(--c-seef-accent)] flex items-center justify-between px-4 text-[11px] font-mono text-[var(--c-seef-accent)]"
        >
          <span>Zone A Header ({bounds.headerHeight}px)</span>
          <span>Viewport: {bounds.windowWidth}x{bounds.windowHeight}px</span>
        </div>

        {/* Content & Sidebar Bounds */}
        <div className="flex" style={{ height: `${bounds.availableContentHeight}px` }}>
          <div
            style={{ width: `${bounds.sidebarWidth}px` }}
            className="h-full bg-purple-500/10 border-r-2 border-dashed border-purple-500 p-2 text-[10px] font-mono text-purple-500"
          >
            Sidebar ({bounds.sidebarWidth}px)
          </div>

          <div className="flex-1 h-full bg-emerald-500/10 p-4 text-[10px] font-mono text-emerald-500 flex flex-col justify-between">
            <div>Content Viewport Bounds ({bounds.availableContentWidth}x{bounds.availableContentHeight}px)</div>
            <div className="text-right">Rule SLGP-R6 Active (min-h-0 Flexbox Bounding)</div>
          </div>
        </div>

        {/* Status Bar Bounds */}
        <div
          style={{ height: `${bounds.statusBarHeight}px` }}
          className="w-full bg-amber-500/10 border-t-2 border-dashed border-amber-500 flex items-center justify-between px-4 text-[10px] font-mono text-amber-500"
        >
          <span>Zone H Status Bar ({bounds.statusBarHeight}px)</span>
          <span>Tokens: Header={LAYOUT_TOKENS.HEADER_HEIGHT_PX}px, Sidebar={LAYOUT_TOKENS.SIDEBAR_WIDTH_PX}px</span>
        </div>
      </div>

      {/* Floating Control Widget */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-50 bg-theme-surface-1 border border-[var(--c-seef-accent)] rounded-lg p-3 shadow-2xl space-y-2 text-xs font-mono w-72">
        <div className="flex items-center justify-between border-b border-theme-divider pb-1.5">
          <span className="font-bold text-theme-heading flex items-center gap-1.5">
            <Box className="w-4 h-4 text-[var(--c-seef-accent)]" /> Layout Inspector v2.0
          </span>
          <button
            onClick={() => setIsEnabled(false)}
            className="p-1 text-theme-muted hover:text-theme-heading"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 text-[11px] text-theme-muted">
          <div>Viewport: <strong className="text-theme-heading">{bounds.windowWidth} x {bounds.windowHeight}px</strong></div>
          <div>Header Height: <strong className="text-theme-heading">{bounds.headerHeight}px</strong></div>
          <div>Sidebar Width: <strong className="text-theme-heading">{bounds.sidebarWidth}px</strong></div>
          <div>Content Area: <strong className="text-theme-heading">{bounds.availableContentWidth} x {bounds.availableContentHeight}px</strong></div>
        </div>

        <div className="pt-1 border-t border-theme-divider text-[10px] text-emerald-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> SLGP-001 Tokens Enforced
        </div>
      </div>
    </>
  );
};
