/**
 * Project      : SMRITI Retail OS
 * Component    : PreviewAdapter (Interactive UI Preview Adapter)
 * Standard     : SCS-DXP-001
 * Author       : Jawahar Ramkripal Mallah
 */

import { IOutputAdapter } from "./IOutputAdapter.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export class PreviewAdapter implements IOutputAdapter {
  public channel: "PREVIEW" = "PREVIEW";

  public async execute(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    console.log(`[DXP PreviewAdapter]: Generating interactive preview stream for ${req.referenceId}.`);

    return {
      jobId: `job-preview-${Date.now()}`,
      lifecycleState: "RENDERED",
      channel: "PREVIEW",
      outputUri: `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="20" y="40" fill="%2338bdf8" font-family="sans-serif" font-weight="bold">${req.documentType}: ${req.referenceId}</text></svg>`,
      adapterUsed: "PreviewAdapter (SVG Stream Renderer)",
      templateVersion: 1,
      labelsOrPagesProcessed: 1,
    };
  }
}
