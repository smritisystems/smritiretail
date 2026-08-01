export interface TransportHealth {
  status: "healthy" | "degraded" | "unhealthy";
  published: number;
  delivered: number;
  failed: number;
  queueDepth: number;
  latency: number;
  lastError?: string;
  lastSuccessfulPublish?: string;
}
