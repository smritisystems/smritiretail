import type { AuditRecord } from "./AuditRecord.js";

export class AuditSerializer {
  public serialize(record: AuditRecord): string {
    return JSON.stringify(record, null, 2);
  }

  public deserialize(raw: string): AuditRecord {
    return JSON.parse(raw) as AuditRecord;
  }
}
