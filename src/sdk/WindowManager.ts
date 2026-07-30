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

/**
 * SMRITI Window Management Framework (SWMF v1.0) Singleton Service
 * Enforces STWS-001: Platform-wide standalone transaction windowing standard
 */
export class WindowManager {
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

    // Map transaction type to workspace tab ID
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

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";

    const queryParams = new URLSearchParams({
      popout: mode === "embedded" ? "false" : "true",
      transactionType,
      documentId,
      mode,
      tab: targetTab,
      subView: subView || transactionType.toLowerCase(),
      action,
    });

    const popoutUrl = `${origin}${pathname}?${queryParams.toString()}`;

    if (mode === "embedded") {
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", popoutUrl);
      }
      return null;
    }

    const windowFeatures = `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
    const windowName = `SMRITI_${transactionType}_${documentId || "New"}`;

    return typeof window !== "undefined" ? window.open(popoutUrl, windowName, windowFeatures) : null;
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
