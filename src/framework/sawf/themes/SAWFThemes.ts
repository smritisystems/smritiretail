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
    bg: "bg-[#0E131F]",
    surface: "bg-[#161E2E]",
    surfaceHover: "hover:bg-[#1E293B]",
    border: "border-[#1E293B]",
    textPrimary: "text-slate-100",
    textMuted: "text-slate-400",
    accent: "bg-indigo-600 hover:bg-indigo-500 text-white",
    headerBg: "bg-[#121824]",
  },
  light: {
    bg: "bg-slate-50",
    surface: "bg-white",
    surfaceHover: "hover:bg-slate-100",
    border: "border-slate-200",
    textPrimary: "text-slate-900",
    textMuted: "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    headerBg: "bg-slate-100",
  },
  fiori: {
    bg: "bg-[#354A5F]",
    surface: "bg-[#2F3D4C]",
    surfaceHover: "hover:bg-[#3B4D5F]",
    border: "border-[#4A5D70]",
    textPrimary: "text-white",
    textMuted: "text-slate-300",
    accent: "bg-[#0A6ED1] hover:bg-[#0854A0] text-white",
    headerBg: "bg-[#273543]",
  },
};
