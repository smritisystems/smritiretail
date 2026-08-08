import type { IEnvelope } from "../api/IEnvelope.js";

export class Envelope<TPayload = Record<string, unknown>> implements IEnvelope<TPayload> {
  public readonly id: string;
  public readonly type: string;
  public readonly source: string;
  public readonly payload: TPayload;
  public readonly timestamp: string;
  public readonly correlationId?: string;

  constructor(type: string, source: string, payload: TPayload, overrides: Partial<IEnvelope<TPayload>> = {}) {
    this.id = overrides.id ?? `envelope-${Date.now()}`;
    this.type = type;
    this.source = source;
    this.payload = payload;
    this.timestamp = overrides.timestamp ?? new Date().toISOString();
    this.correlationId = overrides.correlationId;
  }
}

export function createEnvelope<TPayload = Record<string, unknown>>(
  type: string,
  source: string,
  payload: TPayload,
  overrides: Partial<IEnvelope<TPayload>> = {}
): Envelope<TPayload> {
  return new Envelope(type, source, payload, overrides);
}
