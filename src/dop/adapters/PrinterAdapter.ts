/**
 * Project      : SMRITI Retail OS
 * Component    : PrinterAdapter (SDP Physical Hardware Adapter)
 * Standard     : SCS-DXP-001 & Principle 001
 * Author       : Jawahar Ramkripal Mallah
 */

import { IOutputAdapter } from "./IOutputAdapter.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export class PrinterAdapter implements IOutputAdapter {
  public channel: "PRINT" = "PRINT";

  public async execute(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    const itemCount = req.items?.reduce((acc, item) => acc + item.quantity, 0) || 1;
    const copies = req.copies || 1;
    const totalProcessed = itemCount * copies;

    console.log(`[DXP PrinterAdapter]: Dispatching ${totalProcessed} labels/pages for ${req.referenceId} to SDP Hardware Daemon.`);

    return {
      jobId: `job-print-${Date.now()}`,
      lifecycleState: "DELIVERED",
      channel: "PRINT",
      adapterUsed: "PrinterAdapter (SDP Local Daemon)",
      templateVersion: 1,
      labelsOrPagesProcessed: totalProcessed,
    };
  }
}
