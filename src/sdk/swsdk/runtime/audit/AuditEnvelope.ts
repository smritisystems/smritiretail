import type { AuditRecord } from "./AuditRecord.js";

export interface AuditEnvelope {
  id: string;
  records: AuditRecord[];
  generatedAt: string;
  source: string;
}

export function createAuditEnvelope(records: AuditRecord[], source: string): AuditEnvelope {
  return {
    id: `audit-envelope-${Date.now()}`,
    records,
    generatedAt: new Date().toISOString(),
    source
  };
}
