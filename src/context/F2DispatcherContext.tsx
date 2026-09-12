/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-02
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * F2 Universal Lookup Architecture v2 — Dispatcher, Registry Types, and Screen Protocol
 *
 * ARCHITECTURE RULE:
 *   F2 is a platform protocol, not a screen-specific feature.
 *   There is exactly ONE authoritative F2 keyboard dispatcher in the entire application.
 *   Screens provide configuration (useF2Screen) and result callbacks (FieldAdapter).
 *   They do NOT add window.addEventListener("keydown") for F2.
 *
 * RESOLUTION PRIORITY:
 *   1. Explicit field attribute  data-f2-entity on the focused element
 *   2. Screen field override     registered via useF2Screen({ fieldOverrides })
 *   3. Screen default entity     registered via useF2Screen({ defaultEntity })
 *   4. Safe heuristic inference  from ActiveFieldContext.inferFieldCategory (demoted to tier-4)
 *
 * RULES:
 *   - "general" entity is never inferred; only explicit context produces it.
 *   - Ambiguous inference does NOT guess an entity — falls back to no-op.
 *   - F2 pressed inside the lookup modal is a no-op (re-entry guard).
 *   - Focus is restored to the exact originating field after Escape or selection.
 *   - [F2] badge rendered only on inputs with explicit data-f2-entity attribute.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { inferFieldCategory } from "./ActiveFieldContext.tsx";

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOOKUP DOMAIN TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical lookup entity domain.
 * Supersedes ActiveFieldCategory for the F2 lookup domain.
 * The 22 ActiveFieldCategory values are preserved via the legacy alias map below.
 */
export type LookupEntity =
  | "variant"          // Physical inventory SKU — canonical: /api/v1/variants
  | "item"             // Parent catalog/style — canonical: /api/v1/items
  | "item_barcode"     // Barcode resolution — canonical: /api/v1/item-barcodes
  | "customer"
  | "supplier"
  | "staff"
  | "hsn"
  | "uom"
  | "brand"
  | "color"
  | "size"
  | "article"
  | "department"
  | "section"
  | "fabric"
  | "fit"
  | "category"
  | "season"
  | "scheme"
  | "terms"
  | "store"
  | "classification"
  | "invoice"
  | "general";         // Non-resolvable — never guessed from heuristics

/**
 * Maps legacy ActiveFieldCategory values to the canonical LookupEntity domain.
 * The legacy "product" category maps to "variant" (canonical physical SKU).
 * "general" from heuristics is treated as non-inferable.
 */
