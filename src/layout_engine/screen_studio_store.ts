/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.2.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";
import { IndustryPackType } from "./saef_experience_store.ts";

export interface FieldLayoutConfig {
  id: string;
  label: string;
  visible: boolean;
  required: boolean;
  order: number;
}

export interface ButtonLayoutConfig {
  id: string;
  label: string;
  icon: string;
  isPrimary: boolean;
  order: number;
}

export interface ScreenLayoutMetadata {
  screenId: string;
  templateName: string;
  industryPack: IndustryPackType;
  maxPrimaryButtons: number;
  fields: FieldLayoutConfig[];
  buttons: ButtonLayoutConfig[];
}

const DEFAULT_POS_FIELDS: FieldLayoutConfig[] = [
  { id: "barcode", label: "Barcode / Item Code", visible: true, required: true, order: 1 },
  { id: "quantity", label: "Quantity", visible: true, required: true, order: 2 },
  { id: "unit_price", label: "Unit Price", visible: true, required: true, order: 3 },
  { id: "discount", label: "Discount %", visible: true, required: false, order: 4 },
  { id: "batch_no", label: "Batch No.", visible: true, required: false, order: 5 },
  { id: "expiry_date", label: "Expiry Date", visible: false, required: false, order: 6 },
  { id: "size", label: "Footwear Size", visible: false, required: false, order: 7 },
  { id: "color", label: "Color / Variant", visible: false, required: false, order: 8 },
];

const DEFAULT_POS_BUTTONS: ButtonLayoutConfig[] = [
  { id: "new_sale", label: "F2: New Sale", icon: "add", isPrimary: true, order: 1 },
  { id: "scan", label: "F4: Scan Item", icon: "qr_code_scanner", isPrimary: true, order: 2 },
  { id: "hold", label: "F6: Hold Bill", icon: "pause", isPrimary: true, order: 3 },
  { id: "discount", label: "F8: Discount", icon: "percent", isPrimary: true, order: 4 },
  { id: "print", label: "F10: Print Bill", icon: "print", isPrimary: true, order: 5 },
  { id: "pay", label: "F12: Pay Cash/Card", icon: "payments", isPrimary: true, order: 6 },
  { id: "upi", label: "F9: UPI QR Pay", icon: "qr_code_2", isPrimary: true, order: 7 },
  { id: "rebalance", label: "Stock Rebalance", icon: "move_up", isPrimary: false, order: 8 },
  { id: "gst_reconcile", label: "GSTR Reconcile", icon: "fact_check", isPrimary: false, order: 9 },
];

class ScreenStudioStore {
  private metadata: ScreenLayoutMetadata = {
    screenId: "pos",
    templateName: "Standard POS Checkout",
    industryPack: "GENERAL_RETAIL",
    maxPrimaryButtons: 7,
    fields: DEFAULT_POS_FIELDS,
    buttons: DEFAULT_POS_BUTTONS,
  };
  private listeners: Set<() => void> = new Set();

  public getMetadata(): ScreenLayoutMetadata {
    return this.metadata;
  }

  public updateFieldVisibility(fieldId: string, visible: boolean) {
    this.metadata.fields = this.metadata.fields.map((f) =>
      f.id === fieldId ? { ...f, visible } : f
    );
    this.notify();
  }

  public setMaxPrimaryButtons(count: number) {
    this.metadata.maxPrimaryButtons = count;
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const screenStudioStore = new ScreenStudioStore();

export function useScreenStudio() {
  const [metadata, setMeta] = useState<ScreenLayoutMetadata>(screenStudioStore.getMetadata());

  useEffect(() => {
    return screenStudioStore.subscribe(() => {
      setMeta({ ...screenStudioStore.getMetadata() });
    });
  }, []);

  return {
    metadata,
    updateFieldVisibility: (fieldId: string, visible: boolean) =>
      screenStudioStore.updateFieldVisibility(fieldId, visible),
    setMaxPrimaryButtons: (count: number) => screenStudioStore.setMaxPrimaryButtons(count),
  };
}
