import type { PlatformMessage } from "../kernel/api/PlatformMessage.js";
import type { ISerializer } from "../common/api/ISerializer.js";
import type { IStorage } from "../common/api/IStorage.js";
import { JsonSerializer } from "../common/adapters/JsonSerializer.js";
import { MemoryStorage } from "../common/adapters/MemoryStorage.js";
import type { AuditRecord } from "./AuditRecord.js";
import { createAuditRecord } from "./AuditRecord.js";

export class AuditService {
  private readonly serializer: ISerializer<AuditRecord>;
  private readonly storage: IStorage<AuditRecord>;

  constructor(storage: IStorage<AuditRecord> = new MemoryStorage<AuditRecord>(), serializer: ISerializer<AuditRecord> = new JsonSerializer<AuditRecord>()) {
    this.storage = storage;
    this.serializer = serializer;
  }

  public record(message: PlatformMessage): AuditRecord {
    const record = createAuditRecord({
      id: `audit-${message.serviceId ?? "kernel"}-${Date.now()}`,
      type: message.type,
      source: message.source ?? "kernel",
      payload: message.payload ?? {},
      correlationId: message.correlationId,
    });

    this.storage.write(record);
    return record;
  }

  public serialize(record: AuditRecord): string {
    return this.serializer.serialize(record);
  }

  public deserialize(raw: string): AuditRecord {
    return this.serializer.deserialize(raw);
  }

  public list(): AuditRecord[] {
    return this.storage.readAll();
  }

  public readAll(): AuditRecord[] {
    return this.storage.readAll();
  }

  public clear(): void {
    this.storage.clear();
  }
}
