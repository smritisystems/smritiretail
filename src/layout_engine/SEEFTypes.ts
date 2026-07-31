/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 2)
 * Created      : 2026-07-26
 * Modified     : 2026-07-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SMRITI Enterprise Experience Framework (SEEF) — Type Definitions
 *
 * Single source of truth for all SEEF configuration types.
 * These types govern every UI, UX, interaction, layout, workflow,
 * accessibility, and branding rule across SMRITI Retail OS.
 *
 * SEEF Resolution Cascade:
 *   SEEF Engine → Theme → Layout → Navigation → Workspace Mode
 *   → Industry Pack → Role → User Preferences → Render Screen
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Theme ──────────────────────────────────────────────────────────────────
export type SEEFTheme =
  | "enterprise"     // SAP Fiori Horizon-inspired clean light
  | "fiori-light"    // Authentic SAP Fiori 3 / Morning Horizon Light
  | "light"          // Standard light mode
  | "dark"           // SAP Fiori Quartz Dark Slate Navy
  | "high-contrast"  // WCAG AAA accessible
  | "corporate"      // Deep navy professional
  | "minimal"        // Clean distraction-free
  | "custom";        // Company branding override

// ── Density / Spacing ───────────────────────────────────────────────────────
export type SEEFDensity =
  | "compact"        // Tight padding, smaller font — for high-density data screens
  | "comfortable"    // Default enterprise balance
  | "spacious";      // Generous breathing room — for executive dashboards

// ── Card / Surface Style ────────────────────────────────────────────────────
export type SEEFCardStyle =
  | "flat"           // No shadow, flat border
  | "elevated"       // Box shadow, white surface
  | "glass"          // Glassmorphism — backdrop blur + translucent
  | "minimal"        // No shadow, no border
  | "outlined"       // Clear border only
  | "floating";      // Strong shadow — prominent elevation

// ── Form Layout Mode ────────────────────────────────────────────────────────
export type SEEFFormMode =
  | "single-page"    // All fields visible at once
  | "wizard"         // Step-by-step multi-page
  | "tabbed"         // Organized into tabs
  | "accordion";     // Collapsible sections

// ── Animation Policy ────────────────────────────────────────────────────────
export type SEEFAnimationPolicy =
  | "full"           // All transitions and micro-animations active
  | "subtle"         // Reduced speed/intensity
  | "none";          // All animations off (accessibility / performance)

// ── Navigation Mode ─────────────────────────────────────────────────────────
export type SEEFNavigationMode =
  | "sidebar"        // Standard left sidebar (current SMRITI default)
  | "rail"           // Icon-only 56px rail with tooltips
  | "top-nav"        // Horizontal navigation bar
  | "mega-menu";     // Full-screen mega menu (for complex role setups)

// ── Illustration Pack ───────────────────────────────────────────────────────
export type SEEFIllustrationPack =
  | "none"           // No decorative illustrations
  | "minimal"        // Subtle line geometry
  | "enterprise"     // Professional abstract
  | "historical"     // Historical architecture line art
  | "cultural"       // Indian cultural motifs
  | "abstract";      // Geometric abstract

// ── Dialog / Panel Mode ─────────────────────────────────────────────────────
export type SEEFDialogMode =
  | "centered"       // Traditional modal centered on screen
  | "right-panel"    // Slide-in from right (Object Page detail)
  | "bottom-sheet"   // Slide up from bottom (mobile-first)
  | "fullscreen"     // Full viewport takeover
  | "split-view";    // Side-by-side list + detail

// ── Font Scale ──────────────────────────────────────────────────────────────
export type SEEFFontScale =
  | "small"          // For very dense data operator screens
  | "default"        // Standard
  | "large"          // Accessibility — low vision
  | "xl";            // Accessibility — very low vision

// ── Icon Pack ───────────────────────────────────────────────────────────────
export type SEEFIconPack =
  | "lucide"         // Current: lucide-react
  | "material"       // Google Material Symbols (already loaded)
  | "mixed";         // Both — module-level choice

// ── Toolbar Layout ──────────────────────────────────────────────────────────
export type SEEFToolbarLayout =
  | "inline"         // Toolbar inside the module content area
  | "shell-bar"      // Actions in the top shell bar
  | "contextual";    // Context-sensitive actions appear near selection

