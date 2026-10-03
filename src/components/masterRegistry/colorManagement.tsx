import React from "react";
import { Palette } from "lucide-react";
import { MasterConfig } from "../global/master/types.ts";
import { mapLookupResponse, masterLookupConfig, MasterLookupItem } from "../global/configs/masterLookup.confi.tsx";

export interface ColorGroupRegistryItem extends MasterLookupItem {
  values: string;
  category?: string;
}

const parseValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? "").trim().toUpperCase()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean);
  return [];
};

export const getColorManagementTypeConfig = (): MasterConfig<ColorGroupRegistryItem> => ({
  ...masterLookupConfig,
  entityName: "Color Group",
  entityNamePlural: "Color Groups",
  title: "Color Management",
  subtitle: "Create and maintain governed color groups used by footwear, apparel, and SKU variant generation.",
  icon: <Palette size={20} />,
  apiEndpoint: "/masters/lookup/color_group/values",
  responseTransform: (items: any) => mapLookupResponse(items, "color_group").map((item: any) => ({
    ...item,
    values: item.values || "",
    category: String(item.data?.category || "GENERAL").trim().toUpperCase(),
  })),
  payloadTransform: (formData: any) => ({
    code: String(formData.code || "").trim().toUpperCase(),
    name: String(formData.name || "").trim(),
    active: formData.is_active !== false,
    data: {
      dimension: "color",
      category: String(formData.category || "GENERAL").trim().toUpperCase(),
      values: parseValues(formData.values),
      description: String(formData.description || "").trim(),
    },
  }),
  searchPlaceholder: "Search color group name, code, category, or values...",
  searchFields: ["name", "code", "category", "description", "values"],
  columns: [
    ...masterLookupConfig.columns,
    {
      key: "values",
      label: "Ordered Color Values",
      render: (value: unknown) => (
        <span className="max-w-md truncate text-xs text-theme-muted">
          {typeof value === "string" && value ? value : "—"}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      width: "120px",
      sortable: true,
      render: (value: unknown) => (
        <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold font-mono text-indigo-300">
          {String(value || "GENERAL")}
        </span>
      ),
    },
  ],
  fields: [
    {
      name: "name",
      label: "Color Group Name",
      type: "text",
      required: true,
      placeholder: "e.g. Footwear Colors",
      colSpan: 1,
    },
    {
      name: "code",
      label: "Color Group Code",
      type: "text",
      required: true,
      placeholder: "e.g. COLOR_FOOTWEAR",
      colSpan: 1,
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      defaultValue: "GENERAL",
      options: [
        { label: "General", value: "GENERAL" },
        { label: "Apparel", value: "APPAREL" },
        { label: "Footwear", value: "FOOTWEAR" },
        { label: "Accessories", value: "ACCESSORIES" },
      ],
      colSpan: 1,
    },
    {
      name: "is_active",
      label: "Active Status",
      type: "toggle",
      defaultValue: true,
      colSpan: 1,
    },
    {
      name: "values",
      label: "Ordered Color Values",
      type: "textarea",
      required: true,
      placeholder: "BLACK, WHITE, BROWN, TAN, NAVY",
      description: "Values are normalized to uppercase and used for Color SKU variants.",
      colSpan: 2,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Optional notes for this color set.",
      colSpan: 2,
    },
  ],
  filters: [
    {
      id: "category_filter",
      label: "Category",
      field: "category",
      type: "select",
      options: [
        { label: "All", value: "ALL" },
        { label: "Apparel", value: "APPAREL" },
        { label: "Footwear", value: "FOOTWEAR" },
        { label: "Accessories", value: "ACCESSORIES" },
        { label: "General", value: "GENERAL" },
      ],
      defaultValue: "ALL",
    },
  ],
  kpis: [
    {
      id: "color_groups_total",
      label: "Configured Groups",
      compute: (items) => items.length,
      color: "blue",
    },
    {
      id: "active_color_groups",
      label: "Active Groups",
      compute: (items) => items.filter((item) => item.is_active !== false).length,
      color: "emerald",
    },
  ],
});
