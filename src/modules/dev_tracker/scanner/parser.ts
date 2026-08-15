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
const EXCLUDED_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".gemini", ".agents",
  "backups", "coverage", "exports", "scratch", ".venv", "venv"
]);

// Helper to recursively list all files matching extensions
export function getFilesRecursively(dir: string, extensions: string[] = [".ts", ".tsx", ".js", ".jsx", ".css", ".sql", ".md", ".json", ".py"]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!EXCLUDED_DIRS.has(file)) {
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
    
    // Categorize test and doc files (both TS Vitest and Python Pytest)
    if (
      relPath.startsWith("src/tests/") ||
      relPath.startsWith("backend/tests/") ||
      relPath.includes("/tests/") ||
      relPath.endsWith(".test.ts") ||
      relPath.endsWith(".test.tsx") ||
      relPath.endsWith("_test.py") ||
      path.basename(relPath).startsWith("test_")
    ) {
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

      // 4. Parse backend API routes (FastAPI + legacy server.ts)
      if (relPath.startsWith("backend/app/api/") || relPath === "server.ts") {
        // FastAPI @router or @app route decorator parser
        const fastapiRouteRegex = /@(router|app)\.(get|post|put|delete|patch)\(\s*["'](\/.*?)["']/g;
        let match;
        while ((match = fastapiRouteRegex.exec(content)) !== null) {
          const routePath = match[3];
          const fullRoute = routePath.startsWith("/api/") ? routePath : `/api/v1${routePath.startsWith("/") ? "" : "/"}${routePath}`;
          if (!routesInServer.includes(fullRoute)) {
            routesInServer.push(fullRoute);
          }
          if (!routesInServer.includes(routePath)) {
            routesInServer.push(routePath);
          }
        }

        // Express app.get/post/put/delete parser
        const expressRouteRegex = /app\.(get|post|put|delete)\(\s*["'](\/api\/.*?)["']/g;
        while ((match = expressRouteRegex.exec(content)) !== null) {
          if (!routesInServer.includes(match[2])) {
            routesInServer.push(match[2]);
          }
        }
      }

      // 5. Parse frontend fetched routes (apiFetchV1, apiFetch, and fetch)
      if (relPath.startsWith("src/") && (relPath.endsWith(".tsx") || relPath.endsWith(".ts")) && relPath !== "server.ts") {
        const apiFetchRegex = /(?:apiFetchV1|apiFetch|fetch)\(\s*["'](\/.*?)["']/g;
        let match;
        while ((match = apiFetchRegex.exec(content)) !== null) {
          const fetchPath = match[1];
          const fullFetch = fetchPath.startsWith("/api/") ? fetchPath : `/api/v1${fetchPath.startsWith("/") ? "" : "/"}${fetchPath}`;
          if (!fetchedRoutesInFrontend.includes(fullFetch)) {
            fetchedRoutesInFrontend.push(fullFetch);
          }
          if (!fetchedRoutesInFrontend.includes(fetchPath)) {
            fetchedRoutesInFrontend.push(fetchPath);
          }
        }
      }

      // 6. Parse Database tables (SQLAlchemy models in backend/app/models + legacy schema.sql)
      if (relPath.startsWith("backend/app/models/") || relPath === "src/db/schema.sql" || relPath === "server.ts") {
        // SQLAlchemy __tablename__ = "table_name"
        const sqlalchemyTableRegex = /__tablename__\s*=\s*["'](\w+)["']/g;
        let match;
        while ((match = sqlalchemyTableRegex.exec(content)) !== null) {
          const tableName = match[1].toLowerCase();
          if (!tablesInDb.includes(tableName)) {
            tablesInDb.push(tableName);
          }
        }

        // CREATE TABLE regex fallback
        const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
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
