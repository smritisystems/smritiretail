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
 * Target UI    : Commercial & Statutory Terms Engine (Global Master Screen Refactor)
 */

import React, { useMemo } from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { termsEngineConfig, Clause } from "./global/configs/termsEngine.config.tsx";

export const TermsEngineTab: React.FC = () => {
  const memoizedConfig = useMemo(() => termsEngineConfig, []);

  return (
    <div
      role="region"
      aria-label="Commercial and Statutory Terms Engine"
      title="Commercial & Statutory Terms Engine (en-IN Locale & Currency Compliant)"
      className="w-full h-full sm:px-2 md:px-4 space-y-4"
    >
      <MasterListScreen<Clause>
        config={memoizedConfig}
      />
    </div>
  );
};
