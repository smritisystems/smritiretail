/**
 * Project      : SMRITI Business OS
 * Component    : PrintHistoryService (Rule SLP-002 & SLP-005)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Services
 */

export interface PrintHistoryEntry {
  jobId: string;
  timestamp: string;
  user: string;
  printer: string;
  provider: string;
  template: string;
  sourceDoc: string;
  itemsCount: number;
  totalLabels: number;
  status: "Completed" | "Failed" | "Queued" | "Printing" | "Cancelled";
  errorMessage?: string;
  scriptSnippet?: string;
}

const STORAGE_KEY = "smriti_label_print_history";

export class PrintHistoryService {
  /**
   * Retrieves all logged print jobs
   */
  static getHistory(): PrintHistoryEntry[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : this.getInitialMockHistory();
    } catch {
      return this.getInitialMockHistory();
    }
  }

  /**
   * Records a new print job entry
   */
  static addEntry(entry: Omit<PrintHistoryEntry, "jobId" | "timestamp">): PrintHistoryEntry {
    const history = this.getHistory();
    const newJob: PrintHistoryEntry = {
      ...entry,
      jobId: `JOB-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
    };

    history.unshift(newJob);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
    }
    return newJob;
  }

  private static getInitialMockHistory(): PrintHistoryEntry[] {
    return [
      {
        jobId: "JOB-904128",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: "super",
        printer: "TSC TTP-244 Pro (USB)",
        provider: "Raw PRN File Download",
        template: "Standard Retail 50x25mm (TSPL)",
        sourceDoc: "Manual Selection",
        itemsCount: 4,
        totalLabels: 12,
        status: "Completed",
      },
      {
        jobId: "JOB-904112",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        user: "super",
        printer: "Zebra ZD421 (Network)",
        provider: "Browser System Print",
        template: "Zebra Barcode Label (ZPL)",
        sourceDoc: "Sales Invoice SI-2026-0881",
        itemsCount: 1,
        totalLabels: 5,
        status: "Completed",
      },
    ];
  }
}
