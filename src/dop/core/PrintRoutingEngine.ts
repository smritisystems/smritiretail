/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintRoutingEngine (Multi-Printer Routing Rules Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.1.0
 */

import { DxpDocumentRequest, DxpDocumentType } from "../models/DxpTypes.ts";
import { PrinterProfileRegistry, FleetPrinter } from "./PrinterProfileRegistry.ts";

export interface PrintRoutingRule {
  ruleId: string;
  name: string;
  documentType?: DxpDocumentType;
  department?: string;
  targetPrinterId: string;
  priority: number;
}

class PrintRoutingEngineService {
  private rules: Map<string, PrintRoutingRule> = new Map();

  constructor() {
    this.seedDefaultRules();
  }

  private seedDefaultRules() {
    this.register({
      ruleId: "rule-receipt-pos",
      name: "POS Receipts -> Thermal Printer",
      documentType: "RECEIPT",
      targetPrinterId: "prn-pos-01",
      priority: 10,
    });

    this.register({
      ruleId: "rule-barcode-wh",
      name: "Barcode & Shelf Labels -> Label Printer",
      documentType: "BARCODE_LABEL",
      targetPrinterId: "prn-barcode-01",
      priority: 10,
    });

    this.register({
      ruleId: "rule-invoice-laser",
      name: "Tax Invoices -> Laser Printer",
      documentType: "INVOICE",
      targetPrinterId: "prn-laser-01",
      priority: 5,
    });
  }

  public register(rule: PrintRoutingRule): void {
    this.rules.set(rule.ruleId, rule);
  }

  public listRules(): PrintRoutingRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  public resolvePrinter(req: DxpDocumentRequest): FleetPrinter {
    if (req.options?.printerId) {
      const explicit = PrinterProfileRegistry.get(req.options.printerId);
      if (explicit) return explicit;
    }

    const rules = this.listRules();
    for (const rule of rules) {
      if (rule.documentType && rule.documentType === req.documentType) {
        const printer = PrinterProfileRegistry.get(rule.targetPrinterId);
        if (printer) return printer;
      }
    }

    return PrinterProfileRegistry.getDefault();
  }
}

export const PrintRoutingEngine = new PrintRoutingEngineService();
