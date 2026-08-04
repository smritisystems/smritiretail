"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEEF_STORAGE_KEY = exports.DEFAULT_SEEF_CONFIG = exports.SEEF_FEATURE_REGISTRY = void 0;
exports.SEEF_FEATURE_REGISTRY = [
    { key: "theme", label: "Theme", scope: "company", governedBy: "admin" },
    { key: "density", label: "Table Density", scope: "user", governedBy: "user" },
    { key: "cardStyle", label: "Card Style", scope: "global", governedBy: "admin" },
    { key: "fontScale", label: "Font Scale", scope: "user", governedBy: "user" },
    { key: "iconPack", label: "Icon Set", scope: "global", governedBy: "admin" },
    { key: "illustrationPack", label: "Illustrations", scope: "global", governedBy: "admin" },
    { key: "navigationMode", label: "Navigation", scope: "role", governedBy: "admin" },
    { key: "toolbarLayout", label: "Toolbar Layout", scope: "role", governedBy: "admin" },
    { key: "formMode", label: "Form Layout", scope: "user", governedBy: "user" },
    { key: "defaultDialogMode", label: "Dialog Mode", scope: "global", governedBy: "admin" },
    { key: "animationPolicy", label: "Animation", scope: "user", governedBy: "user" },
    { key: "reducedMotion", label: "Reduced Motion", scope: "user", governedBy: "system" },
    { key: "highContrast", label: "High Contrast", scope: "user", governedBy: "system" },
    { key: "keyboardFirst", label: "Keyboard First", scope: "user", governedBy: "system" },
    { key: "companyLogoUrl", label: "Company Logo", scope: "company", governedBy: "admin" },
    { key: "brandPrimaryColor", label: "Brand Color", scope: "company", governedBy: "admin" },
];
// ── Default Configuration ───────────────────────────────────────────────────
exports.DEFAULT_SEEF_CONFIG = {
    theme: "enterprise", // SAP Fiori-inspired default workspace theme
    density: "comfortable", // Default density
    cardStyle: "elevated", // Default card elevation
    fontScale: "default", // Standard font scale
    iconPack: "lucide", // Current icon library
    illustrationPack: "enterprise", // Professional illustrations
    navigationMode: "sidebar", // Current sidebar layout
    toolbarLayout: "inline", // Toolbar inside module content
    formMode: "single-page", // All fields visible
    defaultDialogMode: "centered", // Standard modal
    animationPolicy: "full", // All animations active
    reducedMotion: false,
    highContrast: false,
    keyboardFirst: false,
};
// ── Storage Key ─────────────────────────────────────────────────────────────
exports.SEEF_STORAGE_KEY = "smriti_seef_config_v1";
