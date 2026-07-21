/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 29.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: OpenAPI Explorer & SDK Sandbox UI Component
 */

import React from 'react';
import { Terminal, Shield, Code, Play } from 'lucide-react';

export const ApiReferenceSandbox: React.FC = () => {
  const endpoints = [
    {
      path: '/api/v1/nic-gst/einvoice/generate',
      method: 'POST',
      summary: 'Computes SHA-256 IRN Hash and returns Signed B2B QR Code.',
      auth: 'Bearer JWT Token (SIP-001)',
      request: '{\n  "invoice_number": "INV-2026-001",\n  "taxable_amount": 10000.0,\n  "gst_rate": 18.0\n}',
      response: '{\n  "irn_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae...",\n  "signed_qr_code": "data:image/png;base64,...",\n  "status": "GENERATED"\n}',
      snippet: 'from smriti_sdk import NicGstClient\nclient = NicGstClient(token="...")\nres = client.generate_einvoice(inv_no="INV-2026-001", amount=10000)'
    },
    {
      path: '/api/v1/pharma/expiry-lock/check',
      method: 'POST',
      summary: 'Evaluates FEFO near-expiry locks (blocks items expiring in < 30 days).',
      auth: 'Bearer JWT Token (SIP-001)',
      request: '{\n  "batch_number": "BATCH-2026-X",\n  "expiry_date": "2026-08-01"\n}',
      response: '{\n  "batch_number": "BATCH-2026-X",\n  "days_remaining": 10,\n  "locked": true,\n  "reason": "FEFO Policy: Expires in < 30 days"\n}',
      snippet: 'from smriti_sdk import PharmaClient\nclient = PharmaClient(token="...")\nres = client.check_expiry_lock(batch="BATCH-2026-X")'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Terminal className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Interactive OpenAPI Sandbox</h2>
        </div>
        <p className="text-slate-400 text-xs">Test REST API endpoints and inspect request/response DTO schemas.</p>
      </div>

      {endpoints.map((ep, idx) => (
        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded">
                {ep.method}
              </span>
              <span className="font-mono text-sm text-white font-semibold">{ep.path}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
              <Shield className="w-3.5 h-3.5" />
              <span>{ep.auth}</span>
            </div>
          </div>

          <p className="text-slate-300 text-xs">{ep.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Request Example Payload</span>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                {ep.request}
              </pre>
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Response DTO (HTTP 200 OK)</span>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
                {ep.response}
              </pre>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>Python SDK Snippet</span>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
              {ep.snippet}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
};
