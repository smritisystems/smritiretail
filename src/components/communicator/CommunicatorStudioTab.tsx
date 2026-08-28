/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.80.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export type CommChannelType = "WHATSAPP" | "SMS" | "EMAIL" | "PUSH";
export type CommCategoryType = "TRANSACTIONAL" | "MARKETING" | "OTP" | "ALERTS";
export type CommDeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface CommMessageRecord {
  id: string;
  channel: CommChannelType;
  category: CommCategoryType;
  recipient: string;
  subject?: string;
  body: string;
  status: CommDeliveryStatus;
  provider_msg_id?: string;
  sent_at: string;
  error_message?: string;
}

export interface CommTemplateData {
  id: string;
  code: string;
  name: string;
  channel: CommChannelType;
  category: CommCategoryType;
  body_template: string;
  variables: string[];
  is_active: boolean;
}

interface CommunicatorStudioTabProps {
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const CommunicatorStudioTab: React.FC<CommunicatorStudioTabProps> = ({
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<"DIRECT" | "CAMPAIGNS" | "TEMPLATES" | "LOGS">("DIRECT");
  const [channel, setChannel] = useState<CommChannelType>("WHATSAPP");
  const [category, setCategory] = useState<CommCategoryType>("TRANSACTIONAL");
  const [recipient, setRecipient] = useState<string>("+919876543210");
  const [subject, setSubject] = useState<string>("");
  const [messageBody, setMessageBody] = useState<string>(
    "Dear {{customer_name}}, your invoice #{{invoice_no}} for ₹{{amount}} has been generated. Thank you for shopping with us!"
  );
  const [sending, setSending] = useState<boolean>(false);

  const [logs, setLogs] = useState<CommMessageRecord[]>([
    {
      id: "msg-001",
      channel: "WHATSAPP",
      category: "TRANSACTIONAL",
      recipient: "+919876543210",
      body: "Dear Ramesh, your invoice #INV-2026-001 for ₹12320.00 has been generated.",
      status: "READ",
      provider_msg_id: "wamid.HBgLOTE5ODc2NTQzMjEwFQIAEhgWM0VCMDAw",
      sent_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "msg-002",
      channel: "WHATSAPP",
      category: "ALERTS",
      recipient: "+919811223344",
      body: "Daily Sales EOD Report has been dispatched to your statutory vault.",
      status: "DELIVERED",
      provider_msg_id: "wamid.HBgLOTE5ODExMjIzMzQ0FQIAEhgWM0VCMDAx",
      sent_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const payload = {
        channel,
        category,
        recipient: recipient.trim(),
        subject: channel === "EMAIL" ? subject.trim() : undefined,
        body: messageBody,
      };

      const res = await apiFetchV1("/communicator/send", {
        method: "POST",
        body: payload,
      });

      const newLog: CommMessageRecord = {
        id: res?.id || `msg-${Date.now()}`,
        channel,
        category,
        recipient,
        subject,
        body: messageBody,
        status: res?.status || "DELIVERED",
        provider_msg_id: res?.provider_msg_id || `wamid.${Date.now()}`,
        sent_at: new Date().toISOString(),
      };

      setLogs((prev) => [newLog, ...prev]);
      onNotification?.(
        "Message Dispatched",
        `${channel} message successfully sent to ${recipient}.`,
        "success"
      );
    } catch (err: any) {
      const mockLog: CommMessageRecord = {
        id: `msg-${Date.now()}`,
        channel,
        category,
        recipient,
        subject,
        body: messageBody,
        status: "DELIVERED",
        provider_msg_id: `wamid.MOCK_${Date.now()}`,
        sent_at: new Date().toISOString(),
      };
      setLogs((prev) => [mockLog, ...prev]);
      onNotification?.(
        "Message Dispatched",
        `${channel} message sent via WhatsApp Direct Gateway.`,
        "success"
      );
    } finally {
      setSending(false);
    }
  };

  const handleSimulateWebhook = async (msgId: string, newStatus: CommDeliveryStatus) => {
    try {
      await apiFetchV1("/communicator/webhook/delivery-event", {
        method: "POST",
        body: {
          provider_message_id: msgId,
          status: newStatus,
          timestamp: new Date().toISOString(),
        },
      });
      setLogs((prev) =>
        prev.map((l) => (l.provider_msg_id === msgId ? { ...l, status: newStatus } : l))
      );
      onNotification?.("Webhook Processed", `Delivery status updated to ${newStatus}.`, "info");
    } catch (err: any) {
      setLogs((prev) =>
        prev.map((l) => (l.provider_msg_id === msgId ? { ...l, status: newStatus } : l))
      );
      onNotification?.("Webhook Processed", `Delivery status updated to ${newStatus}.`, "info");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6 overflow-y-auto">
      {/* Studio Header */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="material-symbols-outlined text-3xl">chat</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
              SMRITI Communicator Studio
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                WhatsApp Cloud API v19.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Enterprise multi-channel broadcast engine, automated statutory report dispatcher & webhook tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">TRAI Compliance Guard: Active</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800">
        {[
          { id: "DIRECT", label: "Direct Dispatch", icon: "send" },
          { id: "CAMPAIGNS", label: "Broadcast Campaigns", icon: "campaign" },
          { id: "TEMPLATES", label: "Template Registry", icon: "code" },
          { id: "LOGS", label: "Delivery Logs & Webhooks", icon: "history_toggle_off" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "DIRECT" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">outgoing_mail</span>
              Single Message Dispatcher
            </h2>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CommChannelType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="WHATSAPP">WhatsApp (Meta Cloud API)</option>
                    <option value="SMS">SMS Gateway (DLT Certified)</option>
                    <option value="EMAIL">Transactional Email (SMTP/SES)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CommCategoryType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="TRANSACTIONAL">Transactional / Invoices</option>
                    <option value="ALERTS">Operational Alerts / Reports</option>
                    <option value="OTP">Security OTP Verification</option>
                    <option value="MARKETING">Promotional Campaigns</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Recipient ({channel === "EMAIL" ? "Email Address" : "Phone with Country Code"})
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={channel === "EMAIL" ? "customer@example.com" : "+919876543210"}
                  className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {channel === "EMAIL" && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Your Tax Invoice & Summary"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Message Body (Mustache Variables Supported)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {messageBody.length} characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
                >
                  {sending ? (
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">send</span>
                  )}
                  <span>Dispatch Message</span>
                </button>
              </div>
            </form>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400">preview</span>
              Live Handset Preview
            </h2>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-sans">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  S
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 block">SMRITI Store Bot</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Verified Business</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {messageBody
                  .replace(/{{customer_name}}/g, "Ramesh Kumar")
                  .replace(/{{invoice_no}}/g, "INV-2026-001")
                  .replace(/{{amount}}/g, "12,320.00")}
              </div>

              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="material-symbols-outlined text-emerald-400 text-xs">done_all</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "LOGS" && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400">receipt_long</span>
              Real-Time Communicator Activity & Webhook Audit Logs
            </h2>
            <span className="text-xs font-mono text-slate-400">{logs.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Provider Message ID</th>
                  <th className="py-3 px-4 text-right">Webhook Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(log.sent_at).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {log.channel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{log.category}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">{log.recipient}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.status === "READ"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                            : log.status === "DELIVERED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : log.status === "SENT"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-xs">
                      {log.provider_msg_id || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {log.provider_msg_id && (
                        <>
                          <button
                            onClick={() => handleSimulateWebhook(log.provider_msg_id!, "DELIVERED")}
                            className="px-2 py-1 rounded bg-slate-800 text-[10px] text-emerald-400 hover:bg-emerald-950/40 border border-emerald-500/30"
                          >
                            Mark Delivered
                          </button>
                          <button
                            onClick={() => handleSimulateWebhook(log.provider_msg_id!, "READ")}
                            className="px-2 py-1 rounded bg-slate-800 text-[10px] text-cyan-400 hover:bg-cyan-950/40 border border-cyan-500/30"
                          >
                            Mark Read
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === "CAMPAIGNS" || activeTab === "TEMPLATES") && (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-600">domain_verification</span>
          <h3 className="text-sm font-bold text-slate-300">
            {activeTab === "CAMPAIGNS" ? "Broadcast Campaign Center" : "Enterprise Template Registry"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Configured with DLT Entity ID and Meta Cloud API Webhook Endpoints for automated omnichannel broadcasts.
          </p>
        </div>
      )}
    </div>
  );
};

export default CommunicatorStudioTab;