export const LEGACY_CATEGORY_TO_ENTITY: Record<string, LookupEntity> = {
  product:        "variant",    // legacy "product" → canonical physical SKU
  article:        "article",
  color:          "color",
  size:           "size",
  brand:          "brand",
  department:     "department",
  section:        "section",
  fabric:         "fabric",
  fit:            "fit",
  category:       "category",
  season:         "season",
  uom:            "uom",
  customer:       "customer",
  supplier:       "supplier",
  store:          "store",
  classification: "classification",
  invoice:        "invoice",
  hsn:            "hsn",
  staff:          "staff",
  scheme:         "scheme",
  terms:          "terms",
  general:        "general",    // non-inferable
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOOKUP RESULT CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versioned typed result returned by UniversalBrowseEngine on selection.
 * contractVersion allows future breaking changes to be controlled.
 *
 * Canonical identity fields (itemId, variantId, barcodeId) are always populated
 * when the entity is variant / item / item_barcode.
 *
 * The caller (FieldAdapter) is responsible for deciding what to do with the result.
 * The dialog NEVER writes directly to form state.
 */
export interface LookupResult {
  /** v2.0.0 — bump when return shape changes */
  contractVersion: "2.0.0";
  entity: LookupEntity;
  /** Primary identity (UUID from Postgres) */
  id: string;
  /** Canonical item identity (populated for variant, item, item_barcode) */
  itemId?: string;
  /** Canonical variant identity (populated for variant, item_barcode) */
  variantId?: string;
  /** Canonical barcode identity (populated for item_barcode) */
  barcodeId?: string;
  /** Value to put into the originating field */
  returnValue: string;
  /** Value for a companion display field (e.g. name alongside a code field) */
  displayValue: string;
  /** Full record for screens that need more than returnValue */
  record: Record<string, unknown>;
}

/**
 * FieldAdapter — the only way results flow back to a screen.
 * Provided by the screen via useF2Screen(). Never imperative DOM mutation.
 */
export type FieldAdapter = (result: LookupResult) => void;

// ─────────────────────────────────────────────────────────────────────────────
// 3. SCREEN CONTEXT REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

export interface F2ScreenContext {
  /** Unique screen identifier */
  screenId: string;
  /** Entity to use when F2 is pressed with no matching explicit attribute or field override */
  defaultEntity: LookupEntity;
  /**
   * Per-field overrides: map input element name/id → entity.
   * Takes priority over defaultEntity; lower priority than explicit data-f2-entity.
   */
  fieldOverrides?: Map<string, LookupEntity>;
  /** Called when the user commits a selection in the lookup dialog */
  adapter: FieldAdapter;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DISPATCHER CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

interface F2DispatcherState {
  /** Whether the UniversalBrowseEngine dialog is currently open */
  isOpen: boolean;
  /** The resolved entity for the current lookup session */
  resolvedEntity: LookupEntity | null;
  /** Pre-populated search text from the originating field's current value */
  initialSearchValue: string;
  /** The adapter to call on selection */
  activeAdapter: FieldAdapter | null;
  /** Register a screen's F2 context */
  registerScreen: (ctx: F2ScreenContext) => void;
  /** Unregister a screen's F2 context */
  unregisterScreen: (screenId: string) => void;
  /** Programmatically open the lookup for a specific entity */
  openLookup: (entity: LookupEntity, adapter: FieldAdapter, initialValue?: string) => void;
  /** Close the lookup and restore focus */
  closeLookup: () => void;
  /** Commit a result — calls the active adapter and closes the dialog */
  commitResult: (result: LookupResult) => void;
  /** The ref to the element that was focused when F2 was pressed */
  originElementRef: React.MutableRefObject<HTMLElement | null>;
}

const F2DispatcherContext = createContext<F2DispatcherState | undefined>(undefined);

export const useF2Dispatcher = (): F2DispatcherState => {
  const ctx = useContext(F2DispatcherContext);
  if (!ctx) throw new Error("useF2Dispatcher must be used within F2DispatcherProvider");
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. useF2Screen HOOK — Screen-Level Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for screens to register their F2 context.
 * Screens call this once; they do NOT add any window.addEventListener for F2.
 *
 * @example
 * useF2Screen({
 *   screenId: "pos_billing",
 *   defaultEntity: "customer",
 *   fieldOverrides: new Map([
 *     ["posItemBarcode", "item_barcode"],
 *     ["posStockNo",     "variant"],
 *   ]),
 *   adapter: (result) => {
 *     if (result.entity === "customer") setCustomer(result.record);
 *     if (result.entity === "variant")  addToCart(result.record);
 *   }
 * });
 */
export function useF2Screen(ctx: F2ScreenContext): void {
  const dispatcher = useF2Dispatcher();

  useEffect(() => {
    dispatcher.registerScreen(ctx);
    return () => {
      dispatcher.unregisterScreen(ctx.screenId);
    };
    // ctx.adapter is a closure that may change on every render; do NOT include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.screenId]);

  // Always keep the latest adapter reference without re-registering
  useEffect(() => {
    dispatcher.registerScreen(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.adapter, ctx.defaultEntity]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. F2DispatcherProvider — The Single Authoritative Listener
// ─────────────────────────────────────────────────────────────────────────────

export const F2DispatcherProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedEntity, setResolvedEntity] = useState<LookupEntity | null>(null);
  const [initialSearchValue, setInitialSearchValue] = useState("");
  const [activeAdapter, setActiveAdapter] = useState<FieldAdapter | null>(null);

  // Registry of all currently mounted screens
  const screenRegistryRef = useRef<Map<string, F2ScreenContext>>(new Map());
  // The most-recently-registered screen (last-write-wins for active screen)
  const activeScreenRef = useRef<F2ScreenContext | null>(null);
  // The element focused when F2 was pressed — for focus restoration
  const originElementRef = useRef<HTMLElement | null>(null);

  const registerScreen = useCallback((ctx: F2ScreenContext) => {
    screenRegistryRef.current.set(ctx.screenId, ctx);
    activeScreenRef.current = ctx;
  }, []);

  const unregisterScreen = useCallback((screenId: string) => {
    screenRegistryRef.current.delete(screenId);
    if (activeScreenRef.current?.screenId === screenId) {
      // Fall back to the most recently registered remaining screen
      const remaining = Array.from(screenRegistryRef.current.values());
      activeScreenRef.current = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }
  }, []);

  const closeLookup = useCallback(() => {
    setIsOpen(false);
    setResolvedEntity(null);
    setInitialSearchValue("");
    setActiveAdapter(null);
    // Restore focus to the originating field
    const el = originElementRef.current;
    if (el) {
      setTimeout(() => {
        try { el.focus(); } catch { /* element may have been removed */ }
      }, 40);
    }
  }, []);

  const openLookup = useCallback(
    (entity: LookupEntity, adapter: FieldAdapter, initialValue = "") => {
      if (entity === "general") {
        // "general" is non-resolvable. Do not open dialog.
        return;
      }
      setResolvedEntity(entity);
      setInitialSearchValue(initialValue);
      setActiveAdapter(() => adapter);
      setIsOpen(true);
    },
    []
  );

  const commitResult = useCallback(
    (result: LookupResult) => {
      if (activeAdapter) {
        try {
          activeAdapter(result);
        } catch (e) {
          console.error("[F2Dispatcher] FieldAdapter threw:", e);
        }
      }
      closeLookup();
    },
    [activeAdapter, closeLookup]
  );

  // ── THE SINGLE F2 KEYBOARD LISTENER ───────────────────────────────────────
  useEffect(() => {
    const handleF2KeyDown = (e: KeyboardEvent) => {
      if (e.key !== "F2") return;

      // Guard 1: Not authenticated → no-op
      const token =
        localStorage.getItem("smriti_jwt_token") ||
        localStorage.getItem("smriti_session_token");
      if (!token) return;

      // Guard 2: Re-entry guard — F2 inside the modal is a no-op
      if (isOpen) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);

      // Record origin for focus restoration
      originElementRef.current = activeEl;

      // ── RESOLUTION PRIORITY ────────────────────────────────────────────
      let resolved: LookupEntity | null = null;
      let initialValue = "";

      // Tier 1: Explicit data-f2-entity attribute on the focused element
      if (isInput && activeEl) {
        const explicit = activeEl.getAttribute("data-f2-entity");
        if (explicit && explicit in LEGACY_CATEGORY_TO_ENTITY) {
          resolved = explicit as LookupEntity;
        } else if (explicit) {
          // Attribute exists but is not a recognised entity — do not guess
          return;
        }
        initialValue = (activeEl as HTMLInputElement).value || "";
      }

      // Tier 2: Screen field override by input name/id
      if (!resolved && isInput && activeEl) {
        const screen = activeScreenRef.current;
        if (screen?.fieldOverrides) {
          const key = (activeEl as HTMLInputElement).name || activeEl.id || "";
          if (key && screen.fieldOverrides.has(key)) {
            resolved = screen.fieldOverrides.get(key)!;
          }
        }
      }

      // Tier 3: Screen default entity
      if (!resolved) {
        const screen = activeScreenRef.current;
        if (screen) {
          resolved = screen.defaultEntity;
        }
      }

      // Tier 4: Safe heuristic inference via inferFieldCategory
      // Only used when no screen is registered; "general" from heuristics is
      // treated as non-inferable and produces a no-op.
      if (!resolved && isInput && activeEl) {
        const { category } = inferFieldCategory(activeEl);
        if (category !== "general") {
          resolved = LEGACY_CATEGORY_TO_ENTITY[category] || null;
        }
      }

      // No entity resolved — do not open dialog; do not guess
      if (!resolved || resolved === "general") return;

      // Resolve adapter: from active screen, or a pass-through no-op
      const screen = activeScreenRef.current;
      const adapter: FieldAdapter = screen?.adapter ?? (() => { /* no-op fallback */ });

      openLookup(resolved, adapter, initialValue);
    };

    window.addEventListener("keydown", handleF2KeyDown);
    return () => window.removeEventListener("keydown", handleF2KeyDown);
  }, [isOpen, openLookup]);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <F2DispatcherContext.Provider
      value={{
        isOpen,
        resolvedEntity,
        initialSearchValue,
        activeAdapter,
        registerScreen,
        unregisterScreen,
        openLookup,
        closeLookup,
        commitResult,
        originElementRef,
      }}
    >
      {children}
    </F2DispatcherContext.Provider>
  );
};
