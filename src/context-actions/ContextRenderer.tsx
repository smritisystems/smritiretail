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

import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useACAS } from "./ContextProvider.tsx";
import { ContextBottomSheet } from "./ContextBottomSheet.tsx";
import { ContextPopover } from "./ContextPopover.tsx";

export const ContextRenderer: React.FC = () => {
  const { state, closeMenu } = useACAS();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Run on initial mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {isMobile ? (
            <ContextBottomSheet onClose={closeMenu} />
          ) : (
            <ContextPopover onClose={closeMenu} />
          )}
        </>
      )}
    </AnimatePresence>
  );
};
export default ContextRenderer;
