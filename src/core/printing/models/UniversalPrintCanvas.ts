/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Multi-Region / Multi-Up Print Canvas
 * Standard     : SCS-PRINT-CANVAS-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { LabelElement } from "./UniversalLabelDocument.ts";

export type CanvasLayoutType = "GRID" | "FREEFORM";
export type CanvasMediaType = "ROLL" | "FANFOLD" | "DIE_CUT" | "CONTINUOUS";
export type CanvasSensorType = "GAP" | "BLACK_MARK" | "NONE";
export type OverlapPolicy = "ALLOW_OVERLAP" | "WARN_OVERLAP" | "REJECT_OVERLAP";

export interface CanvasMargins {
  top: number; // mm
  right: number; // mm
  bottom: number; // mm
  left: number; // mm
}

export interface PrintRegion {
  id: string;
  name: string;
  x: number; // mm (top-left origin)
  y: number; // mm (top-left origin)
  width: number; // mm
  height: number; // mm
  rotation: 0 | 90 | 180 | 270;
  templateId?: string;
  templateVersion?: string;
  fieldMappings?: Map<string, string>;
  elements: LabelElement[];
  bindingContext?: Record<string, any>;
  enabled: boolean;
  zIndex: number;
}

export interface CanvasDiagnostic {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  regionId?: string;
}

export interface CanvasValidationReport {
  isValid: boolean;
  diagnostics: CanvasDiagnostic[];
}

export interface ExpandedLabelInstance {
  instanceId: string; // e.g. "job-001/canvas-1/region-1/copy-1"
  regionId: string;
  templateId?: string;
  templateVersion?: string;
  runtimeContext: Record<string, any>;
  elements: LabelElement[];
  xOffsetMm: number;
  yOffsetMm: number;
  rotation: 0 | 90 | 180 | 270;
  sequenceNumber: number;
}

export class UniversalPrintCanvas {
  public id: string;
  public name: string;
  public widthMm: number;
  public heightMm: number;
  public dpi: number;
  public orientation: "PORTRAIT" | "LANDSCAPE";
  public mediaType: CanvasMediaType;
  public sensor: CanvasSensorType;
  public layoutType: CanvasLayoutType;
  public columns: number;
  public rows: number;
  public gapXMm: number;
  public gapYMm: number;
  public margins: CanvasMargins;
  public regions: PrintRegion[];

  constructor(init?: {
    id?: string;
    name?: string;
    widthMm?: number;
    heightMm?: number;
    dpi?: number;
    orientation?: "PORTRAIT" | "LANDSCAPE";
    mediaType?: CanvasMediaType;
    sensor?: CanvasSensorType;
    layoutType?: CanvasLayoutType;
    columns?: number;
    rows?: number;
    gapXMm?: number;
    gapYMm?: number;
    margins?: CanvasMargins;
    regions?: PrintRegion[];
  }) {
    this.id = init?.id || `canvas-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.name = init?.name || "Universal Print Canvas";
    this.widthMm = init?.widthMm !== undefined ? init.widthMm : 100.5;
    this.heightMm = init?.heightMm !== undefined ? init.heightMm : 50.0;
    this.dpi = init?.dpi || 203;
    this.orientation = init?.orientation || "PORTRAIT";
    this.mediaType = init?.mediaType || "ROLL";
    this.sensor = init?.sensor || "GAP";
    this.layoutType = init?.layoutType || "FREEFORM";
    this.columns = init?.columns || 1;
    this.rows = init?.rows || 1;
    this.gapXMm = init?.gapXMm || 0;
    this.gapYMm = init?.gapYMm || 0;
    this.margins = init?.margins || { top: 0, right: 0, bottom: 0, left: 0 };
    this.regions = init?.regions ? [...init.regions] : [];
  }

  // --- DPI Conversion Utilities ---
  public mmToDots(mm: number): number {
    const dpm = this.dpi === 203 ? 8 : this.dpi / 25.4;
    return Math.round(mm * dpm);
  }

  public dotsToMm(dots: number): number {
    const dpm = this.dpi === 203 ? 8 : this.dpi / 25.4;
    return parseFloat((dots / dpm).toFixed(1));
  }

  // --- Region Management ---
  public addRegion(region: Partial<PrintRegion> & { name: string; width: number; height: number }): PrintRegion {
    const reg: PrintRegion = {
      id: region.id || `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: region.name,
      x: region.x || 0,
      y: region.y || 0,
      width: region.width,
      height: region.height,
      rotation: region.rotation || 0,
      templateId: region.templateId,
      templateVersion: region.templateVersion,
      fieldMappings: region.fieldMappings ? new Map(region.fieldMappings) : undefined,
      elements: region.elements ? [...region.elements] : [],
      bindingContext: region.bindingContext ? { ...region.bindingContext } : undefined,
      enabled: region.enabled !== undefined ? region.enabled : true,
      zIndex: region.zIndex || this.regions.length + 1,
    };

