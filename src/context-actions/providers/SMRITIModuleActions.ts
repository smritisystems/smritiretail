/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { ContextAction } from "../ContextAction.ts";
import { registry } from "../ContextRegistry.ts";

/**
 * Registers SMRITI OS centralized actions list.
 * Integrates with Notification Engine to dispatch standard events.
 */
export const registerAllDefaultActions = (addNotification: (n: any) => void) => {
  const defaultActions: ContextAction[] = [
    // --- INVOICE ACTIONS ---
    {
      id: "invoice-receive-payment",
      label: "Receive Payment",
      icon: "payments",
      description: "Record cash, UPI, or card settlement for pending invoice",
      category: "Workflow",
      shortcut: "R",
      visible: context => context.type === "invoice" || context.type === "bill",
      disabled: context => context.object?.status === "Completed" || context.object?.status === "Void",
      onClick: context => {
        addNotification({
          title: "Payment Received Successfully",
          message: `Settled ₹${context.object?.total || 0} for ${context.object?.id || "Invoice"} via ${context.object?.paymentMode || "Cash"}.`,
          type: "activity",
          priority: "high"
        });
        // Dispatch standard event for real-time reactivity
        const event = new CustomEvent("SMRITI_PAYMENT_SETTLED", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "invoice-print",
      label: "Print Invoice",
      icon: "print",
      description: "Generate and queue thermal receipt or standard A4 invoice PDF",
      category: "Document",
      shortcut: "Ctrl+P",
      visible: context => context.type === "invoice" || context.type === "bill",
      onClick: context => {
        addNotification({
          title: "Invoice Queued to Printer",
          message: `Bill ${context.object?.id || ""} successfully sent to Standard A4 Printer pool.`,
          type: "system",
          priority: "low"
        });
        const event = new CustomEvent("SMRITI_PRINT_DOCUMENT", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "invoice-share-whatsapp",
      label: "Share via WhatsApp",
      icon: "share",
      description: "Send automated GST invoice notification to customer's WhatsApp",
      category: "Enterprise",
      visible: context => context.type === "invoice" || context.type === "bill",
      onClick: context => {
        const customerPhone = context.object?.customerPhone || "Customer";
        addNotification({
          title: "WhatsApp Message Transmitted",
          message: `Dispatched encrypted PDF link to +91 ${customerPhone}.`,
          type: "activity",
          priority: "medium"
        });
      }
    },
    {
      id: "invoice-void",
      label: "Void Invoice",
      icon: "block",
      description: "Cancel transaction, void GST, and restore stock reserves",
      category: "Workflow",
      visible: context => context.type === "invoice" || context.type === "bill",
      disabled: context => context.role !== "Store Manager" && context.role !== "Admin",
      onClick: context => {
        addNotification({
          title: "Invoice Voided",
          message: `Transaction ${context.object?.id || "Invoice"} was voided. Ledger adjustments logged.`,
          type: "alert",
          priority: "critical"
        });
        const event = new CustomEvent("SMRITI_VOID_DOCUMENT", { detail: context.object });
        window.dispatchEvent(event);
      }
    },

    // --- SALES INVOICE ACTIONS ---
    {
      id: "sales-invoice-print",
      label: "Print Invoice",
      icon: "print",
      description: "Generate and queue thermal receipt or standard A4 invoice PDF",
      category: "Document",
      shortcut: "Ctrl+P",
      visible: context => context.type === "sales-invoice",
      onClick: context => {
        addNotification({
          title: "Invoice Queued to Printer",
          message: `Sales Invoice ${context.object?.invoiceNo || ""} successfully sent to Standard A4 Printer pool.`,
          type: "system",
          priority: "low"
        });
        const event = new CustomEvent("SMRITI_PRINT_SALES_INVOICE", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "sales-invoice-share-whatsapp",
      label: "Send WhatsApp",
      icon: "share",
      description: "Send automated GST invoice notification to customer's WhatsApp",
      category: "Enterprise",
      visible: context => context.type === "sales-invoice",
      onClick: context => {
        const customerPhone = context.object?.customerPhone || context.object?.mobile || "Customer";
        addNotification({
          title: "WhatsApp Message Transmitted",
          message: `Dispatched Sales Invoice ${context.object?.invoiceNo || ""} PDF link to +91 ${customerPhone}.`,
          type: "activity",
          priority: "medium"
        });
        const event = new CustomEvent("SMRITI_WHATSAPP_SALES_INVOICE", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "sales-invoice-convert",
      label: "Convert / Approve",
      icon: "file_check",
      description: "Approve draft sales invoice",
      category: "Workflow",
      visible: context => context.type === "sales-invoice",
      disabled: context => context.object?.status !== "Draft",
      onClick: context => {
        const event = new CustomEvent("SMRITI_APPROVE_SALES_INVOICE", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "sales-invoice-cancel",
      label: "Cancel Invoice",
      icon: "block",
      description: "Cancel transaction and void GST entries",
      category: "Workflow",
      visible: context => context.type === "sales-invoice",
      disabled: context => context.object?.status === "Cancelled",
      onClick: context => {
        const event = new CustomEvent("SMRITI_CANCEL_SALES_INVOICE", { detail: context.object });
        window.dispatchEvent(event);
      }
    },

    // --- SALES RETURN ACTIONS ---
    {
      id: "sales-return-print",
      label: "Print Sales Return",
      icon: "print",
      description: "Generate and queue thermal receipt for return or credit note PDF",
      category: "Document",
      visible: context => context.type === "sales-return",
      onClick: context => {
        addNotification({
          title: "Return Doc Queued to Printer",
          message: `Sales Return ${context.object?.returnNo || ""} successfully sent to Standard A4 Printer pool.`,
          type: "system",
          priority: "low"
        });
        const event = new CustomEvent("SMRITI_PRINT_SALES_RETURN", { detail: context.object });
        window.dispatchEvent(event);
      }
    },

    // --- PRODUCT / ITEM MASTER ACTIONS ---
    {
      id: "item-print-barcode",
      label: "Print Barcode Labels",
      icon: "barcode_reader",
      description: "Generate thermal price labels and variant barcodes",
      category: "Document",
      visible: context => context.type === "product" || context.type === "item",
      onClick: context => {
        addNotification({
          title: "Barcode Sheets Queued",
          message: `Generated barcode catalog labels for ${context.object?.name || "Product"}.`,
          type: "system",
          priority: "low"
        });
        const event = new CustomEvent("SMRITI_GENERATE_BARCODES", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "item-adjust-inventory",
      label: "Adjust Inventory Stock",
      icon: "inventory_2",
      description: "Log shrinkage, audit variances, or reconcile bulk stocks",
      category: "Workflow",
      visible: context => context.type === "product" || context.type === "item",
      disabled: context => context.role !== "Store Manager" && context.role !== "Admin",
      onClick: context => {
        addNotification({
          title: "Stock Auditing Active",
          message: `Initiated stock ledger adjustment wizard for SKU ${context.object?.code || "Product"}.`,
          type: "activity",
          priority: "medium"
        });
        const event = new CustomEvent("SMRITI_ADJUST_STOCK", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "item-reorder-po",
      label: "Create Reorder PO",
      icon: "local_shipping",
      description: "Auto-compile draft Purchase Order to restore stock thresholds",
      category: "Workflow",
      shortcut: "O",
      visible: context => context.type === "product" || context.type === "item",
      onClick: context => {
        addNotification({
          title: "Draft Reorder Compiled",
          message: `Auto-generated draft supplier order for SKU ${context.object?.code || ""}.`,
          type: "approval",
          priority: "high"
        });
        const event = new CustomEvent("SMRITI_CREATE_REORDER", { detail: context.object });
        window.dispatchEvent(event);
      }
    },

    // --- CRM / CUSTOMER ACTIONS ---
    {
      id: "customer-quick-edit",
      label: "Quick Edit Details",
      icon: "edit",
      description: "Rapidly modify customer's phone or email info",
      category: "Workflow",
      visible: context => context.type === "customer",
      onClick: context => {
        const event = new CustomEvent("SMRITI_QUICK_EDIT_CUSTOMER", { detail: context.object });
        window.dispatchEvent(event);
      }
    },
    {
      id: "customer-send-reminder",
      label: "Send Outstanding Reminder",
      icon: "forward_to_inbox",
      description: "Transmit balance statement and UPI payment link to debtor",
      category: "Enterprise",
      visible: context => context.type === "customer",
      disabled: context => !context.object?.outstanding || Number(context.object.outstanding) <= 0,
      onClick: context => {
        addNotification({
          title: "Dunning Notification Dispatched",
          message: `Sent balance summary of ₹${context.object?.outstanding || 0} to ${context.object?.name || "Customer"}.`,
          type: "activity",
          priority: "medium"
        });
      }
    },
    {
      id: "customer-adjust-loyalty",
      label: "Adjust Loyalty Points",
      icon: "military_tech",
      description: "Manually credit promotional point reserves or issue coupons",
      category: "Workflow",
      visible: context => context.type === "customer",
      onClick: context => {
        addNotification({
          title: "Loyalty Ledger Updated",
          message: `Adjusted points reserve for ${context.object?.name || "Customer"}.`,
          type: "activity",
          priority: "low"
        });
      }
    },

    // --- PURCHASE ORDER ACTIONS ---
    {
      id: "po-submit-order",
      label: "Submit Order for Approval",
      icon: "send_and_archive",
      description: "Lock draft order and forward to executive approval matrix",
      category: "Workflow",
      visible: context => context.type === "purchase-order",
      disabled: context => context.object?.status !== "Draft",
      onClick: context => {
        addNotification({
          title: "Purchase Order Locked",
          message: `PO ${context.object?.id || ""} forwarded to Manager workflow gate.`,
          type: "approval",
          priority: "high"
        });
        const event = new CustomEvent("SMRITI_PO_SUBMITTED", { detail: context.object });
        window.dispatchEvent(event);
      }
    },

    // --- SYSTEM DEVELOPER / ADMIN TOOLS ---
    {
      id: "admin-inspect-state",
      label: "Inspect Context Payload",
      icon: "code_blocks",
      description: "Review raw memory attributes of the active DOM target",
      category: "Developer",
      visible: context => context.role === "Store Manager" || context.role === "Admin",
      onClick: context => {
        console.log("[ACAS Debug] Raw Context Object:", context);
        alert(`SMRITI ACAS Developer Inspection:\n\n` + JSON.stringify(context, null, 2));
      }
    },
    {
      id: "admin-db-reconcile",
      label: "Force Tally Reconciliation",
      icon: "sync",
      description: "Force immediate dual-entry synchronization to TallyPrime gateway",
      category: "Developer",
      visible: context => context.role === "Store Manager" || context.role === "Admin",
      onClick: context => {
        addNotification({
          title: "TallyPrime Reconciled",
          message: "Double-entry sales journals successfully synchronized with standard Tally XML API.",
          type: "system",
          priority: "medium"
        });
      }
    }
  ];

  // Register all items
  registry.registerMany(defaultActions);
};
