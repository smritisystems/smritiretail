import type { AuditRecord } from "./AuditRecord.js";

export class AuditRegistry {
  private readonly records = new Map<string, AuditRecord>();

  public write(record: AuditRecord): void {
    this.records.set(record.id, record);
  }

  public list(): AuditRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }
}
