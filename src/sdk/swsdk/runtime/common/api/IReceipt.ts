export interface IReceipt {
  id: string;
  source: string;
  status: "accepted" | "delivered" | "failed";
  timestamp: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
