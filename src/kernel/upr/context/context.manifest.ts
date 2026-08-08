/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Context Manifest (Platform-level WorkspaceAction registrations)
 * Standard     : UCIF-003 (Keyboard Rule — FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * UCIF-003: No keyboard listener outside WorkspaceActionRegistry may trigger inspection.
 *
 * Registers 5 platform-level actions:
 *   inspect_context        F2         → compact inspector panel
 *   inspect_context_full   Ctrl+F2    → full 360° inspector
 *   preview_context        (hover)    → preview card (triggered by InspectorTrigger)
 *   open_context_document  (dblclick) → open full entity workspace
 *   context_menu           (rclick)   → context menu with entity actions
 *
 * These replace any hardcoded keyboard listeners for F2/Ctrl+F2 inspection.
 * Import this file once at application bootstrap (main.tsx or App.tsx).
 */

import { WorkspaceActionRegistry } from "../../../layout_engine/WorkspaceActionRegistry.js";
import { UCIFKernel } from "./UCIFKernel.js";

// ── inspect_context (F2 → compact inspector) ──────────────────────────────────

WorkspaceActionRegistry.register({
  id: "inspect_context",
  label: "Inspect Current Context",
  icon: "search",
  shortcut: "F2",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    const resolved = await UCIFKernel.inspect("compact");
    return {
      success: resolved !== null && resolved.length > 0,
      message: resolved ? `Inspecting ${resolved[0]?.entityType}` : "No context resolved",
    };
  },
});

// ── inspect_context_full (Ctrl+F2 → full 360° inspector) ─────────────────────

WorkspaceActionRegistry.register({
  id: "inspect_context_full",
  label: "Open Full 360° Inspector",
  icon: "expand",
  shortcut: "Ctrl+F2",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    const resolved = await UCIFKernel.inspect("full");
    return {
      success: resolved !== null && resolved.length > 0,
      message: resolved ? `Full inspector: ${resolved[0]?.entityType}` : "No context resolved",
    };
  },
});

// ── preview_context (programmatic — triggered by InspectorTrigger hover) ──────
// Not keyboard-bound. InspectorTrigger calls WorkspaceActionRegistry.execute("preview_context")
// after the hover delay timer fires. Shortcut left undefined intentionally.

WorkspaceActionRegistry.register({
  id: "preview_context",
  label: "Preview Context",
  icon: "eye",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    const resolved = await UCIFKernel.preview();
    return {
      success: resolved !== null,
      data: resolved,
    };
  },
});

// ── open_context_document (double-click → open full entity workspace) ─────────

WorkspaceActionRegistry.register({
  id: "open_context_document",
  label: "Open in Workspace",
  icon: "external-link",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    // Open full entity workspace — falls through to existing SUNEFKernel.open()
    // The entity type and ID are passed via ctx.payload
    const { entityType, entityId } = (_ctx.payload as any) ?? {};
    if (!entityType || !entityId) return { success: false };

    // Dispatch to workspace router — picked up by NavigationRegistry
    window.dispatchEvent(new CustomEvent("ucif:open-workspace", {
      detail: { entityType, entityId }
    }));

    return { success: true };
  },
});

// ── context_menu (right-click → context action menu) ─────────────────────────

WorkspaceActionRegistry.register({
  id: "context_menu",
  label: "Context Actions",
  icon: "more-horizontal",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    const { entityType, entityId, anchorElement } = (_ctx.payload as any) ?? {};
    if (!entityType) return { success: false };

    window.dispatchEvent(new CustomEvent("ucif:show-context-menu", {
      detail: { entityType, entityId, anchorElement }
    }));

    return { success: true };
  },
});

// ── close_inspector (Esc — handled by DrillDownSidePanel, registered here too) ─

WorkspaceActionRegistry.register({
  id: "close_inspector",
  label: "Close Inspector",
  icon: "x",
  shortcut: "Escape",
  adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],

  canExecute: () => true,

  async execute(_ctx) {
    window.dispatchEvent(new CustomEvent("ucif:close-inspector"));
    return { success: true };
  },
});
