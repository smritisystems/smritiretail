/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.5)
 * Description  : Versioned Evidence Graph Cache & Incremental Change Detector (SHA-256)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { EvidenceItem } from "../../models/interfaces.ts";
import { EvidenceGraphContainer } from "./EvidenceGraph.ts";

export interface FileCacheEntry {
  sha256: string;
  evidenceItems: EvidenceItem[];
}

export interface PersistentCacheSchema {
  version: string;
  scannerVersion: string;
  evidenceSchema: string;
  generatedAt: string;
  adapters: Record<string, string>;
  files: Record<string, FileCacheEntry>;
}

export class EvidenceCacheManager {
  private cachePath: string;
  private cacheVersion = "2.5.0";
  private currentSchema = "v2";

  constructor() {
    const rootDir = process.cwd();
    const cacheDir = path.join(rootDir, "docs", "reports", ".cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cachePath = path.join(cacheDir, "evidence_cache.json");
  }

  public computeSHA256(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  public loadCache(): PersistentCacheSchema | null {
    try {
      if (!fs.existsSync(this.cachePath)) return null;
      const raw = fs.readFileSync(this.cachePath, "utf8");
      const cache: PersistentCacheSchema = JSON.parse(raw);

      // Validate cache version compatibility
      if (cache.version !== this.cacheVersion || cache.evidenceSchema !== this.currentSchema) {
        console.log("[SDIC Cache] Cache version mismatch or invalidated. Performing full rescan.");
        return null;
      }
      return cache;
    } catch (e) {
      console.warn("[SDIC Cache] Failed to load cache file. Performing full rescan.");
      return null;
    }
  }

  public saveCache(
    fileContentsMap: Map<string, string>,
    evidenceGraph: EvidenceGraphContainer,
    adapters: Record<string, string>
  ): void {
    try {
      const files: Record<string, FileCacheEntry> = {};

      for (const [filePath, content] of fileContentsMap.entries()) {
        const sha256 = this.computeSHA256(content);
        const evidenceItems = evidenceGraph.allEvidence.filter(e => e.file === filePath);
        files[filePath] = {
          sha256,
          evidenceItems
        };
      }

      const cache: PersistentCacheSchema = {
        version: this.cacheVersion,
        scannerVersion: "SDS v2.5.0",
        evidenceSchema: this.currentSchema,
        generatedAt: new Date().toISOString(),
        adapters,
        files
      };

      fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
      console.error("[SDIC Cache] Failed to write cache file:", e);
    }
  }

  public detectFileChanges(
    currentFileContentsMap: Map<string, string>,
    cached: PersistentCacheSchema
  ): { added: string[]; modified: string[]; deleted: string[]; unchanged: string[] } {
    const added: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];
    const cachedFiles = new Set(Object.keys(cached.files));
    const currentFiles = new Set(currentFileContentsMap.keys());

    for (const [filePath, content] of currentFileContentsMap.entries()) {
      if (!cachedFiles.has(filePath)) {
        added.push(filePath);
      } else {
        const currentHash = this.computeSHA256(content);
        if (cached.files[filePath].sha256 !== currentHash) {
          modified.push(filePath);
        } else {
          unchanged.push(filePath);
        }
      }
    }

    const deleted: string[] = [];
    for (const cachedFile of cachedFiles) {
      if (!currentFiles.has(cachedFile)) {
        deleted.push(cachedFile);
      }
    }

    return { added, modified, deleted, unchanged };
  }
}
