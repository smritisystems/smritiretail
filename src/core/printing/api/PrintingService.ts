/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintingService (Public SUPP Facade API — Rule SUPP-013)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintDocument, PrintResult, PrinterCapability } from "../models/PrintDocument.js";
import { PrintOrchestrator, DispatchOptions } from "../orchestrator/PrintOrchestrator.js";
import { PrintDocumentRegistry, BusinessDocumentDefinition } from "../documents/PrintDocumentRegistry.js";
import { PrintTemplateRegistry, PrintTemplateDefinition } from "../templates/PrintTemplateRegistry.js";
import { PrintTemplateValidator, ValidationResult } from "../templates/PrintTemplateValidator.js";
import { PrintVariableResolver } from "../rendering/PrintVariableResolver.js";
import { PrintProviderRegistry } from "../providers/PrintProviderRegistry.js";
import { PrinterDiscoveryService } from "../discovery/PrinterDiscoveryService.js";

export class PrintingService {
  static async discoverPrinters(requestUsb = false): Promise<PrinterCapability[]> {
    return PrinterDiscoveryService.discover(requestUsb);
  }

  /**
   * Main entry point for all business modules to dispatch print documents (Rule SUPP-013 & SUPP-001)
   */
  static async printDocument(document: PrintDocument, options: DispatchOptions): Promise<PrintResult> {
    return PrintOrchestrator.dispatchDocument(document, options);
  }

  /**
   * Generates rendered preview string for template rendering
   */
  static previewDocument(document: PrintDocument, activeItem: any = {}): string {
    return PrintVariableResolver.resolveDocument(document, activeItem);
  }

  /**
   * Validates template syntax, dimensions, and driver tags before publication (Rule SUPP-012)
   */
  static validateTemplate(template: Partial<PrintTemplateDefinition>): ValidationResult {
    return PrintTemplateValidator.validate(template);
  }

  /**
   * Registers a print template in the enterprise TemplateRegistry
   */
  static registerTemplate(template: PrintTemplateDefinition): void {
    const val = this.validateTemplate(template);
    if (!val.valid) {
      throw new Error(`Template validation failed: ${val.issues.map((i) => i.message).join(", ")}`);
    }
    PrintTemplateRegistry.registerTemplate(template);
  }

  /**
   * Registers a business document in the enterprise DocumentRegistry (Rule SUPP-009)
   */
  static registerDocument(def: BusinessDocumentDefinition): void {
    PrintDocumentRegistry.registerDocument(def);
  }

  /**
   * Retrieves audit logs for compliance
   */
  static getAuditLogs(): PrintResult[] {
    return PrintOrchestrator.getAuditLogs();
  }

  /**
   * Checks current hardware provider health status
   */
  static async getPrinterStatus(providerId: string = "qz_tray"): Promise<"READY" | "OFFLINE" | "DEGRADED"> {
    try {
      const provider = PrintProviderRegistry.getProvider(providerId);
      const isConnected = await provider.connect();
      return isConnected ? "READY" : "OFFLINE";
    } catch {
      return "OFFLINE";
    }
  }
}
