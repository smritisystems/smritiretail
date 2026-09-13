/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.1.0
 * Created      : 2026-07-10
 * Modified     : 2026-09-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : System Master Management (Global Master Screen Refactor)
 */

import React, { useState, useEffect } from "react";
import { History } from "lucide-react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { mapLookupResponse, masterLookupConfig, MasterLookupItem } from "./global/configs/masterLookup.confi.tsx";
import { MasterLookupDetailDrawer } from "./global/master/MasterLookupDetailDrawer.tsx";
import { getMasterRegistryTypeConfig } from "./masterRegistry/sizeManagement.tsx";
import { getColorManagementTypeConfig } from "./masterRegistry/colorManagement.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export interface MasterManagementTabProps {
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const MasterManagementTab: React.FC<MasterManagementTabProps> = ({
  onNotification,
  currentUser
}) => {
  const [selectedType, setSelectedType] = useState<string>("department");
  const [lookupTypes, setLookupTypes] = useState<{ code: string; label: string }[]>([]);
  const [showTypeAudit, setShowTypeAudit] = useState<boolean>(false);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await apiFetchV1("/masters/lookup-types");
        if (Array.isArray(types)) {
          const configuredTypes = types.map((t: any) => ({ code: t.code, label: t.label || t.name }));
          if (!configuredTypes.some((type) => type.code === "size_group")) {
            configuredTypes.push({ code: "size_group", label: "Size Group" });
          }
          if (!configuredTypes.some((type) => type.code === "size_group_registry")) {
            configuredTypes.push({ code: "size_group_registry", label: "Size Group Master Registry" });
          }
          if (!configuredTypes.some((type) => type.code === "color_group")) {
            configuredTypes.push({ code: "color_group", label: "Color Group" });
          }
          setLookupTypes(configuredTypes);
        }
      } catch (e) {
        console.warn("Failed to load lookup types:", e);
      }
    };
    loadTypes();
  }, []);

  const dynamicConfig = {
    ...masterLookupConfig,
    apiEndpoint: `/masters/lookup/${selectedType}/values`,
    responseTransform: (items: any) => mapLookupResponse(items, selectedType),
    payloadTransform: (formData: any) => ({
      code: String(formData.code || "").trim(),
      name: String(formData.name || "").trim(),
      active: formData.is_active !== false,
      data: {
        description: String(formData.description || "").trim(),
        ...(selectedType === "color_group" ? {
          dimension: "color",
          values: String(formData.values || "")
            .split(",")
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
        } : {}),
      },
    }),
    fields: masterLookupConfig.fields.map((field) =>
      field.name === "type_code"
        ? { ...field, defaultValue: selectedType, disabled: true }
        : field
    ).concat(selectedType === "color_group" ? [{
      name: "values",
      label: "Ordered Color Values",
      type: "textarea",
      required: true,
      placeholder: "BLACK, WHITE, RED, BLUE",
      description: "These values will be used to generate Color variants.",
      colSpan: 2,
    }] : []),
    slots: {
      ...masterLookupConfig.slots,
      extraHeaderActions: () => (
        <button
          type="button"
          onClick={() => setShowTypeAudit(true)}
          className="px-3 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary font-bold text-xs border border-theme-divider transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
          title={`View ${selectedType} Compliance Audit Trail`}
        >
          <History size={14} className="text-blue-400" />
          <span>Audit Trail</span>
        </button>
      ),
    },
    subTabs: lookupTypes.length > 0 ? lookupTypes.map((t) => ({
      id: t.code,
      label: t.code === "size_group" ? "Size Management" : t.code === "color_group" ? "Color Management" : t.label
    })) : undefined
  };

  const registryConfig: any = selectedType === "size_group"
    ? getMasterRegistryTypeConfig("size_group", "select")
    : selectedType === "size_group_registry"
      ? getMasterRegistryTypeConfig("size_group_registry", "manage")
      : selectedType === "color_group"
        ? getColorManagementTypeConfig()
    : dynamicConfig;

  return (
    <>
      <MasterListScreen<any>
        config={registryConfig}
        currentUser={currentUser}
        initialSubTab={selectedType}
        onSubTabChange={setSelectedType}
        detailDrawer={(item, onClose, refetch) => (
          <MasterLookupDetailDrawer
            item={item}
            typeCode={selectedType}
            onClose={onClose}
            onRefetch={refetch}
          />
        )}
        onNotification={(t, m, type) => {
          if (onNotification) onNotification(t, m, type === "warning" || type === "info" ? "success" : type);
        }}
      />
      {showTypeAudit && (
        <MasterLookupDetailDrawer
          item={{ id: "", code: selectedType, name: `${selectedType} Master Registry`, type_code: selectedType }}
          typeCode={selectedType}
          onClose={() => setShowTypeAudit(false)}
        />
      )}
    </>
  );
};
