/**
 * Project      : SMRITI Retail OS
 * Component    : PrinterAdapter (SDP Physical Hardware Adapter)
 * Standard     : SCS-DXP-001 & Principle 001
 * Author       : Jawahar Ramkripal Mallah
 */

import { IOutputAdapter } from "./IOutputAdapter.ts";
import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";
import { PrintAgentManager } from "../agents/PrintAgentManager.ts";

export class PrinterAdapter implements IOutputAdapter {
  public channel: "PRINT" = "PRINT";

  public async execute(req: DxpDocumentRequest): Promise<DxpDocumentResult> {
    const itemCount = req.items?.reduce((acc, item) => acc + item.quantity, 0) || 1;
    const copies = req.copies || 1;
    const totalProcessed = itemCount * copies;

    console.log(`[DXP PrinterAdapter]: Dispatching ${totalProcessed} labels/pages for ${req.referenceId} via PrintAgentManager.`);

    const agentResult = await PrintAgentManager.dispatch(req);
    return {
      ...agentResult,
      labelsOrPagesProcessed: totalProcessed,
    };
  }
}
