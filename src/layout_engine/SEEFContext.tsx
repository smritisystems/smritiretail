/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 2)
 * Created      : 2026-07-26
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SMRITI Enterprise Experience Framework (SEEF) — Central Context Provider
 *
 * THE OPERATING EXPERIENCE PROVIDER for SMRITI Retail OS.
 *
 * Every screen consumes useSEEF() to receive resolved visual and interaction
 * configuration without any component-level hardcoding.
 *
 * Responsibilities:
 *  1. Persist SEEF config in localStorage
 *  2. Merge with adaptiveWorkspaceStore (workspace mode)
 *  3. Merge with saefExperienceStore (industry pack)
 *  4. Detect accessibility signals (reduced motion, forced colors)
 *  5. Reactively inject CSS data-attributes onto <html> element
 *     so all CSS tokens update instantly without re-renders
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  SEEFConfig,
  SEEFTheme,
  SEEFDensity,
  SEEFCardStyle,
  SEEFAnimationPolicy,
  SEEFNavigationMode,
  SEEFFormMode,
  SEEFDialogMode,
  SEEFFontScale,
  SEEFIllustrationPack,
  SEEFIconPack,
  SEEFToolbarLayout,
  DEFAULT_SEEF_CONFIG,
  SEEF_STORAGE_KEY,
} from "./SEEFTypes.ts";
import { adaptiveWorkspaceStore } from "./adaptive_workspace_store.ts";
import { saefExperienceStore } from "./saef_experience_store.ts";

// ── Context Type ─────────────────────────────────────────────────────────────

interface SEEFContextType {
  /** The fully resolved SEEF configuration for the current session. */
  config: SEEFConfig;

  /** Update one or more SEEF config fields. Triggers CSS token update immediately. */
  updateSEEF: (patch: Partial<SEEFConfig>) => void;

  /** Reset all SEEF settings to default values. */
  resetSEEF: () => void;

  /** Export current config as a JSON string for backup/import. */
  exportConfig: () => string;

  /** Import a JSON config string (replaces current config). */
  importConfig: (json: string) => boolean;

  /** Whether the SEEF system is fully initialized (used to prevent flash). */
  isReady: boolean;
}

const SEEFContext = createContext<SEEFContextType | null>(null);

// ── CSS Token Injector ────────────────────────────────────────────────────────
// Writes data-seef-* attributes onto <html>. These are read by the CSS
// selectors in index.css to activate the correct token overrides.
function applyConfigToDOM(config: SEEFConfig): void {
  const html = document.documentElement;

  // Theme — activates correct color palette in CSS
  html.setAttribute("data-seef-theme", config.theme);

  // Density — activates spacing/typography scale overrides
  html.setAttribute("data-seef-density", config.density);

  // Card style — activates card surface variant
  html.setAttribute("data-seef-card", config.cardStyle);

  // Animation policy — activates or suppresses motion tokens
  const animPolicy: SEEFAnimationPolicy =
    config.reducedMotion ? "none" : config.animationPolicy;
  html.setAttribute("data-seef-animation", animPolicy);

  // High contrast — activates high-contrast theme override
  if (config.highContrast) {
    html.setAttribute("data-seef-theme", "high-contrast");
  }

  // Font scale — CSS class for accessibility font sizing
  html.setAttribute("data-seef-font-scale", config.fontScale);

  // Dark class (backward compatibility with .dark Tailwind variant)
  if (config.theme === "dark" || config.theme === "corporate") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }

  // Custom brand color injection (when theme = "custom")
  if (config.theme === "custom" && config.brandPrimaryColor) {
    html.style.setProperty("--c-seef-brand", config.brandPrimaryColor);
    html.style.setProperty("--c-seef-accent", config.brandPrimaryColor);
  } else {
    html.style.removeProperty("--c-seef-brand");
    html.style.removeProperty("--c-seef-accent");
  }
}

// ── Accessibility Detector ────────────────────────────────────────────────────
function detectAccessibilitySignals(): Pick<SEEFConfig, "reducedMotion" | "highContrast"> {
  if (typeof window === "undefined") {
    return { reducedMotion: false, highContrast: false };
  }
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    highContrast: window.matchMedia("(forced-colors: active)").matches,
  };
}

