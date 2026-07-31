/**
 * Project      : SMRITI Business OS
 * Component    : WindowManager (SMRITI Window Management Framework - SWMF v1.0)
 * Standard     : STWS-001 (SMRITI Transaction Workspace Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Core Service
 */

export type TransactionType =
  | "SalesQuotation"
  | "SalesOrder"
  | "SalesInvoice"
  | "SalesReturn"
  | "PurchaseEnquiry"
  | "PurchaseOrder"
  | "PurchaseInvoice"
  | "PurchaseReturn"
  | "StockTransfer"
  | "StockAdjustment"
  | "GoodsReceipt"
  | "GoodsIssue"
  | "ProductionOrder"
  | "MaterialIssue"
  | "MaterialReceipt"
  | "JournalVoucher"
  | "PaymentReceipt"
  | "CreditNote"
  | "DebitNote"
  | "POSBilling"
  | "PhysicalStock"
  | "DeliveryChallan"
  | "BankReconciliation";

export type WindowMode = "embedded" | "standalone" | "fullscreen" | "presentation" | "kiosk";

export interface OpenTransactionOptions {
  transactionType: TransactionType;
  documentId?: string;
  mode?: WindowMode;
  subView?: string;
  action?: string;
  width?: number;
  height?: number;
}

export interface WindowGeometry {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

export interface BroadcastMessage<T = unknown> {
  type: string;
  sourceTabId: string;
  payload: T;
  timestamp: number;
}

/**
 * SAWF v1.0 (SMRITI Advanced Window Framework)
 * Features:
 * 1. Window Registry & Duplicate Prevention (Focus existing window)
 * 2. Closed Window Auto-Pruning (win.closed tracking)
 * 3. Geometry Persistence (localStorage saved dimensions & monitor placement)
 * 4. BroadcastChannel Cross-Window Data Synchronization
 * 5. Unsaved Changes Guard Protection (beforeunload interceptor)
 */
export class WindowManager {
  private static activePopoutsMap = new Map<string, Window>();
  private static broadcastChannel: BroadcastChannel | null = null;
  private static unsavedGuardActive = false;

  /**
   * Initializes or gets the shared BroadcastChannel for cross-window messaging
   */
  private static getChannel(): BroadcastChannel | null {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return null;
    }
    if (!WindowManager.broadcastChannel) {
      WindowManager.broadcastChannel = new BroadcastChannel("smriti_sawf_window_channel");
    }
    return WindowManager.broadcastChannel;
  }

  /**
   * Broadcasts a real-time event to all open browser windows and main workspace
   */
  static broadcast<T = unknown>(type: string, sourceTabId: string, payload: T): void {
    const channel = WindowManager.getChannel();
    if (!channel) return;

    const message: BroadcastMessage<T> = {
      type,
      sourceTabId,
      payload,
      timestamp: Date.now(),
    };

    try {
      channel.postMessage(message);
    } catch (err) {
      console.error("[SAWF Broadcast Error]:", err);
    }
  }

