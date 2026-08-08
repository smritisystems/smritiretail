import type { AuditRecord } from "./AuditRecord.js";
import type { IStorage } from "../common/api/IStorage.js";
import { MemoryStorage } from "../common/adapters/MemoryStorage.js";

export type AuditStorage = IStorage<AuditRecord>;

export class MemoryAuditStorage extends MemoryStorage<AuditRecord> implements AuditStorage {
}