    this.regions.push(reg);
    return reg;
  }

  public removeRegion(regionId: string): boolean {
    const idx = this.regions.findIndex((r) => r.id === regionId);
    if (idx !== -1) {
      this.regions.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getRegion(regionId: string): PrintRegion | undefined {
    return this.regions.find((r) => r.id === regionId);
  }

  public updateRegion(regionId: string, updates: Partial<PrintRegion>): PrintRegion {
    const reg = this.getRegion(regionId);
    if (!reg) {
      throw new Error(`Cannot update region '${regionId}' - not found.`);
    }

    if (updates.name) reg.name = updates.name;
    if (updates.x !== undefined) reg.x = updates.x;
    if (updates.y !== undefined) reg.y = updates.y;
    if (updates.width !== undefined) reg.width = updates.width;
    if (updates.height !== undefined) reg.height = updates.height;
    if (updates.rotation !== undefined) reg.rotation = updates.rotation;
    if (updates.templateId !== undefined) reg.templateId = updates.templateId;
    if (updates.templateVersion !== undefined) reg.templateVersion = updates.templateVersion;
    if (updates.elements) reg.elements = [...updates.elements];
    if (updates.bindingContext) reg.bindingContext = { ...updates.bindingContext };
    if (updates.enabled !== undefined) reg.enabled = updates.enabled;
    if (updates.zIndex !== undefined) reg.zIndex = updates.zIndex;

    return reg;
  }

  // --- Grid N-Up Generator ---
  public setupGrid(columns: number, rows: number, regionWidthMm: number, regionHeightMm: number, gapXMm = 2, gapYMm = 2): void {
    this.layoutType = "GRID";
    this.columns = columns;
    this.rows = rows;
    this.gapXMm = gapXMm;
    this.gapYMm = gapYMm;
    this.regions = [];

    let count = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = this.margins.left + c * (regionWidthMm + gapXMm);
        const y = this.margins.top + r * (regionHeightMm + gapYMm);

        this.addRegion({
          name: `Grid Label ${count++}`,
          x,
          y,
          width: regionWidthMm,
          height: regionHeightMm,
          rotation: 0,
          enabled: true,
          zIndex: count,
        });
      }
    }
  }

  // --- Validation Engine ---
  public validate(overlapPolicy: OverlapPolicy = "WARN_OVERLAP"): CanvasValidationReport {
    const diagnostics: CanvasDiagnostic[] = [];

    if (this.widthMm <= 0 || this.heightMm <= 0) {
      diagnostics.push({ code: "INVALID_CANVAS_DIMENSIONS", severity: "ERROR", message: "Canvas width and height must be > 0." });
    }
    if (this.dpi <= 0) {
      diagnostics.push({ code: "INVALID_DPI", severity: "ERROR", message: "Canvas DPI must be > 0." });
    }

    const enabledRegions = this.regions.filter((r) => r.enabled);

    for (const reg of enabledRegions) {
      if (reg.width <= 0 || reg.height <= 0) {
        diagnostics.push({ code: "INVALID_REGION_DIMENSIONS", severity: "ERROR", message: `Region '${reg.name}' width/height must be > 0.`, regionId: reg.id });
      }

      // Check bounds
      if (reg.x < 0 || reg.y < 0 || reg.x + reg.width > this.widthMm || reg.y + reg.height > this.heightMm) {
        diagnostics.push({ code: "REGION_OUT_OF_BOUNDS", severity: "ERROR", message: `Region '${reg.name}' extends outside canvas boundaries.`, regionId: reg.id });
      }
    }

    // Check overlap between enabled regions
    for (let i = 0; i < enabledRegions.length; i++) {
      for (let j = i + 1; j < enabledRegions.length; j++) {
        const r1 = enabledRegions[i];
        const r2 = enabledRegions[j];

        const overlaps = !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x || r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);

        if (overlaps) {
          const msg = `Region '${r1.name}' overlaps with region '${r2.name}'.`;
          if (overlapPolicy === "REJECT_OVERLAP") {
            diagnostics.push({ code: "REGION_OVERLAP", severity: "ERROR", message: msg, regionId: r1.id });
          } else if (overlapPolicy === "WARN_OVERLAP") {
            diagnostics.push({ code: "REGION_OVERLAP", severity: "WARNING", message: msg, regionId: r1.id });
          }
        }
      }
    }

    const hasErrors = diagnostics.some((d) => d.severity === "ERROR");
    return { isValid: !hasErrors, diagnostics };
  }

  // --- Expansion Engine ---
  public expandInstances(records: Record<string, any>[], copiesPerRecord = 1, jobId = `job-${Date.now()}`): ExpandedLabelInstance[] {
    const instances: ExpandedLabelInstance[] = [];
    const enabledRegions = this.regions.filter((r) => r.enabled);

    if (enabledRegions.length === 0 || records.length === 0) {
      return instances;
    }

    let globalSeq = 1;
    let recordIdx = 0;

    while (recordIdx < records.length) {
      for (let copy = 1; copy <= copiesPerRecord; copy++) {
        for (const reg of enabledRegions) {
          const currentRecord = records[recordIdx % records.length] || {};
          const context = reg.bindingContext ? { ...currentRecord, ...reg.bindingContext } : { ...currentRecord };

          instances.push({
            instanceId: `${jobId}/canvas-${this.id}/reg-${reg.id}/seq-${globalSeq}`,
            regionId: reg.id,
            templateId: reg.templateId,
            templateVersion: reg.templateVersion,
            runtimeContext: context,
            elements: reg.elements.map((el) => ({ ...el })),
            xOffsetMm: reg.x,
            yOffsetMm: reg.y,
            rotation: reg.rotation,
            sequenceNumber: globalSeq++,
          });
        }
      }
      recordIdx++;
    }

    return instances;
  }
}
