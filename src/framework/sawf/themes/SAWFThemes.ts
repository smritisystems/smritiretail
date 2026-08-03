/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Theme Engine Definitions
 */

export type SAWFTheme = "dark" | "light" | "fiori";

export interface SAWFThemeClasses {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  headerBg: string;
}

export const SAWFThemes: Record<SAWFTheme, SAWFThemeClasses> = {
  dark: {
    bg: "bg-theme-surface-1",
    surface: "bg-theme-surface-2",
    surfaceHover: "hover:bg-theme-surface-hover",
    border: "border-theme-divider",
    textPrimary: "text-theme-heading",
    textMuted: "text-theme-muted",
    accent: "bg-indigo-600 hover:bg-indigo-500 text-white",
    headerBg: "bg-theme-surface-1",
  },
  light: {
    bg: "bg-slate-50",
    surface: "bg-white",
    surfaceHover: "hover:bg-slate-100",
    border: "border-slate-200",
    textPrimary: "text-slate-900",
    textMuted: "text-theme-muted",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    headerBg: "bg-slate-100",
  },
  fiori: {
    bg: "bg-theme-surface-2",
    surface: "bg-theme-surface-2",
    surfaceHover: "hover:bg-theme-surface-hover",
    border: "border-theme-divider",
    textPrimary: "text-white",
    textMuted: "text-theme-body",
    accent: "bg-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/90 text-white",
    headerBg: "bg-theme-surface-1",
  },
};
