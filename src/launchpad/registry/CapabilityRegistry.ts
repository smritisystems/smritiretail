/**
 * Project      : SMRITI Retail OS
 * Module       : Capability Registry (Rule SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { CapabilityDescriptor, CapabilityId } from "../types/capabilityTypes.ts";

class CapabilityRegistryImpl {
  private capabilities: Map<CapabilityId, CapabilityDescriptor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: CapabilityDescriptor[] = [
      {
        id: "ai_advisory",
        name: "AI Advisory Engine",
        category: "Advisory",
        enabled: false,
        status: "Disabled",
        description: "Rule AI-001 optional generative and forecast advisory service."
      },
      {
        id: "barcode_engine",
        name: "Barcode Generator & Thermal Printing",
        category: "Hardware",
        enabled: true,
        status: "Available",
        description: "Direct thermal label printing & EAN/UPC PRN script generation."
      },
      {
        id: "direct_printing",
        name: "Raw Thermal Printer Hub",
        category: "Hardware",
        enabled: true,
        status: "Available",
        description: "ESC/POS direct printer hub connectivity."
      },
      {
        id: "tally_connector",
        name: "Tally ERP Connector",
        category: "Integration",
        enabled: true,
        status: "Available",
        description: "XML double-entry sync with Tally ERP 9 / Prime."
      },
      {
        id: "excel_studio",
        name: "SMRITI Spreadsheet Platform",
        category: "Data",
        enabled: true,
        status: "Available",
        description: "Live Excel grid formulas, clipboard paste & valuation engine."
      }
    ];

    defaults.forEach((cap) => this.capabilities.set(cap.id, cap));
  }

  public register(cap: CapabilityDescriptor): void {
    this.capabilities.set(cap.id, cap);
  }

  public get(id: CapabilityId): CapabilityDescriptor | undefined {
    return this.capabilities.get(id);
  }

  public isEnabled(id: CapabilityId): boolean {
    const cap = this.capabilities.get(id);
    return Boolean(cap && cap.enabled);
  }

  public setEnabled(id: CapabilityId, enabled: boolean): void {
    const cap = this.capabilities.get(id);
    if (cap) {
      cap.enabled = enabled;
      cap.status = enabled ? "Available" : "Disabled";
    }
  }

  public getAll(): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }
}

export const CapabilityRegistry = new CapabilityRegistryImpl();
