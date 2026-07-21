/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { TerminalPlugin } from "./TerminalPlugin";
import { PosTerminalTab } from "../PosTerminalTab";
import { PurchaseOrderTerminal } from "./terminals/PurchaseOrderTerminal";
import { GrnTerminal } from "./terminals/GrnTerminal";
import { StockTransferTerminal } from "./terminals/StockTransferTerminal";
import { PhysicalCountTerminal } from "./terminals/PhysicalCountTerminal";

export class TerminalManifest {
  private static registry: Map<string, TerminalPlugin> = new Map();

  public static register(plugin: TerminalPlugin): void {
    this.registry.set(plugin.id.toLowerCase(), plugin);
    this.registry.set(plugin.code.toLowerCase(), plugin);
  }

  public static get(key: string): TerminalPlugin | undefined {
    return this.registry.get(key.toLowerCase());
  }

  public static getAll(): TerminalPlugin[] {
    const unique = new Set<TerminalPlugin>(Array.from(this.registry.values()));
    return Array.from(unique);
  }

  public static getByCategory(category: "sales" | "purchase" | "inventory" | "finance"): TerminalPlugin[] {
    return this.getAll().filter(t => t.category === category);
  }
}

// Initial Core Terminal Manifest Registrations
TerminalManifest.register({
  id: "pos",
  name: "Retail POS Terminal",
  code: "POS01",
  category: "sales",
  capabilities: {
    supportsBarcode: true,
    supportsPrinting: true,
    supportsPayments: true,
    supportsScale: true,
    supportsApproval: true,
    supportsHoldRecall: true,
    supportsLineSalesperson: true,
    supportsInterstateGst: true
  },
  icon: "point_of_sale",
  description: "High speed retail billing terminal",
  component: PosTerminalTab as any
});

TerminalManifest.register({
  id: "po",
  name: "Purchase Order Terminal",
  code: "PO01",
  category: "purchase",
  capabilities: {
    supportsBarcode: true,
    supportsPrinting: true,
    supportsPayments: false,
    supportsScale: false,
    supportsApproval: true,
    supportsHoldRecall: true,
    supportsLineSalesperson: false,
    supportsInterstateGst: true
  },
  icon: "shopping_cart",
  description: "High speed purchase order entry terminal",
  component: PurchaseOrderTerminal
});

TerminalManifest.register({
  id: "grn",
  name: "Goods Receipt Note (GRN) Terminal",
  code: "GRN01",
  category: "purchase",
  capabilities: {
    supportsBarcode: true,
    supportsPrinting: true,
    supportsPayments: false,
    supportsScale: true,
    supportsApproval: true,
    supportsHoldRecall: false,
    supportsLineSalesperson: false,
    supportsInterstateGst: true
  },
  icon: "inventory",
  description: "Goods receipt inward verification terminal",
  component: GrnTerminal
});

TerminalManifest.register({
  id: "transfer",
  name: "Stock Transfer Terminal",
  code: "ST01",
  category: "inventory",
  capabilities: {
    supportsBarcode: true,
    supportsPrinting: true,
    supportsPayments: false,
    supportsScale: false,
    supportsApproval: true,
    supportsHoldRecall: true,
    supportsLineSalesperson: false,
    supportsInterstateGst: false
  },
  icon: "sync_alt",
  description: "Inter-branch stock movement terminal",
  component: StockTransferTerminal
});

TerminalManifest.register({
  id: "count",
  name: "Physical Stock Audit Terminal",
  code: "COUNT01",
  category: "inventory",
  capabilities: {
    supportsBarcode: true,
    supportsPrinting: true,
    supportsPayments: false,
    supportsScale: true,
    supportsApproval: true,
    supportsHoldRecall: true,
    supportsLineSalesperson: false,
    supportsInterstateGst: false
  },
  icon: "fact_check",
  description: "Rapid physical stock counting terminal",
  component: PhysicalCountTerminal
});
