/*
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
*/

/**
 * Project      : SMRITI Business Application Platform (SWSDK v1.0)
 * Module       : SWSDK Workspace Generator CLI Script (Rule SWSDK-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const workspaceId = args[0] || "sales.invoice";

const parts = workspaceId.split(".");
const moduleName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Sales";
const featureName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Invoice";
const className = `${moduleName}${featureName}`;

const targetDir = path.join(process.cwd(), "src", "workspaces", workspaceId);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. workspace.ts
fs.writeFileSync(
  path.join(targetDir, "workspace.ts"),
`import { WorkspaceManifest } from "../../sdk/swsdk/manifests/workspace.js";

export const workspaceManifest: WorkspaceManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  title: "${moduleName} ${featureName}",
  module: "${moduleName}",
  icon: "receipt",
  route: "/${parts[0]}/${parts[1] || 'default'}",
  category: "Transactions",
  supports: {
    drafts: true,
    resume: true,
    tabs: true,
    attachments: true,
    workflow: true,
    timeline: true,
    print: true,
    export: true,
    analytics: true,
    barcode: true,
    notifications: true
  }
};
`
);

// 2. actions.ts
fs.writeFileSync(
  path.join(targetDir, "actions.ts"),
`import { ActionManifest } from "../../sdk/swsdk/manifests/actions.js";

export const actionManifest: ActionManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  actions: [
    { id: "save", label: "Save", priority: "primary", permissionRequired: "edit", shortcut: "Ctrl+S" },
    { id: "print", label: "Print", priority: "secondary", permissionRequired: "print", shortcut: "Ctrl+P" },
    { id: "export", label: "Export", priority: "overflow", permissionRequired: "export" }
  ]
};
`
);

// 3. capabilities.ts
fs.writeFileSync(
  path.join(targetDir, "capabilities.ts"),
`import { CapabilityManifest } from "../../sdk/swsdk/manifests/capabilities.js";

export const capabilityManifest: CapabilityManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  capabilities: ["draft", "resume", "printing", "workflow", "timeline", "audit"]
};
`
);

// 4. permissions.ts
fs.writeFileSync(
  path.join(targetDir, "permissions.ts"),
`import { PermissionManifest } from "../../sdk/swsdk/manifests/permissions.js";

export const permissionManifest: PermissionManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  permissions: [
    { action: "view", code: "${moduleName.toUpperCase()}.${featureName.toUpperCase()}.VIEW", description: "View ${className}" },
    { action: "create", code: "${moduleName.toUpperCase()}.${featureName.toUpperCase()}.CREATE", description: "Create ${className}" },
    { action: "edit", code: "${moduleName.toUpperCase()}.${featureName.toUpperCase()}.EDIT", description: "Edit ${className}" },
    { action: "print", code: "${moduleName.toUpperCase()}.${featureName.toUpperCase()}.PRINT", description: "Print ${className}" }
  ]
};
`
);

// 5. search.ts
fs.writeFileSync(
  path.join(targetDir, "search.ts"),
`import { SearchManifest } from "../../sdk/swsdk/manifests/search.js";

export const searchManifest: SearchManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  providers: ["items", "customers", "invoices"],
  priority: { items: 100, customers: 80, invoices: 90 },
  commands: [
    { id: "new-${workspaceId}", label: "New ${className}", action: "/${parts[0]}/${parts[1] || 'default'}/new", icon: "plus" }
  ]
};
`
);

// 6. events.ts
fs.writeFileSync(
  path.join(targetDir, "events.ts"),
`import { EventManifest } from "../../sdk/swsdk/manifests/events.js";

export const eventManifest: EventManifest = {
  schemaVersion: "1.0",
  workspaceId: "${workspaceId}",
  eventsEmitted: [
    { eventType: "${workspaceId}.created", payloadType: "Record<string, unknown>", description: "Fired when ${className} is created" }
  ],
  eventsSubscribed: ["company.changed", "theme.changed"]
};
`
);

// 7. Component
fs.writeFileSync(
  path.join(targetDir, `${className}Workspace.tsx`),
`import React from "react";

export const ${className}Workspace: React.FC = () => {
  return (
    <div className="p-6 bg-theme-surface-1 text-theme-primary">
      <h1 className="text-xl font-bold">${className} Workspace (SWSDK v1.0)</h1>
      <p className="text-sm text-theme-muted">Declarative SUNEF-compatible workspace</p>
    </div>
  );
};
`
);

// 8. Service
fs.writeFileSync(
  path.join(targetDir, `${className}Service.ts`),
`export class ${className}Service {
  public async getDetails(id: string): Promise<Record<string, unknown>> {
    return { id, title: "${className} Details" };
  }
}
`
);

// 9. Store
fs.writeFileSync(
  path.join(targetDir, `${className}Store.ts`),
`export interface ${className}State {
  activeId: string | null;
}
`
);

// 10. README.md
fs.writeFileSync(
  path.join(targetDir, "README.md"),
`# ${className} Workspace (SWSDK v1.0)

SUNEF-compliant declarative workspace created with \`npm run swsdk:create ${workspaceId}\`.
`
);

console.log(`✅ [SWSDK] Scaffolded declarative workspace '${workspaceId}' successfully in 'src/workspaces/${workspaceId}'`);
