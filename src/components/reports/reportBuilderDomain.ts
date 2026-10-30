export const REPORT_BUILDER_LIVE_CATEGORIES = [
  "Purchase",
  "Sales",
  "Inventory",
  "Items",
  "Customers",
  "Suppliers",
] as const;

export interface ReportBuilderFieldSelection {
  category: string;
  key: string;
}

export function isReportBuilderCategoryLive(category: string): boolean {
  return REPORT_BUILDER_LIVE_CATEGORIES.some((liveCategory) => liveCategory === category);
}

export function resolveReportBuilderFieldSelection(
  activeCategory: string,
  selectedKeys: string[],
  field: ReportBuilderFieldSelection,
): { category: string; selectedKeys: string[] } | null {
  if (!isReportBuilderCategoryLive(field.category)) return null;

  if (field.category !== activeCategory) {
    return { category: field.category, selectedKeys: [field.key] };
  }

  if (selectedKeys.includes(field.key)) {
    if (selectedKeys.length <= 1) return { category: activeCategory, selectedKeys };
    return {
      category: activeCategory,
      selectedKeys: selectedKeys.filter((key) => key !== field.key),
    };
  }

  return { category: activeCategory, selectedKeys: [...selectedKeys, field.key] };
}
