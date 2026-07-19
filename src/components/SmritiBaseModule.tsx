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

import React, { useEffect } from "react";
import { MetadataRegistry, ModuleMetadata } from "../services/metadataRegistry.ts";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";

/**
 * A hook that automatically syncs LayoutManager's registered workspaces
 * to the centralized MetadataRegistry.
 */
export const useLayoutModuleRegistration = () => {
  const { registeredWorkspaces } = useLayoutEngine();
  
  useEffect(() => {
    registeredWorkspaces.forEach((ws) => {
      // Create a normalized module definition from the layout workspace
      const moduleMeta: ModuleMetadata = {
        id: ws.id,
        name: ws.label,
        version: "v1.0",
        owner: "System Auto-Registered",
        description: `Module in category: ${ws.category}`,
        dependencies: ["Core System"],
      };
      
      MetadataRegistry.registerModule(moduleMeta);
    });
  }, [registeredWorkspaces]);
};

/**
 * A base component wrapper that explicitly registers a module's metadata,
 * useful for modules that need to supply more detailed metadata (like version, owner)
 * than what's available in the LayoutManager workspace registration.
 */
export interface SmritiBaseModuleProps {
  children: React.ReactNode;
  metadata?: Partial<ModuleMetadata> & { id: string; name: string };
}

export const SmritiBaseModule: React.FC<SmritiBaseModuleProps> = ({ children, metadata }) => {
  useEffect(() => {
    if (metadata) {
      MetadataRegistry.registerModule({
        version: "v1.0",
        owner: "SMRITI Core",
        description: `${metadata.name} module`,
        dependencies: ["Core System"],
        ...metadata,
      });
    }
  }, [metadata]);
  
  return <>{children}</>;
};
