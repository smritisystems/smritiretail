/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : SWSDK Platform Entrypoint — Registers all first-party workspaces
 *                into WorkspaceRegistry before SUNEF Navigation initialises.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 *
 * Rule SWSDK-001: Every workspace registers via WorkspaceRegistry.
 * SPF PlatformBootstrap calls initSWSDKRegistry() at Boot Stage 8.
 */

import { WorkspaceRegistry } from "./runtime/WorkspaceRegistry.js";

// ── First-party workspace bundles ──────────────────────────────────────────

const printStudioBundle = {
  manifest: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    title: "Print Studio",
    module: "Platform",
    icon: "printer",
    route: "/platform/print-studio",
    category: "Operations" as const,
    supports: {
      drafts: false,
      resume: false,
      tabs: true,
      attachments: false,
      workflow: false,
      timeline: false,
      print: true,
      export: true,
      analytics: false,
      barcode: true,
      notifications: false
    }
  },
  actions: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    actions: [
      { id: "print", label: "Print Document", priority: "primary" as const, permissionRequired: "print", shortcut: "Ctrl+P" },
      { id: "export", label: "Export PDF", priority: "secondary" as const, permissionRequired: "export" }
    ]
  },
  capabilities: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    capabilities: ["printing", "barcode"] as const
  },
  permissions: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    permissions: [
      { action: "view" as const, code: "PLATFORM.PRINT_STUDIO.VIEW", description: "Access Print Studio" },
      { action: "print" as const, code: "PLATFORM.PRINT_STUDIO.PRINT", description: "Execute print jobs" },
      { action: "export" as const, code: "PLATFORM.PRINT_STUDIO.EXPORT", description: "Export print output" }
    ]
  },
  search: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    providers: ["templates"],
    priority: { templates: 80 },
    commands: [
      { id: "open-print-studio", label: "Open Print Studio", action: "/platform/print-studio", icon: "printer" }
    ]
  },
  events: {
    schemaVersion: "1.0" as const,
    workspaceId: "platform.print-studio",
    eventsEmitted: [
      { eventType: "platform.print-studio.printed", payloadType: "{ documentId: string }", description: "Fired on successful print job" }
    ],
    eventsSubscribed: ["company.changed", "theme.changed"]
  }
};

/**
 * Called by SPF PlatformBootstrap at Boot Stage 8 (SWSDKRegistry).
 */
export function initSWSDKRegistry(): void {
  const registry = WorkspaceRegistry.getInstance();

  try {
    registry.registerWorkspace(printStudioBundle);
    console.info("[SWSDK] ✅ Registered workspace: platform.print-studio");
  } catch (err) {
    console.error("[SWSDK] ❌ Failed to register workspace:", err);
  }
}
