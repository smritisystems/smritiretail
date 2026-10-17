import React, { useState } from "react";
import { Layers3, Ruler } from "lucide-react";
import { MasterConfig } from "../global/master/types.ts";

export interface SizeGroupRegistryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  values: string[];
  description?: string;
  is_active?: boolean;
  type_code?: string;
}

const parseValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const MasterRegistrySizeGroupPicker: React.FC<{
  items: SizeGroupRegistryItem[];
}> = ({ items }) => {
  const [selectedCode, setSelectedCode] = useState(items[0]?.code || "");
  const selectedGroup = items.find((item) => item.code === selectedCode);

  return (
    <div className="flex flex-col gap-1.5 min-w-64 md:min-w-80">
      <label htmlFor="master-registry-size-group" className="text-[10px] font-bold uppercase tracking-wider text-theme-muted font-mono">
        Select from Master Registry
      </label>
      <div className="flex items-center gap-2">
        <select
          id="master-registry-size-group"
          value={selectedCode}
          onChange={(event) => setSelectedCode(event.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-theme-divider bg-theme-surface-1 px-3 py-2 text-xs font-bold text-theme-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Select Size Group Code / Name</option>
          {items.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} — {item.name}
            </option>
          ))}
        </select>
        {selectedGroup && (
          <span className="truncate text-xs font-semibold text-theme-muted" title={selectedGroup.name}>
            {selectedGroup.name}
          </span>
        )}
      </div>
    </div>
  );
};

export const getMasterRegistryTypeConfig = (
  typeCode = "size_group",
  mode: "select" | "manage" = "select"
): MasterConfig<SizeGroupRegistryItem> => {
  const isRegistryEditor = mode === "manage";

  return {
  entityName: isRegistryEditor ? "Size Group Master" : "Size Group",
  entityNamePlural: "Size Groups",
  title: isRegistryEditor ? "Size Group Master Registry" : "Size Management",
  subtitle: isRegistryEditor
    ? "Create, edit, and arrange canonical size values used by Size Management."
    : "Select canonical size groups from the Master Registry. Size groups are not created in this module.",
  icon: <Layers3 size={20} />,
  apiEndpoint: "/masters/size-groups",
  idKey: "id",
  responseTransform: (data) =>
    Array.isArray(data)
      ? data.map((item) => {
          const values = parseValues(item?.data?.values ?? item?.values ?? []);
          const category = String(item?.data?.category || item?.category || "APPAREL").trim().toUpperCase();
          return {
            ...item,
            type_code: typeCode,
            values,
            category,
            description: item?.data?.description || item?.data?.notes || "",
            is_active: item?.active !== false,
          };
        })
      : [],
  searchPlaceholder: "Search size group name, code, category, or values...",
  searchFields: ["name", "code", "category", "description", "values"],
  defaultSort: { key: "name", direction: "asc" },
  permissions: isRegistryEditor ? undefined : {
    createRole: [],
    editRole: [],
    deleteRole: [],
  },
  slots: isRegistryEditor ? undefined : {
    extraHeaderActions: (_refetch, items) => (
      <MasterRegistrySizeGroupPicker items={items} />
    ),
  },
  columns: [
    {
      key: "name",
      label: "Size Group",
      width: "220px",
      sortable: true,
      render: (val, item) => (
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
            <Ruler size={13} />
          </div>
          <div>
            <div className="font-bold text-theme-primary">{val || "Unnamed"}</div>
            <div className="font-mono text-[10px] text-theme-muted">{item.code || item.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      width: "140px",
      sortable: true,
      render: (val) => (
        <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold font-mono text-indigo-300">
          {val || "APPAREL"}
        </span>
      ),
    },
    {
      key: "values",
      label: "Size Values",
      render: (val: string[] | undefined) => (
        <span className="max-w-md truncate text-xs text-theme-muted">
          {Array.isArray(val) && val.length > 0 ? val.join(" • ") : "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      width: "90px",
      render: (val) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold font-mono ${
            val !== false
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-400"
          }`}
        >
          {val !== false ? "Active" : "Inactive"}
        </span>
      ),
    },
  ],
  payloadTransform: isRegistryEditor ? (formData) => ({
    code: String(formData.code || "").trim(),
    name: String(formData.name || "").trim(),
    active: formData.is_active !== false,
    data: {
      dimension: "size",
      category: String(formData.category || "APPAREL").trim().toUpperCase(),
      values: parseValues(formData.values),
      description: String(formData.description || "").trim(),
    },
  }) : undefined,
  fields: isRegistryEditor ? [
    {
      name: "code",
      label: "Size Group Code",
      type: "select",
      required: true,
      optionsEndpoint: "/masters/size-groups",
      transformOptions: (data) =>
        Array.isArray(data)
          ? data.map((item) => ({
              label: `${item.code} — ${item.name}`,
              value: item.code,
            }))
          : [],
      description: "Select an existing code from the Master Registry.",
      colSpan: 1,
    },
    {
      name: "name",
      label: "Size Group Name",
      type: "text",
      required: true,
      placeholder: "e.g. Apparel Alpha Sizes",
      colSpan: 1,
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      defaultValue: "APPAREL",
      options: [
        { label: "Apparel", value: "APPAREL" },
        { label: "Footwear", value: "FOOTWEAR" },
        { label: "Electronics", value: "ELECTRONICS" },
        { label: "Accessories", value: "ACCESSORIES" },
        { label: "General", value: "GENERAL" },
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
      label: "Ordered Size Values",
      type: "textarea",
      required: true,
      placeholder: "XS, S, M, L, XL, XXL",
      description: "Enter values in the exact order they should appear.",
      colSpan: 2,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Optional notes for this size set and usage context.",
      colSpan: 2,
    },
  ] : [],
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
        { label: "Electronics", value: "ELECTRONICS" },
        { label: "Accessories", value: "ACCESSORIES" },
      ],
      defaultValue: "ALL",
    },
  ],
  kpis: [
    {
      id: "size_groups_total",
      label: "Configured Groups",
      compute: (items) => items.length,
      color: "blue",
    },
    {
      id: "active_size_groups",
      label: "Active Groups",
      compute: (items) => items.filter((item) => item.is_active !== false).length,
      color: "emerald",
    },
  ],
  };
};
