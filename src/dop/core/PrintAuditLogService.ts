/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintAuditLogService (Permanent Audit Log Engine & BI Analytics)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.0.0
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

export interface PrintAnalyticsSummary {
  totalJobsProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalPayloadBytes: number;
  averageDurationMs: number;
  successRatePercentage: number;
}

class PrintAuditLogEngine {
  private auditLog: PermanentPrintAuditRecord[] = [];
  private maxRecords = 500;

  constructor() {
    this.seedDemoAuditRecords();
  }

  private seedDemoAuditRecords() {
    this.log({
      jobId: "job-inv-20260806-001",
      documentType: "INVOICE",
      referenceId: "INV-2026-0891",
      user: "Jawahar M.",
      printerId: "prn-laser-01",
      driverId: "driver.raw",
      transportId: "transport.mock",
      attempts: 1,
      durationMs: 45,
      payloadByteLength: 12540,
      status: "SUCCESS",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    });

    this.log({
      jobId: "job-receipt-20260806-002",
      documentType: "RECEIPT",
      referenceId: "INV-2026-0892",
      user: "Demo Cashier",
      printerId: "prn-pos-01",
      driverId: "driver.escpos",
      transportId: "transport.mock",
      attempts: 1,
      durationMs: 12,
      payloadByteLength: 840,
      status: "SUCCESS",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    });

    this.log({
      jobId: "job-label-20260806-003",
      documentType: "BARCODE_LABEL",
      referenceId: "LABEL-DEMO-001",
      user: "Warehouse Manager",
      printerId: "prn-barcode-01",
      driverId: "driver.zpl",
      transportId: "transport.mock",
      attempts: 1,
      durationMs: 18,
      payloadByteLength: 320,
      status: "SUCCESS",
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    });
  }

  public log(record: PermanentPrintAuditRecord): void {
    this.auditLog.unshift(record);
    if (this.auditLog.length > this.maxRecords) {
      this.auditLog.pop();
    }
  }

  public list(): PermanentPrintAuditRecord[] {
    return [...this.auditLog];
  }

  public getByJobId(jobId: string): PermanentPrintAuditRecord | undefined {
    return this.auditLog.find((r) => r.jobId === jobId);
  }

  public getAnalyticsSummary(): PrintAnalyticsSummary {
    const total = this.auditLog.length;
    if (total === 0) {
      return {
        totalJobsProcessed: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        totalPayloadBytes: 0,
        averageDurationMs: 0,
        successRatePercentage: 100,
      };
    }

    const successful = this.auditLog.filter((r) => r.status === "SUCCESS").length;
    const failed = total - successful;
    const totalBytes = this.auditLog.reduce((acc, r) => acc + r.payloadByteLength, 0);
    const totalDuration = this.auditLog.reduce((acc, r) => acc + r.durationMs, 0);

    return {
      totalJobsProcessed: total,
      totalSuccessful: successful,
      totalFailed: failed,
      totalPayloadBytes: totalBytes,
      averageDurationMs: Math.round(totalDuration / total),
      successRatePercentage: Math.round((successful / total) * 100),
    };
  }
}

export const PrintAuditLogService = new PrintAuditLogEngine();
