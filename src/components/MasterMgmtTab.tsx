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

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { History, Upload, Sparkles } from "lucide-react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { mapLookupResponse, masterLookupConfig, MasterLookupItem } from "./global/configs/masterLookup.confi.tsx";
import { MasterLookupDetailDrawer } from "./global/master/MasterLookupDetailDrawer.tsx";
import { getMasterRegistryTypeConfig } from "./masterRegistry/sizeManagement.tsx";
import { getColorManagementTypeConfig } from "./masterRegistry/colorManagement.tsx";
import { GlobalGridImportModal } from "./gridInput/GlobalGridImportModal.tsx";
import { LookupRecommendModal } from "./global/master/LookupRecommendModal.tsx";
import { StandardLookupPreset } from "./global/master/lookupStandardPresets.ts";
import { ParsedGridRow, GridImportMode } from "../services/gridInput/types.ts";
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
  const [showGridImport, setShowGridImport] = useState<boolean>(false);
  const [showRecommendModal, setShowRecommendModal] = useState<boolean>(false);
  const [currentTableItems, setCurrentTableItems] = useState<any[]>([]);
  const refetchItemsRef = useRef<() => void>(() => {});

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

  const selectedTypeLabel = useMemo(() => {
    return lookupTypes.find((t) => t.code === selectedType)?.label || selectedType;
  }, [lookupTypes, selectedType]);

  const responseTransform = useCallback(
    (items: any) => mapLookupResponse(items, selectedType),
    [selectedType]
  );

  const extraHeaderActions = useCallback(
    (refetch: () => void, items: any[]) => {
      if (refetch) refetchItemsRef.current = refetch;
      if (Array.isArray(items)) {
        setCurrentTableItems(items);
      }
      return (
        <div className="flex items-center space-x-1.5">
          {/* Import CSV / Excel Clipboard Paste */}
          <button
            type="button"
            onClick={() => setShowGridImport(true)}
            className="px-3 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary font-bold text-xs border border-theme-divider transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
            title={`Import CSV or paste Excel rows into ${selectedTypeLabel}`}
          >
            <Upload size={14} className="text-emerald-400" />
            <span>Import / Paste</span>
          </button>

          {/* Recommend Standard Presets */}
          <button
            type="button"
            onClick={() => setShowRecommendModal(true)}
            className="px-3 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary font-bold text-xs border border-theme-divider transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
            title={`Preview and ingest industry standard ${selectedTypeLabel} values`}
          >
            <Sparkles size={14} className="text-amber-400" />
            <span>Recommend Standards</span>
          </button>

          {/* Compliance Audit Trail */}
          <button
            type="button"
            onClick={() => setShowTypeAudit(true)}
            className="px-3 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary font-bold text-xs border border-theme-divider transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
            title={`View ${selectedType} Compliance Audit Trail`}
          >
            <History size={14} className="text-blue-400" />
            <span>Audit Trail</span>
          </button>
        </div>
      );
    },
    [selectedType, selectedTypeLabel]
  );

  const persistLookupValues = useCallback(
    async (itemsToSave: any[], _sourceDescription: string) => {
      if (!itemsToSave || itemsToSave.length === 0) return;

      let createdCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      try {
        const bulkPayload = {
          items: itemsToSave.map((item) => ({
            code: String(item.code || "").trim().toUpperCase(),
            name: String(item.name || item.code || "").trim(),
            active: item.active !== false,
            vendorCode: item.vendorCode ? String(item.vendorCode).trim().toUpperCase() : undefined,
            data: item.data || {
              description: String(item.description || "").trim(),
              ...(item.values
                ? {
                    values: Array.isArray(item.values)
                      ? item.values
                      : String(item.values)
                          .split(",")
                          .map((s: string) => s.trim().toUpperCase())
                          .filter(Boolean),
                  }
                : {}),
            },
          })),
          skip_existing: true,
        };

        const res = await apiFetchV1(`/masters/lookup/${selectedType}/bulk-values`, {
          method: "POST",
          body: JSON.stringify(bulkPayload),
        });

        if (res && typeof res.created === "number") {
          createdCount = res.created;
          skippedCount = res.skipped || 0;
        } else {
          createdCount = itemsToSave.length;
        }
      } catch (bulkErr) {
        console.warn("Bulk endpoint failed, falling back to sequential create:", bulkErr);
        // Fallback: sequential single creation
        for (const item of itemsToSave) {
          try {
            const singlePayload = {
              code: String(item.code || "").trim().toUpperCase(),
              name: String(item.name || item.code || "").trim(),
              active: item.active !== false,
              ...(selectedType === "style_article" && item.vendorCode
                ? { vendorCode: String(item.vendorCode).trim().toUpperCase() }
                : {}),
              data: item.data || {
                description: String(item.description || "").trim(),
                ...(item.values
                  ? {
                      values: Array.isArray(item.values)
                        ? item.values
                        : String(item.values)
                            .split(",")
                            .map((s: string) => s.trim().toUpperCase())
                            .filter(Boolean),
                    }
                  : {}),
              },
            };
            await apiFetchV1(`/masters/lookup/${selectedType}/values`, {
              method: "POST",
              body: JSON.stringify(singlePayload),
            });
            createdCount++;
          } catch (singleErr: any) {
            const msg = String(singleErr?.message || singleErr?.detail || "");
            if (msg.includes("already exists")) {
              skippedCount++;
            } else {
              errorCount++;
            }
          }
        }
      }

      if (createdCount > 0) {
        onNotification?.(
          "Master Values Ingested",
          `Successfully registered ${createdCount} lookup value(s) into ${selectedTypeLabel}${
            skippedCount > 0 ? ` (${skippedCount} existing skipped)` : ""
          }.`,
          "success"
        );
      } else if (skippedCount > 0 && errorCount === 0) {
        onNotification?.(
          "No New Records",
          `All ${skippedCount} items already exist in ${selectedTypeLabel}.`,
          "info" as any
        );
      } else if (errorCount > 0) {
        onNotification?.(
          "Ingestion Errors",
          `Failed to ingest ${errorCount} records into ${selectedTypeLabel}.`,
          "error"
        );
      }

      refetchItemsRef.current?.();
    },
    [selectedType, selectedTypeLabel, onNotification]
  );

  const handleGridImportCommit = useCallback(
    async (rows: ParsedGridRow[], _mode: GridImportMode) => {
      const items = rows
        .map((r) => {
          const code = String(r.mappedValues?.code || r.rawValues?.code || r.identifier || "").trim();
          const name = String(r.mappedValues?.name || r.rawValues?.name || code).trim();
          const description = String(r.mappedValues?.description || r.rawValues?.description || "").trim();
          const active = r.mappedValues?.active !== undefined ? Boolean(r.mappedValues.active) : true;
          const vendorCode = r.mappedValues?.vendorCode || r.rawValues?.vendorCode || undefined;
          const values = r.mappedValues?.values || r.rawValues?.values || undefined;

          return {
            code,
            name,
            description,
            active,
            vendorCode,
            values,
            data: {
              description,
              ...(values
                ? {
                    values: Array.isArray(values)
                      ? values
                      : String(values)
                          .split(",")
                          .map((s: string) => s.trim().toUpperCase())
                          .filter(Boolean),
                  }
                : {}),
            },
          };
        })
        .filter((i) => Boolean(i.code));

      setShowGridImport(false);
      await persistLookupValues(items, "Grid Import / Paste");
    },
    [persistLookupValues]
  );

  const handleRecommendCommit = useCallback(
    async (selectedPresets: StandardLookupPreset[]) => {
      setShowRecommendModal(false);
      await persistLookupValues(selectedPresets, "Standard Presets");
    },
    [persistLookupValues]
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
    let base: any = dynamicConfig;
    if (selectedType === "size_group") {
      base = getMasterRegistryTypeConfig("size_group", "select");
    } else if (selectedType === "size_group_registry") {
      base = getMasterRegistryTypeConfig("size_group_registry", "manage");
    } else if (selectedType === "color_group") {
      base = getColorManagementTypeConfig();
    }
    return {
      ...base,
      slots: {
        ...base.slots,
        extraHeaderActions,
      },
    };
  }, [selectedType, dynamicConfig, extraHeaderActions]);

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
      {showGridImport && (
        <GlobalGridImportModal
          isOpen={showGridImport}
          onClose={() => setShowGridImport(false)}
          profile="LOOKUP_VALUE"
          title={`Bulk Import & Paste: ${selectedTypeLabel}`}
          onCommit={handleGridImportCommit}
        />
      )}
      {showRecommendModal && (
        <LookupRecommendModal
          isOpen={showRecommendModal}
          onClose={() => setShowRecommendModal(false)}
          typeCode={selectedType}
          typeLabel={selectedTypeLabel}
          existingItems={currentTableItems}
          onCommit={handleRecommendCommit}
        />
      )}
    </>
  );
};
