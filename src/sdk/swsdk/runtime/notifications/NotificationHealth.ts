export interface NotificationHealth {
  queued: number;
  sent: number;
  failed: number;
  retried: number;
  deadLetter: number;
  suppressed: number;
}
