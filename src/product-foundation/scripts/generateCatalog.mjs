import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const foundationRoot = path.join(repoRoot, 'src/product-foundation');

const moduleNames = ['commerce', 'inventory', 'finance', 'workflow', 'document', 'intelligence'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const modules = moduleNames.map((moduleName) => {
  const moduleDir = path.join(foundationRoot, moduleName);
  const capabilityDirs = fs.readdirSync(moduleDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entryName) => fs.existsSync(path.join(moduleDir, entryName, 'manifest.json')));

  const capabilities = capabilityDirs.map((capabilityName) => {
    const manifest = readJson(path.join(moduleDir, capabilityName, 'manifest.json'));
    const dependencies = Array.isArray(manifest.dependencies)
      ? { runtime: manifest.dependencies, business: [], optional: [] }
      : manifest.dependencies ?? { runtime: manifest.dependsOn ?? [], business: [], optional: [] };

    return {
      name: capabilityName,
      type: 'capability',
      id: manifest.id,
      maturity: manifest.maturity,
      owner: manifest.owner,
      studios: manifest.studios,
      version: manifest.version,
      releaseRing: manifest.releaseRing,
      dependencies,
      dependsOn: manifest.dependsOn ?? dependencies.runtime,
      consumedBy: manifest.consumedBy ?? [],
      provides: manifest.provides ?? [],
      events: manifest.events ?? { publishes: [], subscribes: [], lifecycle: {} },
    };
  });

  return {
    name: moduleName,
    owner: capabilities[0]?.owner ?? `${moduleName} Foundation`,
    capabilities,
  };
});

const catalog = {
  version: '1.1',
  status: 'active',
  generatedAt: new Date().toISOString(),
  modules,
};

fs.writeFileSync(path.join(foundationRoot, 'CAPABILITY_CATALOG.json'), JSON.stringify(catalog, null, 2));
console.log('Generated capability catalog');
