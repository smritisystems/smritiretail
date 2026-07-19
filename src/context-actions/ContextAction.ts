/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { ReactNode } from "react";

export type ContextCategory = "Workflow" | "Enterprise" | "Document" | "Developer" | "System" | "Analytics";

export interface ContextData {
  module: string;             // e.g., "sales", "inventory", "purchase", "item-master"
  type: string;               // e.g., "invoice", "product", "supplier", "purchase-order", "customer"
  object?: any;               // The actual model data (e.g., an invoice object)
  count?: number;             // Selection count (for bulk operations)
  role?: string;              // Current user role ("Store Manager", "Cashier", "Admin")
  permissions?: string[];     // User specific permissions
  branch?: string;            // Active branch or outlet
  companySettings?: any;      // Custom enterprise settings
  featureFlags?: Record<string, boolean>;
}

export interface ContextAction {
  id: string;
  label: string;
  icon: string;               // Lucide icon name or Material Symbol name
  description?: string;
  category?: ContextCategory;
  shortcut?: string;          // Keyboard shortcut string, e.g., "Ctrl+Shift+P" or "P"
  disabled?: boolean | ((context: ContextData) => boolean);
  visible?: boolean | ((context: ContextData) => boolean);
  isFavorite?: boolean;
  isRecent?: boolean;
  isPinned?: boolean;
  isAiRecommended?: boolean | ((context: ContextData) => boolean); // AI/ACAS Predictive Promoted
  onClick: (context: ContextData) => void | Promise<void>;
}
