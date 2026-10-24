/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

// ---------------------------------------------------------------------------
// SMRITI Theme Preset System — Canonical Preset Definitions
// ---------------------------------------------------------------------------
// A ThemePreset is a named bundle of: color mode, accent, density, font scale.
// The system applies a preset by:
//   1. Setting data-theme on <html>   → picks the base light/dark palette
//   2. Setting data-density on <html> → activates spacing/row-height tokens
//   3. Overriding --c-theme-primary   → accent color CSS variable
//   4. Persisting preset id to localStorage["smriti-preset"]
// ---------------------------------------------------------------------------

export type ThemeMode    = "light" | "dark";
export type DensityMode  = "compact" | "comfortable" | "spacious";
export type FontScale    = "sm" | "md" | "lg";

export interface ThemePreset {
  /** Unique machine ID — persisted to localStorage & backend */
  id: string;
  /** Human-readable name shown in UI */
  label: string;
  /** Short description for the preset picker tooltip */
  description: string;
  /** Base palette — light or dark */
  mode: ThemeMode;
  /** Accent hex colour — overrides --c-theme-primary at runtime */
  accent: string;
  /** Spacing density applied via data-density attribute */
  density: DensityMode;
  /** Base font size scale */
  fontScale: FontScale;
  /** Swatch colours shown in preset picker (bg + accent) */
  swatchBg: string;
  swatchAccent: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "enterprise-light",
    label: "Enterprise Light",
    description: "SAP Fiori–inspired light workspace — ideal for office & B2B desktop use",
    mode: "light",
    accent: "#0070F2",
    density: "comfortable",
    fontScale: "md",
    swatchBg: "#F5F6F7",
    swatchAccent: "#0070F2",
  },
  {
    id: "enterprise-dark",
    label: "Enterprise Dark",
    description: "Deep navy dark mode — designed for low-light environments and night shift",
    mode: "dark",
    accent: "#0070F2",
    density: "comfortable",
    fontScale: "md",
    swatchBg: "#121721",
    swatchAccent: "#0070F2",
  },
  {
    id: "pos-dark",
    label: "POS Night Mode",
    description: "Compact emerald dark — optimised for touch POS terminals and cashier screens",
    mode: "dark",
    accent: "#10B981",
    density: "compact",
    fontScale: "sm",
    swatchBg: "#0D1B2A",
    swatchAccent: "#10B981",
  },
  {
    id: "retail-day",
    label: "Retail Day",
    description: "Spacious amber light — large touch displays and shop-floor monitors",
    mode: "light",
    accent: "#E9730C",
    density: "spacious",
    fontScale: "lg",
    swatchBg: "#FFFAF5",
    swatchAccent: "#E9730C",
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "WCAG AA+ yellow-on-dark — enhanced visibility for accessibility needs",
    mode: "dark",
    accent: "#FACC15",
    density: "comfortable",
    fontScale: "md",
    swatchBg: "#0A0A0A",
    swatchAccent: "#FACC15",
  },
];

export const DEFAULT_PRESET_ID = "enterprise-light";

/** Lookup a preset by ID; falls back to enterprise-light if not found */
export function getPresetById(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

/** Font-base pixel values keyed by FontScale */
export const FONT_SCALE_MAP: Record<FontScale, string> = {
  sm: "12px",
  md: "13px",
  lg: "14px",
};
