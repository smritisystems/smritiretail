export interface IEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  type: string;
  source: string;
  payload: TPayload;
  timestamp: string;
  correlationId?: string;
}
