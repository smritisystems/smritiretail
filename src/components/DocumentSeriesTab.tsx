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
 * Target UI    : Document Series Studio (Global Master Screen Refactor)
 */

import React, { useMemo } from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { documentSeriesConfig } from "./global/configs/documentSeries.con.tsx";
import { DocumentSeries } from "../services/numberingEngine.ts";

export const DocumentSeriesTab: React.FC = () => {
  const memoizedConfig = useMemo(() => documentSeriesConfig, []);

  return (
    <div
      role="region"
      aria-label="Enterprise Document Numbering Engine"
      title="Enterprise Document Numbering Engine (en-IN Locale & Currency Compliant)"
      className="w-full h-full sm:px-2 md:px-4 space-y-4"
    >
      <MasterListScreen<DocumentSeries>
        config={memoizedConfig}
      />
    </div>
  );
};
