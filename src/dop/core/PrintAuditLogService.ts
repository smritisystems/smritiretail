/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintAuditLogService (Permanent Audit Log Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.1.0
 */

export interface PermanentPrintAuditRecord {
  jobId: string;
  documentType: string;
  referenceId: string;
  user: string;
  printerId: string;
  driverId: string;
  transportId: string;
  attempts: number;
  durationMs: number;
  payloadByteLength: number;
  status: "SUCCESS" | "FAILED" | "DLQ";
  errorMessage?: string;
  timestamp: string;
}

class PrintAuditLogEngine {
  private auditLog: PermanentPrintAuditRecord[] = [];
  private maxRecords = 500;

  public log(record: PermanentPrintAuditRecord): void {
    this.auditLog.unshift(record);
    if (this.auditLog.length > this.maxRecords) {
      this.auditLog.pop();
    }
    console.log(`[PrintAuditLogService]: Logged Job ${record.jobId} status=${record.status} duration=${record.durationMs}ms bytes=${record.payloadByteLength}`);
  }

  public list(): PermanentPrintAuditRecord[] {
    return [...this.auditLog];
  }

  public getByJobId(jobId: string): PermanentPrintAuditRecord | undefined {
    return this.auditLog.find((r) => r.jobId === jobId);
  }
}

export const PrintAuditLogService = new PrintAuditLogEngine();
