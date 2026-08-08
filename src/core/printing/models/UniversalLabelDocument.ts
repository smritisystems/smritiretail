/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-001 (Universal Label Document Model v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type LabelElementType =
  | "TEXT"
  | "BARCODE"
  | "QR"
  | "DATAMATRIX"
  | "IMAGE"
  | "LOGO"
  | "LINE"
  | "BOX"
  | "RECTANGLE"
  | "CIRCLE"
  | "TABLE"
  | "PRICE"
  | "DATE"
  | "TIME"
  | "COUNTER"
  | "SYMBOL"
  | "RAW_COMMAND";

export type RotationDegree = 0 | 90 | 180 | 270;

export interface ElementStyle {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  strokeWidthMm?: number;
  fillColor?: string;
  borderColor?: string;
  color?: string;
}

export interface ElementBinding {
  expression: string; // e.g. "{{product.brand}}" or "{{product.mrp | currency}}"
  fallback?: string;
  formatter?: string;
}

export interface LabelElement {
  id: string;
  type: LabelElementType;
  x: number; // mm from top-left
  y: number; // mm from top-left
  width: number; // mm
  height: number; // mm
  rotation: RotationDegree;
  visible: boolean;
  zIndex: number;
  style?: ElementStyle;
  binding?: ElementBinding;
  staticText?: string;
  symbology?: string; // e.g. "EAN13", "CODE128", "QR", "DATAMATRIX"
  rawCommand?: string; // Preserved raw PRN script for RAW_COMMAND elements
  formatting?: Record<string, any>;
}

export interface DocumentDimensions {
  widthMm: number;
  heightMm: number;
  dpi: number;
  columns: number;
  gapMm: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
}

export interface MediaSettings {
  type: "ROLL" | "FANFOLD" | "DIE_CUT" | "CONTINUOUS";
  sensor: "GAP" | "BLACK_MARK" | "NONE";
}

export interface DocumentCapabilitiesRequirement {
  supportsBarcode?: boolean;
  supportsQRCode?: boolean;
  supportsDataMatrix?: boolean;
  supportsImages?: boolean;
  supportsRotation?: boolean;
  requiredDpi?: number;
  requiredLanguage?: string;
}

export interface UniversalLabelDocumentJSON {
  metadata: {
    id: string;
    name: string;
    version: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
  };
  dimensions: DocumentDimensions;
  media: MediaSettings;
  elements: LabelElement[];
  bindings: Record<string, string>;
  capabilities: DocumentCapabilitiesRequirement;
}

export class UniversalLabelDocument {
  public metadata: {
    id: string;
    name: string;
    version: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  public dimensions: DocumentDimensions;
  public media: MediaSettings;
  public elements: LabelElement[];
  public bindings: Map<string, string>;
  public capabilities: DocumentCapabilitiesRequirement;

  constructor(init?: Partial<UniversalLabelDocumentJSON>) {
    this.metadata = {
      id: init?.metadata?.id || `doc-${Date.now()}`,
      name: init?.metadata?.name || "Untitled Label Layout",
      version: init?.metadata?.version || "1.0.0",
      author: init?.metadata?.author || "SMRITI Enterprise System",
      createdAt: init?.metadata?.createdAt || new Date().toISOString(),
      updatedAt: init?.metadata?.updatedAt || new Date().toISOString(),
    };

    this.dimensions = {
      widthMm: init?.dimensions?.widthMm ?? 50.0,
      heightMm: init?.dimensions?.heightMm ?? 25.0,
      dpi: init?.dimensions?.dpi ?? 203,
      columns: init?.dimensions?.columns ?? 1,
      gapMm: init?.dimensions?.gapMm ?? 3.0,
      orientation: init?.dimensions?.orientation || "PORTRAIT",
    };

    this.media = {
      type: init?.media?.type || "DIE_CUT",
      sensor: init?.media?.sensor || "GAP",
    };

    this.elements = init?.elements ? [...init.elements] : [];

    this.bindings = new Map();
    if (init?.bindings) {
      Object.entries(init.bindings).forEach(([k, v]) => this.bindings.set(k, v));
    }

    this.capabilities = {
      supportsBarcode: init?.capabilities?.supportsBarcode ?? false,
      supportsQRCode: init?.capabilities?.supportsQRCode ?? false,
      supportsDataMatrix: init?.capabilities?.supportsDataMatrix ?? false,
      supportsImages: init?.capabilities?.supportsImages ?? false,
      supportsRotation: init?.capabilities?.supportsRotation ?? true,
      requiredDpi: init?.capabilities?.requiredDpi ?? 203,
      requiredLanguage: init?.capabilities?.requiredLanguage,
    };

    this.updateCapabilitiesRequirement();
  }

  public addElement(element: LabelElement): void {
    if (!element.id) {
      element.id = `el-${this.elements.length + 1}-${Date.now()}`;
    }
    this.elements.push(element);
    this.updateCapabilitiesRequirement();
  }

  public removeElement(id: string): boolean {
    const idx = this.elements.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.elements.splice(idx, 1);
      this.updateCapabilitiesRequirement();
      return true;
    }
    return false;
  }

  public updateCapabilitiesRequirement(): void {
    let barcodeFound = false;
    let qrFound = false;
    let dataMatrixFound = false;
    let imageFound = false;

    for (const el of this.elements) {
      if (el.type === "BARCODE") barcodeFound = true;
      if (el.type === "QR") qrFound = true;
      if (el.type === "DATAMATRIX") dataMatrixFound = true;
      if (el.type === "IMAGE" || el.type === "LOGO") imageFound = true;
    }

    this.capabilities.supportsBarcode = barcodeFound;
    this.capabilities.supportsQRCode = qrFound;
    this.capabilities.supportsDataMatrix = dataMatrixFound;
    this.capabilities.supportsImages = imageFound;
  }

  public toJSON(): UniversalLabelDocumentJSON {
    const bindingsObj: Record<string, string> = {};
    this.bindings.forEach((val, key) => {
      bindingsObj[key] = val;
    });

    return {
      metadata: { ...this.metadata },
      dimensions: { ...this.dimensions },
      media: { ...this.media },
      elements: this.elements.map((el) => ({ ...el })),
      bindings: bindingsObj,
      capabilities: { ...this.capabilities },
    };
  }

  public static fromJSON(json: Partial<UniversalLabelDocumentJSON>): UniversalLabelDocument {
    return new UniversalLabelDocument(json);
  }
}
