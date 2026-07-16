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

import fs from "fs";
import path from "path";

// Helper to recursively list all files matching extensions
export function getFilesRecursively(dir: string, extensions: string[] = [".ts", ".tsx", ".js", ".jsx", ".css", ".sql", ".md", ".json"]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== ".git" && file !== ".gemini" && file !== ".agents") {
        results = results.concat(getFilesRecursively(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

export interface ParsedCodebase {
  filesList: string[];
  todosCount: number;
  fixmesCount: number;
  hacksCount: number;
  largeComponents: string[];
  routesInServer: string[];
  fetchedRoutesInFrontend: string[];
  tablesInDb: string[];
  testFiles: string[];
  docFiles: string[];
  fileContentsMap: Map<string, string>;
  componentImports: Map<string, string[]>;
}

export function parseCodebase(): ParsedCodebase {
  const rootDir = process.cwd();
  
  // Recursively read all files in workspace
  const allFiles = getFilesRecursively(rootDir);
  
  const fileContentsMap = new Map<string, string>();
  let todosCount = 0;
  let fixmesCount = 0;
  let hacksCount = 0;
  const largeComponents: string[] = [];
  const componentImports = new Map<string, string[]>();
  
  const testFiles: string[] = [];
  const docFiles: string[] = [];
  
  // Scanned routes
  const routesInServer: string[] = [];
  const fetchedRoutesInFrontend: string[] = [];
  const tablesInDb: string[] = [];

  for (const filePath of allFiles) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    
    // Categorize test and doc files
    if (relPath.startsWith("src/tests/") || relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx")) {
      testFiles.push(relPath);
    }
    if (relPath.startsWith("docs/") && relPath.endsWith(".md")) {
      docFiles.push(relPath);
    }

    try {
      const content = fs.readFileSync(filePath, "utf8");
      fileContentsMap.set(relPath, content);

      // 1. Count TODO, FIXME, HACK
      const todoMatches = content.match(/\bTODO\b/ig);
      const fixmeMatches = content.match(/\bFIXME\b/ig);
      const hackMatches = content.match(/\bHACK\b/ig);
      
      if (todoMatches) todosCount += todoMatches.length;
      if (fixmeMatches) fixmesCount += fixmeMatches.length;
      if (hackMatches) hacksCount += hackMatches.length;

      // 2. Large Component Check (> 500 lines)
      if (relPath.startsWith("src/components/") && (relPath.endsWith(".tsx") || relPath.endsWith(".ts"))) {
        const lineCount = content.split("\n").length;
        if (lineCount > 500) {
          largeComponents.push(`${relPath} (${lineCount} lines)`);
        }

        // 3. Scan Imports for Unused/Dead File Analysis
        const importRegex = /import\s+.*?\s+from\s+["'](\.\.?\/.*?)["']/g;
        let match;
        const imports: string[] = [];
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        if (imports.length > 0) {
          componentImports.set(relPath, imports);
        }
      }

      // 4. Parse server.ts routes
      if (relPath === "server.ts") {
        const routeRegex = /app\.(get|post|put|delete)\(\s*["'](\/api\/.*?)["']/g;
        let match;
        while ((match = routeRegex.exec(content)) !== null) {
          if (!routesInServer.includes(match[2])) {
            routesInServer.push(match[2]);
          }
        }
      }

      // 5. Parse frontend fetched routes
      if (relPath.startsWith("src/") && (relPath.endsWith(".tsx") || relPath.endsWith(".ts")) && relPath !== "server.ts") {
        const fetchRegex = /fetch\(\s*["'](\/api\/.*?)["']/g;
        let match;
        while ((match = fetchRegex.exec(content)) !== null) {
          if (!fetchedRoutesInFrontend.includes(match[1])) {
            fetchedRoutesInFrontend.push(match[1]);
          }
        }
      }

      // 6. Parse Database tables from schema.sql
      if (relPath === "src/db/schema.sql" || relPath === "server.ts") {
        const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
        let match;
        while ((match = tableRegex.exec(content)) !== null) {
          const tableName = match[1].toLowerCase();
          if (!tablesInDb.includes(tableName)) {
            tablesInDb.push(tableName);
          }
        }
      }

    } catch (e) {
      console.error(`[SDIC Scanner] Failed to parse file ${relPath}:`, e);
    }
  }

  return {
    filesList: allFiles.map(f => path.relative(rootDir, f).replace(/\\/g, "/")),
    todosCount,
    fixmesCount,
    hacksCount,
    largeComponents,
    routesInServer,
    fetchedRoutesInFrontend,
    tablesInDb,
    testFiles,
    docFiles,
    fileContentsMap,
    componentImports
  };
}
