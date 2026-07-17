/**
 * SMRITI Retail OS — frontend/shared architecture contracts
 * Run: `npx depcruise src --config .dependency-cruiser.js --ts-config tsconfig.json`
 *
 * Companion to .importlinter (backend). See
 * SMRITI_Cross_Module_Validation_Audit_v1.0.md Section 1.2/10.
 *
 * This repo has a specific structural risk import-linter can't see:
 * src/components (browser, bundled by Vite) and src/routes (Node-only,
 * Express, used by server.ts) live under the SAME tsconfig
 * (`include: ["src", "server.ts", "vite.config.ts"]`, confirmed).
 * Nothing currently stops a component from importing server-side code —
 * if that ever happens, at best it's a broken build, at worst it's
 * server secrets/DB access code shipped into the browser bundle.
 */

module.exports = {
  forbidden: [
    {
      name: "no-browser-importing-server-code",
      comment:
        "src/components (browser, Vite-bundled) must never import from " +
        "src/routes (Node-only, Express). Verified as a real structural " +
        "risk, not a hypothetical one — both trees share one tsconfig.",
      severity: "error",
      from: { path: "^src/components" },
      to: { path: "^src/routes" },
    },
    {
      name: "no-browser-importing-server-state",
      comment:
        "Same reasoning for src/state and src/db — server-side stores " +
        "and Postgres/Memory repositories should never reach the browser bundle.",
      severity: "error",
      from: { path: "^src/components" },
      to: { path: "^src/(state|db)/" },
    },
    {
      name: "no-circular",
      comment:
        "Circular imports are a real integration bug, not a style " +
        "preference — dependency-cruiser's built-in detector.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "Files nothing imports. This is the automated version of the " +
        "'built but unwired' pattern already found three times by hand " +
        "in this codebase (master_entities, the FastAPI Sales/Purchase/POS " +
        "layer, GET /api/v1/auth/tenants) — Section 1.3 of the audit " +
        "directive. A hit here doesn't mean delete the file; it means " +
        "add a finding to that module's report and let a human decide.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "\\.config\\.(js|ts)$",
          "^src/vite-env\\.d\\.ts$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
