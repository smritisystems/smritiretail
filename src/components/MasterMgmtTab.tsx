/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : System Master Management (Global Master Screen Refactor)
 */

import React, { useState, useEffect } from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { masterLookupConfig, MasterLookupItem } from "./global/configs/masterLookup.config.tsx";
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

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await apiFetchV1("/masters/lookup-types");
        if (Array.isArray(types)) {
          setLookupTypes(types.map((t: any) => ({ code: t.code, label: t.label || t.name })));
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
    subTabs: lookupTypes.length > 0 ? lookupTypes.map((t) => ({
      id: t.code,
      label: t.label
    })) : undefined
  };

  return (
    <MasterListScreen<MasterLookupItem>
      config={dynamicConfig}
      currentUser={currentUser}
      onNotification={(t, m, type) => {
        if (onNotification) onNotification(t, m, type === "warning" || type === "info" ? "success" : type);
      }}
    />
  );
};
