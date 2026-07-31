/**
 * Project      : SMRITI Retail OS
 * Module       : Quick Action Registry (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { LaunchpadQuickAction } from "../types/launchpadTypes.ts";

class QuickActionRegistryImpl {
  private actions: Map<string, LaunchpadQuickAction> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: LaunchpadQuickAction[] = [
      { id: "qa-new-sale", label: "New Sale", iconName: "ShoppingCart", targetTab: "pos", category: "Sales" },
      { id: "qa-new-po", label: "New Purchase", iconName: "Briefcase", targetTab: "purchase", category: "Procurement" },
      { id: "qa-new-customer", label: "New Customer", iconName: "Users", targetTab: "customers", category: "CRM" },
      { id: "qa-new-supplier", label: "New Supplier", iconName: "Building", targetTab: "supplier-mgmt", category: "Procurement" },
      { id: "qa-new-item", label: "New Item", iconName: "Package", targetTab: "item-master", category: "Inventory" },
      { id: "qa-stock-transfer", label: "Stock Transfer", iconName: "Truck", targetTab: "stock-ledger", category: "Inventory" },
      { id: "qa-ledger-entry", label: "Payment / Receipt", iconName: "DollarSign", targetTab: "ledger", category: "Finance" },
      { id: "qa-print-labels", label: "Print Barcodes", iconName: "Printer", targetTab: "print-studio", category: "Masters" },
      { id: "qa-print-labels-universal", label: "Universal Label Printer", iconName: "Printer", targetTab: "universal-label-printer", category: "Masters" },
      { id: "qa-barcode-demo", label: "Barcode Demo", iconName: "Printer", targetTab: "barcode", category: "Inventory" },
      { id: "qa-data-backup", label: "Backup & Sync", iconName: "FileCode", targetTab: "data-exchange", category: "Platform" }
    ];

    defaults.forEach((action) => this.actions.set(action.id, action));
  }

  public register(action: LaunchpadQuickAction): void {
    this.actions.set(action.id, action);
  }

  public getAll(): LaunchpadQuickAction[] {
    return Array.from(this.actions.values());
  }

  public get(id: string): LaunchpadQuickAction | undefined {
    return this.actions.get(id);
  }
}

export const QuickActionRegistry = new QuickActionRegistryImpl();
