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

import { parseCodebase } from "./parser.ts";
import { computeMetrics } from "./metrics.ts";
import { writeReports } from "./reporter.ts";
import { ScanResult } from "../models/interfaces.ts";

export function runScanner(): ScanResult {
  console.log("[SDIC Scanner] Beginning SMRITI Development Intelligence Center scan...");
  
  // 1. AST/Regex parse codebase
  const parsed = parseCodebase();
  
  // 2. Compute Health Index (DHI), scores, and git metadata
  const results = computeMetrics(parsed);
  
  // 3. Output markdown reports & history logs
  writeReports(results);
  
  console.log(`[SDIC Scanner] Scan complete. SMRITI DHI Score: ${results.releaseScores.dhi}% (Grade ${results.releaseScores.grade}).`);
  
  return results;
}
