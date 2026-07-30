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

const scdmChannelDistributionBundle = {
  manifest: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    title: "SCDM Channel Distribution",
    module: "ChannelDistribution",
    icon: "truck",
    route: "/scdm/channel-distribution",
    category: "Operations" as const,
    supports: {
      drafts: true,
      resume: true,
      tabs: true,
      attachments: true,
      workflow: true,
      timeline: true,
      print: true,
      export: true,
      analytics: true,
      barcode: true,
      notifications: true,
    },
  },
  actions: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    actions: [
      { id: "ingest-sellout", label: "Ingest Sell-Out", priority: "primary" as const, permissionRequired: "scdm.sellout.import", shortcut: "Ctrl+I" },
      { id: "reconcile", label: "Run Reconciliation", priority: "secondary" as const, permissionRequired: "scdm.reconcile" },
      { id: "export-report", label: "Export Report", priority: "secondary" as const, permissionRequired: "scdm.reports.view" },
    ],
  },
  capabilities: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    capabilities: ["analytics", "audit", "workflow", "timeline", "barcode"] as const,
  },


  permissions: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    permissions: [
      { action: "view" as const, code: "SCDM.DISPATCH.VIEW", description: "View channel dispatches and inventory" },
      { action: "create" as const, code: "SCDM.SELLOUT.IMPORT", description: "Ingest sell-out data from files or API" },
      { action: "edit" as const, code: "SCDM.RECONCILE", description: "Run stock and value reconciliation" },
    ],
  },

  search: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    providers: ["dispatches", "customers"],
    priority: { dispatches: 90, customers: 85 },
    commands: [
      { id: "open-scdm-studio", label: "Open SCDM Channel Distribution Studio", action: "/scdm/channel-distribution", icon: "truck" },
    ],
  },
  events: {
    schemaVersion: "1.0" as const,
    workspaceId: "scdm.channel-distribution",
    eventsEmitted: [
      { eventType: "scdm.channel_dispatch.created", payloadType: "{ dispatchId: string }", description: "Fired on auto-dispatch creation" },
      { eventType: "scdm.sellout.imported", payloadType: "{ importId: string }", description: "Fired on sell-out import completion" },
    ],
    eventsSubscribed: ["sales.invoice.posted", "sales.invoice.cancelled"],
  },
};

/**
 * Called by SPF PlatformBootstrap at Boot Stage 8 (SWSDKRegistry).
 */
export function initSWSDKRegistry(): void {
  const registry = WorkspaceRegistry.getInstance();

  try {
    registry.registerWorkspace(printStudioBundle);
    console.info("[SWSDK] ✅ Registered workspace: platform.print-studio");

    registry.registerWorkspace(scdmChannelDistributionBundle);
    console.info("[SWSDK] ✅ Registered workspace: scdm.channel-distribution");
  } catch (err) {
    console.error("[SWSDK] ❌ Failed to register workspace:", err);
  }
}