// ── Master SEEF Configuration Schema ───────────────────────────────────────
export interface SEEFConfig {
  // Visual
  theme: SEEFTheme;
  density: SEEFDensity;
  cardStyle: SEEFCardStyle;
  fontScale: SEEFFontScale;
  iconPack: SEEFIconPack;
  illustrationPack: SEEFIllustrationPack;

  // Layout & Navigation
  navigationMode: SEEFNavigationMode;
  toolbarLayout: SEEFToolbarLayout;

  // Interaction
  formMode: SEEFFormMode;
  defaultDialogMode: SEEFDialogMode;
  animationPolicy: SEEFAnimationPolicy;

  // Accessibility (auto-detected, can be manually overridden)
  reducedMotion: boolean;    // from prefers-reduced-motion OR animationPolicy = "none"
  highContrast: boolean;     // from forced-colors media query OR theme = "high-contrast"
  keyboardFirst: boolean;    // true when last input device was keyboard

  // Branding
  companyLogoUrl?: string;
  brandPrimaryColor?: string;  // Only active when theme = "custom"
}

// ── SEEF Configurable Feature Registry ─────────────────────────────────────
// Documents every configurable feature and its config key — used by
// SEEFAdminConfigurator and SEEFGovernanceEngine for compliance auditing.
export interface SEEFFeatureRegistration {
  key: keyof SEEFConfig;
  label: string;
  scope: "global" | "company" | "role" | "user" | "module";
  governedBy: "admin" | "user" | "system";
}

export const SEEF_FEATURE_REGISTRY: SEEFFeatureRegistration[] = [
  { key: "theme",             label: "Theme",              scope: "company",  governedBy: "admin" },
  { key: "density",           label: "Table Density",      scope: "user",     governedBy: "user" },
  { key: "cardStyle",         label: "Card Style",         scope: "global",   governedBy: "admin" },
  { key: "fontScale",         label: "Font Scale",         scope: "user",     governedBy: "user" },
  { key: "iconPack",          label: "Icon Set",           scope: "global",   governedBy: "admin" },
  { key: "illustrationPack",  label: "Illustrations",      scope: "global",   governedBy: "admin" },
  { key: "navigationMode",    label: "Navigation",         scope: "role",     governedBy: "admin" },
  { key: "toolbarLayout",     label: "Toolbar Layout",     scope: "role",     governedBy: "admin" },
  { key: "formMode",          label: "Form Layout",        scope: "user",     governedBy: "user" },
  { key: "defaultDialogMode", label: "Dialog Mode",        scope: "global",   governedBy: "admin" },
  { key: "animationPolicy",   label: "Animation",          scope: "user",     governedBy: "user" },
  { key: "reducedMotion",     label: "Reduced Motion",     scope: "user",     governedBy: "system" },
  { key: "highContrast",      label: "High Contrast",      scope: "user",     governedBy: "system" },
  { key: "keyboardFirst",     label: "Keyboard First",     scope: "user",     governedBy: "system" },
  { key: "companyLogoUrl",    label: "Company Logo",       scope: "company",  governedBy: "admin" },
  { key: "brandPrimaryColor", label: "Brand Color",        scope: "company",  governedBy: "admin" },
];

// ── Default Configuration ───────────────────────────────────────────────────
export const DEFAULT_SEEF_CONFIG: SEEFConfig = {
  theme:              "enterprise",    // SAP Fiori-inspired default workspace theme
  density:            "comfortable",   // Default density
  cardStyle:          "elevated",      // Default card elevation
  fontScale:          "default",       // Standard font scale
  iconPack:           "lucide",        // Current icon library
  illustrationPack:   "enterprise",    // Professional illustrations
  navigationMode:     "sidebar",       // Current sidebar layout
  toolbarLayout:      "inline",        // Toolbar inside module content
  formMode:           "single-page",   // All fields visible
  defaultDialogMode:  "centered",      // Standard modal
  animationPolicy:    "full",          // All animations active
  reducedMotion:      false,
  highContrast:       false,
  keyboardFirst:      false,
};

// ── Storage Key ─────────────────────────────────────────────────────────────
export const SEEF_STORAGE_KEY = "smriti_seef_config_v1";
