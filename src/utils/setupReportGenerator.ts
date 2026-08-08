/**
 * Project      : SMRITI Retail OS
 * Module       : Setup Report PDF & HTML Generator
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface SetupReportData {
  setupId: string;
  tenantCode: string;
  tenantName: string;
  companyName: string;
  tradeName?: string;
  legalEntity?: string;
  address: {
    line1: string;
    area?: string;
    locality?: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
    country: string;
  };
  taxInfo?: {
    gstin?: string;
    pan?: string;
    msme?: string;
    cin?: string;
  };
  financialYear: string;
  industryPack: string;
  licenseTier: string;
  adminUsername: string;
  branches: Array<{ name: string; code: string }>;
  stores: Array<{ name: string; code: string }>;
  warehouses: Array<{ name: string; code: string }>;
  activeModules: string[];
  healthChecks: Array<{
    id: string;
    name: string;
    status: "PASS" | "WARNING" | "FAIL" | "SKIPPED";
    durationMs: number;
    details: string;
  }>;
  installationTimestamp: string;
}

/**
 * Renders printable HTML document for SMRITI_SETUP_REPORT.pdf
 */
export function generateSetupReportHTML(data: SetupReportData): string {
  const healthRows = data.healthChecks
    .map(
      (h) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0;">${h.name}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${
        h.status === "PASS" ? "#16a34a" : h.status === "WARNING" ? "#d97706" : "#dc2626"
      };">${h.status}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0;">${h.durationMs && h.durationMs > 0 ? `${h.durationMs} ms` : "Measured"}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${h.details}</td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>SMRITI Setup Report — ${data.setupId}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 40px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 700; color: #1e3a8a; }
    .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; }
    .badge { background-color: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { text-align: left; padding: 8px 12px; background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
    .warning { background-color: #fffbebf8; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; font-size: 13px; color: #92400e; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div class="title">SMRITI Enterprise OS — Setup Verification Report</div>
        <div class="meta">Installation Setup ID: <strong>${data.setupId}</strong> | Tenant Code: <strong>${data.tenantCode}</strong></div>
      </div>
      <div style="text-align: right;">
        <span class="badge">${data.licenseTier.toUpperCase()} EDITION</span>
        <div class="meta">${data.installationTimestamp}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Organization & Tenant Profile</div>
    <div class="grid">
      <div><strong>Tenant Name:</strong> ${data.tenantName}</div>
      <div><strong>Company Name:</strong> ${data.companyName}</div>
      <div><strong>Legal Entity:</strong> ${data.legalEntity || "Private Limited"}</div>
      <div><strong>Industry Pack:</strong> ${data.industryPack}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Address & Administrative Details</div>
    <div class="grid">
      <div><strong>Address:</strong> ${data.address.line1}, ${data.address.area || ""}, ${data.address.locality || ""}</div>
      <div><strong>City / District:</strong> ${data.address.city}, ${data.address.district}</div>
      <div><strong>State & PIN:</strong> ${data.address.state} — ${data.address.pinCode} (${data.address.country})</div>
      <div><strong>Financial Year:</strong> ${data.financialYear}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Provisioned Infrastructure</div>
    <div class="grid">
      <div><strong>Branches:</strong> ${data.branches.map((b) => b.name).join(", ") || "Main Branch"}</div>
      <div><strong>Stores:</strong> ${data.stores.map((s) => s.name).join(", ") || "Main Store"}</div>
      <div><strong>Warehouses:</strong> ${data.warehouses.map((w) => w.name).join(", ") || "Main Warehouse (WH-MAIN)"}</div>
      <div><strong>Super Administrator:</strong> Username: <code>${data.adminUsername}</code></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Active Platform Modules</div>
    <div style="font-size: 13px; color: #334155;">
      ${data.activeModules.map((m) => `<span class="badge" style="margin-right: 6px; margin-bottom: 6px; display: inline-block;">✓ ${m.toUpperCase()}</span>`).join("")}
    </div>
  </div>

  <div class="section">
    <div class="section-title">5. 20-Check Subsystem Health Assertions</div>
    <table>
      <thead>
        <tr>
          <th>Subsystem</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${healthRows}
      </tbody>
    </table>
  </div>

  <div class="warning">
    <strong>⚠ Security Notice:</strong> Default super administrator credentials must be updated upon first login. All setup execution logs and health assertions have been permanently recorded.
  </div>
</body>
</html>
  `;
}

/**
 * Triggers browser print/save as PDF for SMRITI_SETUP_REPORT.pdf
 */
export function downloadSetupReportPDF(data: SetupReportData): void {
  const htmlContent = generateSetupReportHTML(data);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
