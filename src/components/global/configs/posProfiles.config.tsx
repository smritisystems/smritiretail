/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Monitor, Copy, Lock, Unlock, Archive, CheckCircle2, XCircle } from "lucide-react";
import { MasterConfig } from "../master/types.ts";
import { POSProfile } from "../../../types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

export const posProfilesConfig: MasterConfig<POSProfile> = {
  entityName: "POS Terminal Profile",
  entityNamePlural: "POS Profiles",
  title: "POS Terminal & Counter Profiles",
  subtitle: "Configure billing counter registers, operator shift assignments, cash drawer policies, and terminal lockouts",
  icon: <Monitor size={20} />,
  apiEndpoint: "/api/v1/pos/profiles/",
  idKey: "id",
  searchPlaceholder: "Search by terminal name, cashier, or warehouse...",
  searchFields: ["name", "cashier", "warehouse"],

  columns: [
    {
      key: "name",
      label: "Terminal Profile",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
            <Monitor size={14} />
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val}</div>
            <div className="text-[10px] text-theme-muted font-mono">{item.id}</div>
          </div>
        </div>
      )
    },
    {
      key: "cashier",
      label: "Assigned Cashier",
      width: "160px",
      render: (val) => (
        <span className="font-medium text-theme-primary">
          {val || "Any Operator"}
        </span>
      )
    },
    {
      key: "warehouse",
      label: "Default Warehouse / Store",
      width: "180px",
      render: (val) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider text-theme-primary">
          {val || "Main Warehouse"}
        </span>
      )
    },
    {
      key: "isLocked",
      label: "Shift Lock",
      width: "120px",
      render: (val) => (
        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
          val ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        }`}>
          {val ? <Lock size={10} /> : <CheckCircle2 size={10} />}
          <span>{val ? "SHIFT LOCKED" : "ACTIVE"}</span>
        </span>
      )
    }
  ],

  fields: [
    {
      name: "name",
      label: "Terminal / Counter Name",
      type: "text",
      required: true,
      placeholder: "e.g. Counter 01 - Express Billing",
      colSpan: 1
    },
    {
      name: "cashier",
      label: "Default Cashier Operator",
      type: "text",
      required: true,
      placeholder: "e.g. Cashier 01 / John Doe",
      colSpan: 1
    },
    {
      name: "warehouse",
      label: "Stock Warehouse",
      type: "text",
      required: true,
      placeholder: "e.g. Central Retail Floor / Main Store",
      colSpan: 1
    }
  ],

  customActions: [
    {
      id: "clone",
      label: "Clone Profile",
      icon: <Copy size={13} />,
      onClick: async (item, refetch) => {
        try {
          await apiFetchV1(`/pos/profiles/${item.id}/clone`, { method: "POST" });
          refetch();
        } catch (e) {
          console.error("Failed to clone profile:", e);
        }
      }
    },
    {
      id: "toggle-lock",
      label: "Toggle Shift Lock",
      icon: <Lock size={13} />,
      onClick: async (item, refetch) => {
        try {
          await apiFetchV1(`/pos/profiles/${item.id}/toggle-lock`, { method: "POST" });
          refetch();
        } catch (e) {
          console.error("Failed to toggle profile lock:", e);
        }
      }
    }
  ],

  kpis: [
    {
      id: "total_terminals",
      label: "Total Terminals",
      compute: (items) => items.length,
      color: "blue"
    },
    {
      id: "active_terminals",
      label: "Open / Active Registers",
      compute: (items) => items.filter((p) => !p.isLocked).length,
      color: "emerald"
    },
    {
      id: "locked_terminals",
      label: "Locked Counters",
      compute: (items) => items.filter((p) => p.isLocked).length,
      color: "rose"
    }
  ]
};
