export interface Metadata {
  traceId?: string;
  tenantId?: string;
  correlationId?: string;
  source?: string;
  [key: string]: unknown;
}

export function createMetadata(overrides: Metadata = {}): Metadata {
  return { ...overrides };
}
