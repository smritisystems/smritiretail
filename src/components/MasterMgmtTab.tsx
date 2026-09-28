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

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  const [availableVendorCodes, setAvailableVendorCodes] = useState<{ code: string; name: string }[]>([]);

  // Fetch active vendor codes when in style_article so the form can optionally link to an active vendor
  useEffect(() => {
    let isMounted = true;
    const loadVendors = async () => {
      try {
        const vendors = await apiFetchV1("/masters/lookup/vendor_code/values?activeOnly=true");
        if (isMounted && Array.isArray(vendors)) {
          setAvailableVendorCodes(vendors.map((v: any) => ({ code: String(v.code), name: String(v.name) })));
        }
      } catch {
        // Vendors optional
      }
    };
    if (selectedType === "style_article") {
      loadVendors();
    }
    return () => { isMounted = false; };
  }, [selectedType]);

  const responseTransform = useCallback(
    (items: any) => mapLookupResponse(items, selectedType),
    [selectedType]
  );

  const extraHeaderActions = useCallback(
    () => (
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
    [selectedType]
  );

  const dynamicConfig = useMemo(() => {
    const typeOptions = lookupTypes.length > 0
      ? lookupTypes.map((t) => ({ label: t.label, value: t.code }))
      : masterLookupConfig.fields.find((f) => f.name === "type_code")?.options || [];

    const baseFields = masterLookupConfig.fields.map((field) =>
      field.name === "type_code"
        ? {
            ...field,
            defaultValue: selectedType,
            options: typeOptions,
            disabled: true
          }
        : field
    );

    const extraFields: any[] = [];
    if (selectedType === "color_group") {
      extraFields.push({
        name: "values",
        label: "Ordered Color Values",
        type: "textarea",
        required: true,
        placeholder: "BLACK, WHITE, RED, BLUE",
        description: "These values will be used to generate Color variants.",
        colSpan: 2,
      });
    } else if (selectedType === "style_article") {
      extraFields.push({
        name: "vendorCode",
        label: "Owning Vendor Code (Optional)",
        type: "select",
        required: false,
        options: [
          { label: "-- Global / Unassigned --", value: "" },
          ...availableVendorCodes.map((v) => ({ label: `${v.code} - ${v.name}`, value: v.code })),
        ],
        description: "Assign this style / article to an active vendor code or leave unassigned.",
        colSpan: 1,
      });
    }

    return {
      ...masterLookupConfig,
      apiEndpoint: `/masters/lookup/${selectedType}/values`,
      responseTransform,
      payloadTransform: (formData: any) => {
        const payload: Record<string, any> = {
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
        };
        if (selectedType === "style_article" && formData.vendorCode && String(formData.vendorCode).trim()) {
          payload.vendorCode = String(formData.vendorCode).trim().toUpperCase();
        }
        return payload;
      },
      fields: baseFields.concat(extraFields),
      filters: [], // Subtabs already select the type; eliminate hardcoded 5-type filter that blocked other types
      slots: {
        ...masterLookupConfig.slots,
        extraHeaderActions,
      },
      subTabs: lookupTypes.length > 0 ? lookupTypes.map((t) => ({
        id: t.code,
        label: t.code === "size_group" ? "Size Management" : t.code === "color_group" ? "Color Management" : t.label
      })) : undefined
    };
  }, [selectedType, lookupTypes, availableVendorCodes, responseTransform, extraHeaderActions]);

  const registryConfig: any = useMemo(() => {
    if (selectedType === "size_group") {
      return getMasterRegistryTypeConfig("size_group", "select");
    }
    if (selectedType === "size_group_registry") {
      return getMasterRegistryTypeConfig("size_group_registry", "manage");
    }
    if (selectedType === "color_group") {
      return getColorManagementTypeConfig();
    }
    return dynamicConfig;
  }, [selectedType, dynamicConfig]);

  const handleNotification = useCallback(
    (t: string, m: string, type?: "success" | "error" | "info" | "warning") => {
      if (onNotification) onNotification(t, m, type === "error" ? "error" : "success");
    },
    [onNotification]
  );

  const handleSubTabChange = useCallback((newType: string) => {
    setSelectedType(newType);
  }, []);

  const renderDetailDrawer = useCallback(
    (item: any, onClose: () => void, refetch: () => void) => (
      <MasterLookupDetailDrawer
        item={item}
        typeCode={selectedType}
        onClose={onClose}
        onRefetch={refetch}
      />
    ),
    [selectedType]
  );

  return (
    <>
      <MasterListScreen<any>
        config={registryConfig}
        currentUser={currentUser}
        initialSubTab={selectedType}
        onSubTabChange={handleSubTabChange}
        detailDrawer={renderDetailDrawer}
        onNotification={handleNotification}
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
