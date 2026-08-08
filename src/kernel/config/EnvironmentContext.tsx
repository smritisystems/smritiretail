/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Environment Context Provider (Rule PROD-004 / PROD-005 Authority)
 * Standard     : Single Authoritative Environment Context State Provider
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 4.1.0
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { EnvironmentInfo, EnvironmentResolver } from "./EnvironmentResolver.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

interface EnvironmentContextValue {
  envInfo: EnvironmentInfo;
  isLoading: boolean;
  refreshEnvironment: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
  envInfo: EnvironmentResolver.unresolved(),
  isLoading: true,
  refreshEnvironment: async () => {},
});

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo>(() => EnvironmentResolver.unresolved());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshEnvironment = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchV1<{ environment_type?: string; database_name?: string }>("admin/environment/profile");
      if (res && res.environment_type) {
        const resolved = EnvironmentResolver.resolve({
          backendEnvType: res.environment_type,
          backendDbName: res.database_name,
        });
        setEnvInfo(resolved);
      } else {
        setEnvInfo(EnvironmentResolver.resolve());
      }
    } catch {
      // Unauthenticated / pre-login or backend unreachable: fallback to client resolution
      setEnvInfo(EnvironmentResolver.resolve());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshEnvironment();
  }, []);

  return (
    <EnvironmentContext.Provider value={{ envInfo, isLoading, refreshEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironmentContext = (): EnvironmentContextValue => {
  return useContext(EnvironmentContext);
};
