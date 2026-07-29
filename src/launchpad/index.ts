/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Launchpad Composition Framework Barrel Export (SLP-001 v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

export { LaunchpadShell } from "./components/LaunchpadShell.tsx";
export { LaunchpadConfigTab } from "./components/LaunchpadConfigTab.tsx";
export { SLPSDK } from "./services/launchpadSdk.ts";
export { ModuleRegistry } from "./registry/ModuleRegistry.ts";
export { WidgetRegistry } from "./registry/WidgetRegistry.ts";
export { QuickActionRegistry } from "./registry/QuickActionRegistry.ts";
export { SearchProviderRegistry } from "./registry/SearchProviderRegistry.ts";
export { CapabilityRegistry } from "./registry/CapabilityRegistry.ts";
export { LaunchpadCache } from "./cache/launchpadCache.ts";
export { WORKSPACE_TEMPLATES, getWorkspaceTemplate } from "./config/workspaceTemplates.ts";
