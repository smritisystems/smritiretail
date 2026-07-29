/**
 * Project      : SMRITI Retail OS
 * Module       : Launchpad SDK (SLPSDK - Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { ModuleRegistry } from "../registry/ModuleRegistry.ts";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";
import { QuickActionRegistry } from "../registry/QuickActionRegistry.ts";
import { SearchProviderRegistry } from "../registry/SearchProviderRegistry.ts";
import { CapabilityRegistry } from "../registry/CapabilityRegistry.ts";
import { LaunchpadTileManifest, LaunchpadQuickAction, LaunchpadSearchProvider } from "../types/launchpadTypes.ts";
import { LaunchpadWidgetPlugin } from "../types/widgetTypes.ts";
import { CapabilityDescriptor } from "../types/capabilityTypes.ts";

export const SLPSDK = {
  registerModule: (manifest: LaunchpadTileManifest) => ModuleRegistry.register(manifest),
  registerWidget: (plugin: LaunchpadWidgetPlugin) => WidgetRegistry.register(plugin),
  registerQuickAction: (action: LaunchpadQuickAction) => QuickActionRegistry.register(action),
  registerSearchProvider: (provider: LaunchpadSearchProvider) => SearchProviderRegistry.register(provider),
  registerCapability: (capability: CapabilityDescriptor) => CapabilityRegistry.register(capability)
};
