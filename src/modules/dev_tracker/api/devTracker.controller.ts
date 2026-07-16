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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { Request, Response } from "express";
import { runScanner } from "../scanner/scanner.ts";
import { ScanResult } from "../models/interfaces.ts";

let cachedResults: ScanResult | null = null;

// GET /api/dev-tracker
export const getScanResults = (req: Request, res: Response) => {
  try {
    if (!cachedResults) {
      cachedResults = runScanner();
    }
    res.json(cachedResults);
  } catch (error: any) {
    console.error("[SDIC Controller] Error reading scan cache:", error);
    res.status(500).json({ error: "Failed to load development status." });
  }
};

// POST /api/dev-tracker/scan
export const triggerScan = (req: Request, res: Response) => {
  try {
    cachedResults = runScanner();
    res.json(cachedResults);
  } catch (error: any) {
    console.error("[SDIC Controller] Error executing on-demand scan:", error);
    res.status(500).json({ error: "Failed to execute codebase re-scan." });
  }
};