// ── Load Persisted Config ─────────────────────────────────────────────────────
function loadPersistedConfig(): SEEFConfig {
  try {
    const raw = localStorage.getItem(SEEF_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SEEF_CONFIG };
    const parsed = JSON.parse(raw) as Partial<SEEFConfig>;
    return { ...DEFAULT_SEEF_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_SEEF_CONFIG };
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface SEEFProviderProps {
  children: React.ReactNode;
}

export const SEEFProvider: React.FC<SEEFProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<SEEFConfig>(() => {
    const persisted = loadPersistedConfig();
    const a11y = detectAccessibilitySignals();
    return { ...persisted, ...a11y };
  });

  const [isReady, setIsReady] = useState(false);

  // ── Apply to DOM whenever config changes ──────────────────────────────────
  useEffect(() => {
    applyConfigToDOM(config);
    if (!isReady) setIsReady(true);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync with adaptiveWorkspaceStore changes ──────────────────────────────
  // SEEF observes workspace mode changes but does not own them.
  useEffect(() => {
    const unsub = adaptiveWorkspaceStore.subscribe(() => {
      // Workspace mode changes may affect navigation visible tabs
      // but do not override SEEF config — SEEF is the governing layer.
      setConfig((prev) => ({ ...prev }));
    });
    return unsub;
  }, []);

  // ── Sync with saefExperienceStore changes ─────────────────────────────────
  useEffect(() => {
    const unsub = saefExperienceStore.subscribe(() => {
      setConfig((prev) => ({ ...prev }));
    });
    return unsub;
  }, []);

  // ── Listen for system accessibility signal changes ────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrastMq = window.matchMedia("(forced-colors: active)");

    const onMotionChange = (e: MediaQueryListEvent) => {
      setConfig((prev) => ({ ...prev, reducedMotion: e.matches }));
    };
    const onContrastChange = (e: MediaQueryListEvent) => {
      setConfig((prev) => ({
        ...prev,
        highContrast: e.matches,
        theme: e.matches ? "high-contrast" : prev.theme,
      }));
    };

    // Detect last input device (keyboard vs pointer) for keyboard-first mode
    const onKeyDown = () => {
      setConfig((prev) =>
        prev.keyboardFirst ? prev : { ...prev, keyboardFirst: true }
      );
    };
    const onPointerDown = () => {
      setConfig((prev) =>
        !prev.keyboardFirst ? prev : { ...prev, keyboardFirst: false }
      );
    };

    motionMq.addEventListener("change", onMotionChange);
    contrastMq.addEventListener("change", onContrastChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      motionMq.removeEventListener("change", onMotionChange);
      contrastMq.removeEventListener("change", onContrastChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // ── Persist to localStorage on every config change ────────────────────────
  useEffect(() => {
    try {
      // Exclude system-detected fields from persistence (re-detected on load)
      const { reducedMotion: _rm, highContrast: _hc, keyboardFirst: _kf, ...toSave } = config;
      localStorage.setItem(SEEF_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage full or unavailable — continue without persistence
    }
  }, [config]);

  // ── updateSEEF ───────────────────────────────────────────────────────────
  const updateSEEF = useCallback((patch: Partial<SEEFConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── resetSEEF ────────────────────────────────────────────────────────────
  const resetSEEF = useCallback(() => {
    const a11y = detectAccessibilitySignals();
    setConfig({ ...DEFAULT_SEEF_CONFIG, ...a11y });
    try {
      localStorage.removeItem(SEEF_STORAGE_KEY);
    } catch { /* noop */ }
  }, []);

  // ── exportConfig ─────────────────────────────────────────────────────────
  const exportConfig = useCallback((): string => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  // ── importConfig ─────────────────────────────────────────────────────────
  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Partial<SEEFConfig>;
      const a11y = detectAccessibilitySignals();
      setConfig({ ...DEFAULT_SEEF_CONFIG, ...parsed, ...a11y });
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<SEEFContextType>(
    () => ({
      config,
      updateSEEF,
      resetSEEF,
      exportConfig,
      importConfig,
      isReady,
    }),
    [config, updateSEEF, resetSEEF, exportConfig, importConfig, isReady]
  );

  return (
    <SEEFContext.Provider value={value}>
      {children}
    </SEEFContext.Provider>
  );
};

// ── useSEEF Hook ──────────────────────────────────────────────────────────────

/**
 * Primary SEEF hook. Every SMRITI component imports this to receive
 * resolved visual and interaction configuration from the SEEF cascade.
 *
 * @example
 * const { config, updateSEEF } = useSEEF();
 * // config.theme, config.density, config.cardStyle, config.animationPolicy…
 */
export function useSEEF(): SEEFContextType {
  const ctx = useContext(SEEFContext);
  if (!ctx) {
    throw new Error(
      "[SEEF] useSEEF() must be called inside <SEEFProvider>. " +
      "Ensure SEEFProvider wraps your App root in main.tsx."
    );
  }
  return ctx;
}

// ── Lightweight selector hooks (avoid prop-drilling) ─────────────────────────

/** Returns only the active SEEFTheme string. */
export function useSEEFTheme(): SEEFTheme {
  return useSEEF().config.theme;
}

/** Returns only the active SEEFDensity string. */
export function useSEEFDensity(): SEEFDensity {
  return useSEEF().config.density;
}

/** Returns only the active SEEFCardStyle string. */
export function useSEEFCardStyle(): SEEFCardStyle {
  return useSEEF().config.cardStyle;
}

/** Returns only the active SEEFAnimationPolicy string. */
export function useSEEFAnimation(): SEEFAnimationPolicy {
  const { config } = useSEEF();
  return config.reducedMotion ? "none" : config.animationPolicy;
}

/** Returns only the active SEEFNavigationMode string. */
export function useSEEFNavigation(): SEEFNavigationMode {
  return useSEEF().config.navigationMode;
}

/** Returns a motion duration in ms based on the active animation policy. */
export function useSEEFMotion(size: "fast" | "normal" | "slow" = "normal"): number {
  const policy = useSEEFAnimation();
  if (policy === "none") return 0;
  const map: Record<typeof size, Record<SEEFAnimationPolicy, number>> = {
    fast:   { full: 100, subtle: 80,  none: 0 },
    normal: { full: 200, subtle: 150, none: 0 },
    slow:   { full: 350, subtle: 250, none: 0 },
  };
  return map[size][policy];
}

// ── Re-export types for convenience ──────────────────────────────────────────
export type {
  SEEFConfig,
  SEEFTheme,
  SEEFDensity,
  SEEFCardStyle,
  SEEFFormMode,
  SEEFAnimationPolicy,
  SEEFNavigationMode,
  SEEFIllustrationPack,
  SEEFDialogMode,
  SEEFFontScale,
  SEEFIconPack,
  SEEFToolbarLayout,
};
