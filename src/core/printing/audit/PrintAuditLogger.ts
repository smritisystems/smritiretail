export type PrintAuditAction = "DISCOVERY" | "USB_PERMISSION" | "CONNECTION_ATTEMPT";

export class PrintAuditLogger {
  static record(action: PrintAuditAction, detail: Record<string, unknown>): void {
    const entry = { action, detail, timestamp: new Date().toISOString() };
    try {
      const current = JSON.parse(localStorage.getItem("smriti_print_audit_v1") || "[]");
      const entries = Array.isArray(current) ? current.slice(-199) : [];
      localStorage.setItem("smriti_print_audit_v1", JSON.stringify([...entries, entry]));
    } catch (error) {
      console.warn("[PrintAuditLogger] Failed to persist audit entry:", error);
    }
  }
}