export enum RetryStrategy {
  None = "none",
  Fixed = "fixed",
  Exponential = "exponential"
}

export interface RetryPolicy {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DefaultRetryPolicy: RetryPolicy = {
  strategy: RetryStrategy.None,
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0
};
