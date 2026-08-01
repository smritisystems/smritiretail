export enum DeliveryPolicyKind {
  Immediate = "immediate",
  Delayed = "delayed",
  Scheduled = "scheduled",
  Digest = "digest",
  Suppress = "suppress",
  Retry = "retry",
  Escalate = "escalate",
  DeadLetter = "dead-letter"
}

export interface DeliveryPolicy {
  kind: DeliveryPolicyKind;
  retries?: number;
  delayMs?: number;
}

export const DefaultDeliveryPolicy: DeliveryPolicy = {
  kind: DeliveryPolicyKind.Immediate,
  retries: 0,
  delayMs: 0
};
