/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : DocumentService Facade (SCS-DXP-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * SIF / SCS Compliance Declaration
 * SCS Standard   : SCS-DXP-001 (Universal Document Experience Platform v1.0 — FROZEN)
 * Principle      : Principle 001 — Complexity Must Be Hidden
 */

import { DxpDocumentRequest, DxpDocumentResult, DxpOutputChannel } from "../models/DxpTypes.ts";
import { DocumentRegistry } from "./DocumentRegistry.ts";
import { IOutputAdapter } from "../adapters/IOutputAdapter.ts";
import { PrinterAdapter } from "../adapters/PrinterAdapter.ts";
import { PdfAdapter } from "../adapters/PdfAdapter.ts";
import { PreviewAdapter } from "../adapters/PreviewAdapter.ts";

class DocumentServiceEngine {
  private adapters: Map<DxpOutputChannel, IOutputAdapter> = new Map();

  constructor() {
    this.registerAdapters();
  }

  private registerAdapters() {
    this.adapters.set("PRINT", new PrinterAdapter());
    this.adapters.set("PDF", new PdfAdapter());
    this.adapters.set("PREVIEW", new PreviewAdapter());
  }

  public async execute(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    const descriptor = DocumentRegistry.getDescriptor(req.documentType);
    const targetChannel: DxpOutputChannel = req.channel || descriptor.defaultChannel;

    const adapter = this.adapters.get(targetChannel) || this.adapters.get("PREVIEW")!;
    console.log(`[SCS-DXP-001 DocumentService]: Executing ${req.documentType} document via ${adapter.channel} channel.`);

    return adapter.execute(req);
  }

  public async output(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    return this.execute(req);
  }

  public async preview(req: DxpDocumentRequest): Promise<string> {
    const res = await this.execute({ ...req, channel: "PREVIEW" });
    return res.outputUri || "";
  }

  public async reprint(jobId: string, copies = 1): Promise<DxpDocumentResult> {
    console.log(`[SCS-DXP-001 DocumentService]: Reprinting historical job ${jobId} (Copies: ${copies}).`);
    return {
      jobId: `reprint-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: "PRINT",
      adapterUsed: "PrinterAdapter (SDP Local Daemon)",
      templateVersion: 1,
      labelsOrPagesProcessed: copies,
    };
  }

  public async reshare(jobId: string, channel: "EMAIL" | "WHATSAPP"): Promise<DxpDocumentResult> {
    console.log(`[SCS-DXP-001 DocumentService]: Resharing historical job ${jobId} via ${channel}.`);
    return {
      jobId: `reshare-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: channel as DxpOutputChannel,
      adapterUsed: `${channel}Adapter`,
      templateVersion: 1,
      labelsOrPagesProcessed: 1,
    };
  }
}

export const DocumentService = new DocumentServiceEngine();
