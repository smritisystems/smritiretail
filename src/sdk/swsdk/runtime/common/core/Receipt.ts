import type { IReceipt } from "../api/IReceipt.js";

export class Receipt implements IReceipt {
  public readonly id: string;
  public readonly source: string;
  public readonly status: IReceipt["status"];
  public readonly timestamp: string;
  public readonly correlationId?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(status: IReceipt["status"], source: string, overrides: Partial<IReceipt> = {}) {
    this.id = overrides.id ?? `receipt-${Date.now()}`;
    this.source = source;
    this.status = status;
    this.timestamp = overrides.timestamp ?? new Date().toISOString();
    this.correlationId = overrides.correlationId;
    this.metadata = overrides.metadata ?? {};
  }
}

export function createReceipt(status: IReceipt["status"], source: string, overrides: Partial<IReceipt> = {}): Receipt {
  return new Receipt(status, source, overrides);
}
