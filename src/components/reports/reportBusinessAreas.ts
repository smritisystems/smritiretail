export const REPORT_BUSINESS_AREAS = [
  {
    id: 'all_reports',
    label: 'All Reports',
    icon: 'summarize',
    studioIds: [
      'sales_studio',
      'inventory_studio',
      'purchase_studio',
      'finance_studio',
      'profitability_studio',
      'tax_studio',
      'mis_studio',
      'crm_studio',
      'merchandise_studio',
      'operations_studio',
      'accounting_studio',
    ],
  },
  {
    id: 'sales_studio',
    label: 'Sales',
    icon: 'point_of_sale',
    studioIds: ['sales_studio'],
  },
  {
    id: 'inventory_studio',
    label: 'Inventory & Stock',
    icon: 'inventory_2',
    studioIds: ['inventory_studio', 'merchandise_studio'],
  },
  {
    id: 'purchase_studio',
    label: 'Purchase',
    icon: 'shopping_cart',
    studioIds: ['purchase_studio'],
  },
  {
    id: 'finance_studio',
    label: 'Finance & Accounts',
    icon: 'account_balance',
    studioIds: ['finance_studio', 'profitability_studio', 'accounting_studio'],
  },
  {
    id: 'tax_studio',
    label: 'Tax & Compliance',
    icon: 'verified',
    studioIds: ['tax_studio'],
  },
  {
    id: 'crm_studio',
    label: 'Customers',
    icon: 'groups',
    studioIds: ['crm_studio'],
  },
  {
    id: 'operations_studio',
    label: 'Operations',
    icon: 'settings',
    studioIds: ['operations_studio'],
  },
  {
    id: 'mis_studio',
    label: 'Management & Analytics',
    icon: 'analytics',
    studioIds: ['mis_studio'],
  },
] as const;

const LEGACY_STUDIO_AREA_IDS: Record<string, string> = {
  merchandise_studio: 'inventory_studio',
  profitability_studio: 'finance_studio',
  accounting_studio: 'finance_studio',
};

export function resolveReportBusinessArea(areaId: string) {
  const resolvedId = LEGACY_STUDIO_AREA_IDS[areaId] || areaId;
  return REPORT_BUSINESS_AREAS.find((area) => area.id === resolvedId);
}
