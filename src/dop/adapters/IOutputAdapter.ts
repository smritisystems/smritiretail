/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : IOutputAdapter Contract (SCS-DXP-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export interface IOutputAdapter {
  channel: "PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP" | "ARCHIVE";
  execute(req: DxpDocumentRequest): Promise<DxpDocumentResult>;
}
