/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SMRITI Breadcrumb Engine v1.0 — Public Barrel Export
 *
 * Import from this index for all breadcrumb engine access:
 *   import { Breadcrumb, useBreadcrumb, BreadcrumbProvider } from "../navigation/breadcrumb";
 */

// UI Components
export { Breadcrumb } from "./Breadcrumb.tsx";
export { BreadcrumbItem } from "./BreadcrumbItem.tsx";
export { BreadcrumbCompat } from "./BreadcrumbCompat.tsx";

// Context / Hook
export {
  BreadcrumbContext,
  BreadcrumbProvider,
  useBreadcrumb,
  useOptionalBreadcrumb,
} from "./BreadcrumbContext.tsx";
export type { BreadcrumbContextValue, BreadcrumbProviderProps } from "./BreadcrumbContext.tsx";

// Core Engine (for advanced usage / testing)
export { BreadcrumbRegistry } from "./BreadcrumbRegistry.ts";
export { BreadcrumbResolver } from "./BreadcrumbResolver.ts";

// Utilities
export {
  fromLegacyStringArray,
  getBreadcrumbAriaLabel,
  getMobileTrail,
  getTerminalNode,
  isHomePage,
  isOverDepth,
} from "./breadcrumbUtils.ts";

// Types (re-exported for convenience)
export type {
  BreadcrumbNode,
  BreadcrumbRegistryEntry,
  BreadcrumbResolutionContext,
  BreadcrumbTrail,
} from "./BreadcrumbTypes.ts";

export {
  BREADCRUMB_HOME_NODE,
  BREADCRUMB_MAX_DEPTH,
  BREADCRUMB_UNKNOWN_NODE,
  CATEGORY_LABEL_MAP,
} from "./BreadcrumbTypes.ts";
