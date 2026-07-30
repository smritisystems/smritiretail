/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Types & Interfaces
 */

export type SAWFExperienceMode = "simple" | "standard" | "enterprise";

export type SAWFWorkspaceProfile = 
  | "cashier" 
  | "sales_exec" 
  | "store_manager" 
  | "accountant" 
  | "admin" 
  | "custom";

export interface SAWFPanelMeta {
  id: string;
  label: string;
  modes: SAWFExperienceMode[];
  icon?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface SAWFSidebarWidgetMeta {
  id: string;
  title: string;
  modes: SAWFExperienceMode[];
  collapsible?: boolean;
}

export interface SAWFDocumentMeta {
  document: string;
  title: string;
  defaultMode: SAWFExperienceMode;
  panels: SAWFPanelMeta[];
  sidebarWidgets: string[];
}

export interface SAWFCommandItem {
  id: string;
  label: string;
  shortcut?: string;
  category: "Actions" | "Navigation" | "Items" | "Payment" | "Compliance";
  icon?: string;
  action: () => void;
}

export interface SAWFEvent<T = any> {
  type: string;
  payload: T;
  timestamp: number;
}

export type SAWFEventHandler<T = any> = (event: SAWFEvent<T>) => void;
