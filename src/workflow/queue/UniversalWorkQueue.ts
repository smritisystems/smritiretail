/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUWINE UniversalWorkQueue (Polymorphic Work Item Queue v2.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.1.0
 */

export interface UniversalWorkItem {
  id: string;
  type: "Approval" | "Task" | "Reminder" | "Notification" | "Escalation";
  title: string;
  module: string;
  documentId: string;
  amount?: number;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Approved" | "Rejected" | "Escalated" | "Overdue";
  assignedTo: string;
  createdAt: string;
  slaDueDate: string;
}

export const INITIAL_WORK_ITEMS: UniversalWorkItem[] = [
  {
    id: "WORK-1001",
    type: "Approval",
    title: "Purchase Order PO-2026-00045 Approval Required",
    module: "Purchase",
    documentId: "PO-2026-00045",
    amount: 250000,
    priority: "High",
    status: "Pending",
    assignedTo: "PER-1001",
    createdAt: "2026-07-29T10:00:00Z",
    slaDueDate: "2026-07-31T10:00:00Z"
  },
  {
    id: "WORK-1002",
    type: "Task",
    title: "Verify New Supplier GSTIN Registration",
    module: "Supplier",
    documentId: "SUPP-NEW-089",
    priority: "Medium",
    status: "Pending",
    assignedTo: "PER-1001",
    createdAt: "2026-07-29T11:30:00Z",
    slaDueDate: "2026-07-30T17:00:00Z"
  },
  {
    id: "WORK-1003",
    type: "Escalation",
    title: "Dead Stock Reorder Alert (Footwear Size 8)",
    module: "Inventory",
    documentId: "SKU-NIKE-008",
    priority: "High",
    status: "Escalated",
    assignedTo: "PER-1001",
    createdAt: "2026-07-28T09:00:00Z",
    slaDueDate: "2026-07-29T09:00:00Z"
  }
];