  /**
   * Subscribes to SAWF BroadcastChannel events across browser windows
   */
  static subscribeBroadcast<T = unknown>(
    callback: (message: BroadcastMessage<T>) => void
  ): () => void {
    const channel = WindowManager.getChannel();
    if (!channel) return () => {};

    const handler = (event: MessageEvent<BroadcastMessage<T>>) => {
      if (event.data && event.data.type) {
        callback(event.data);
      }
    };

    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
    };
  }

  /**
   * Saves window geometry (width, height, left, top) for a specific tab into localStorage
   */
  static saveGeometry(tabId: string, geometry: Partial<WindowGeometry>): void {
    if (typeof localStorage === "undefined") return;
    try {
      const key = `smriti_sawf_geom_${tabId}`;
      const existing = WindowManager.getStoredGeometry(tabId) || { width: 1440, height: 900 };
      const updated = { ...existing, ...geometry };
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Retrieves stored window geometry from localStorage
   */
  static getStoredGeometry(tabId: string): WindowGeometry | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const key = `smriti_sawf_geom_${tabId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Opens any workspace tab in a dedicated standalone popout window (new browser window/tab)
   * Prevents duplicate windows by bringing existing active window to focus.
   */
  static openTabStandalone(tabId: string, title?: string, width = 1440, height = 900): Window | null {
    if (typeof window === "undefined") return null;

    // 1. Check Window Registry for existing active window
    const existingWin = WindowManager.activePopoutsMap.get(tabId);
    if (existingWin && !existingWin.closed) {
      try {
        existingWin.focus();
        return existingWin;
      } catch {
        // Window might have been closed or detached cross-origin
        WindowManager.activePopoutsMap.delete(tabId);
      }
    }

    // 2. Retrieve Stored Geometry or use defaults
    const storedGeom = WindowManager.getStoredGeometry(tabId);
    const winWidth = storedGeom?.width || width;
    const winHeight = storedGeom?.height || height;
    const winLeft = storedGeom?.left !== undefined ? `,left=${storedGeom.left}` : "";
    const winTop = storedGeom?.top !== undefined ? `,top=${storedGeom.top}` : "";

    const origin = window.location.origin;
    const pathname = window.location.pathname;

    const queryParams = new URLSearchParams({
      popout: "true",
      tab: tabId,
      mode: "standalone",
      title: title || tabId,
    });

    const popoutUrl = `${origin}${pathname}?${queryParams.toString()}`;
    const windowFeatures = `popup=yes,width=${winWidth},height=${winHeight}${winLeft}${winTop},menubar=no,toolbar=no,location=no,status=no,directories=no,titlebar=no,resizable=yes,scrollbars=yes`;
    const windowName = `SMRITI_TAB_${tabId.toUpperCase()}`;

    const newWin = window.open(popoutUrl, windowName, windowFeatures);

    if (newWin) {
      WindowManager.activePopoutsMap.set(tabId, newWin);
      WindowManager.recordSessionWindow(tabId, title || tabId);

      // Track window close event to clean registry and session
      const checkClosedTimer = setInterval(() => {
        if (newWin.closed) {
          clearInterval(checkClosedTimer);
          WindowManager.activePopoutsMap.delete(tabId);
          WindowManager.removeSessionWindow(tabId);
        }
      }, 1000);
    }

    return newWin;
  }

  /**
   * SAWF v2.0 Session Persistence: Records an active standalone workspace window
   */
  static recordSessionWindow(tabId: string, title: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      const active = WindowManager.getActiveSessionWindows();
      const filtered = active.filter((w) => w.tabId !== tabId);
      filtered.push({ tabId, title, openedAt: Date.now() });
      localStorage.setItem("smriti_sawf_active_session", JSON.stringify(filtered));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * SAWF v2.0 Session Persistence: Removes a closed standalone workspace window from session
   */
  static removeSessionWindow(tabId: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      const active = WindowManager.getActiveSessionWindows();
      const filtered = active.filter((w) => w.tabId !== tabId);
      localStorage.setItem("smriti_sawf_active_session", JSON.stringify(filtered));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * SAWF v2.0 Session Persistence: Retrieves all active session windows for session restore
   */
  static getActiveSessionWindows(): Array<{ tabId: string; title: string; openedAt: number }> {
    if (typeof localStorage === "undefined") return [];
    try {
      const saved = localStorage.getItem("smriti_sawf_active_session");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * SAWF v2.0 Session Restore: Restores all previously active standalone workspace windows
   */
  static restoreSession(): void {
    const session = WindowManager.getActiveSessionWindows();
    if (session.length === 0) return;
    session.forEach((s) => {
      WindowManager.openTabStandalone(s.tabId, s.title);
    });
  }

  /**
   * Opens a transactional document in a dedicated standalone popout window or updates URL mode
   */
  static openTransaction(options: OpenTransactionOptions): Window | null {
    const {
      transactionType,
      documentId = "",
      mode = "standalone",
      subView = "",
      action = "create",
      width = 1440,
      height = 900,
    } = options;

    const tabMapping: Record<TransactionType, string> = {
      SalesQuotation: "sales",
      SalesOrder: "sales",
      SalesInvoice: "sales",
      SalesReturn: "sales",
      PurchaseEnquiry: "purchase",
      PurchaseOrder: "purchase",
      PurchaseInvoice: "purchase",
      PurchaseReturn: "purchase",
      StockTransfer: "inventory",
      StockAdjustment: "inventory",
      GoodsReceipt: "purchase",
      GoodsIssue: "inventory",
      ProductionOrder: "inventory",
      MaterialIssue: "inventory",
      MaterialReceipt: "inventory",
      JournalVoucher: "accounting",
      PaymentReceipt: "accounting",
      CreditNote: "sales",
      DebitNote: "purchase",
      POSBilling: "pos",
      PhysicalStock: "inventory",
      DeliveryChallan: "sales",
      BankReconciliation: "accounting",
    };

    const targetTab = tabMapping[transactionType] || "sales";

    if (mode === "standalone") {
      return WindowManager.openTabStandalone(targetTab, `${transactionType} ${documentId}`, width, height);
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    const queryParams = new URLSearchParams({
      popout: "false",
      transactionType,
      documentId,
      mode,
      tab: targetTab,
      subView: subView || transactionType.toLowerCase(),
      action,
    });

    const popoutUrl = `${origin}${pathname}?${queryParams.toString()}`;
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", popoutUrl);
    }

    return null;
  }

  /**
   * Enables Unsaved Changes Guard for the current window (`beforeunload`)
   */
  static enableUnsavedChangesGuard(message = "You have unsaved changes. Are you sure you want to leave?"): void {
    if (typeof window === "undefined" || WindowManager.unsavedGuardActive) return;

    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    WindowManager.unsavedGuardActive = true;
  }

  /**
   * Helper to check if current window is operating in standalone popout mode
   */
  static isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("popout") === "true";
    } catch {
      return false;
    }
  }

  /**
   * Retrieves active window mode ('embedded', 'standalone', 'fullscreen', 'presentation', 'kiosk')
   */
  static getWindowMode(): WindowMode {
    if (typeof window === "undefined") return "embedded";
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get("mode") as WindowMode;
      if (modeParam) return modeParam;
      return params.get("popout") === "true" ? "standalone" : "embedded";
    } catch {
      return "embedded";
    }
  }
}
