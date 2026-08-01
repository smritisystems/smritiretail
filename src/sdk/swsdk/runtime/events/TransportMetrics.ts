export interface TransportMetrics {
  published: number;
  delivered: number;
  failed: number;
  retried: number;
  deadLettered: number;
  latency: number;
}
