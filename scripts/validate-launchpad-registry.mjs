import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(scriptDirectory, "..");
const catalogPath = path.join(projectRoot, "src", "components", "launchpad", "launchpadCatalog.ts");
const appPath = path.join(projectRoot, "src", "App.tsx");
const tabRendererPath = path.join(projectRoot, "src", "components", "shell", "TabRenderer.tsx");

const catalogSource = fs.readFileSync(catalogPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8") + "\n" + (fs.existsSync(tabRendererPath) ? fs.readFileSync(tabRendererPath, "utf8") : "");

const catalogIds = [...catalogSource.matchAll(/\bid:\s*["']([^"']+)["']/g)].map((match) => match[1]);
const renderCaseIds = new Set(
  [...appSource.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map((match) => match[1]),
);

const duplicateIds = catalogIds.filter((id, index) => catalogIds.indexOf(id) !== index);
const missingRenderCases = [...new Set(catalogIds)].filter((id) => !renderCaseIds.has(id));
const appRoutesWithoutTiles = [...renderCaseIds]
  .filter((id) => !catalogIds.includes(id))
  .sort();

console.log("Launchpad Registry Validation\n");
console.log(`Catalog tiles: ${catalogIds.length}`);
console.log(`Unique tile IDs: ${new Set(catalogIds).size}`);
console.log(`App render cases: ${renderCaseIds.size}`);

if (duplicateIds.length > 0) {
  console.error(`\nDuplicate Launchpad tile IDs: ${[...new Set(duplicateIds)].join(", ")}`);
}

if (missingRenderCases.length > 0) {
  console.error("\nLaunchpad tiles without an App render case:");
  for (const id of missingRenderCases) {
    console.error(`- ${id}: add a case in src/App.tsx or document it as an intentional external route`);
  }
}

if (appRoutesWithoutTiles.length > 0) {
  console.log("\nReview: App routes without Launchpad tiles (aliases or hidden workspaces may be intentional):");
  for (const id of appRoutesWithoutTiles) {
    console.log(`- ${id}`);
  }
}

if (duplicateIds.length > 0 || missingRenderCases.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nPASSED: every Launchpad tile has a unique ID and an App render case.");
}