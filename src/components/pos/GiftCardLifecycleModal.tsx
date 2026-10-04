/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.119.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.119.1 (2026-10-04):
 *   - Replaced giftCardEngine mock with live apiFetchV1 calls:
 *     GET /gift-cards-engine/gift-cards, POST /gift-cards-engine/gift-cards,
 *     POST /gift-cards-engine/gift-cards/{id}/topup,
 *     POST /gift-cards-engine/gift-cards/{id}/redeem,
 *     POST /gift-cards-engine/gift-cards/{id}/block.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface GiftCard {
  id: string;
  card_no: string;
  card_type: string;
  status: string;
  face_value: number;
  balance: number;
  currency: string;
  issued_to?: string;
  issued_at?: string;
  valid_from?: string;
  valid_to?: string;
}

interface GiftCardLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  EXPIRED:  "text-slate-400  bg-slate-800/30   border-slate-700/30",
  BLOCKED:  "text-rose-300   bg-rose-500/15   border-rose-500/25",
  REDEEMED: "text-violet-300 bg-violet-500/15  border-violet-500/25",
};
const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const GiftCardLifecycleModal: React.FC<GiftCardLifecycleModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [cards, setCards]           = useState<GiftCard[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"LIST" | "ISSUE" | "TOPUP" | "REDEEM">("LIST");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [issueForm, setIssueForm]   = useState({ card_type: "PHYSICAL", face_value: "500", issued_to: "", valid_to: "" });
  const [txnCardId, setTxnCardId]   = useState("");
  const [txnAmount, setTxnAmount]   = useState("100");
  const [txnRef, setTxnRef]         = useState("");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const qs = filterStatus !== "ALL" ? `?status=${filterStatus}` : "";
      const data = await apiFetchV1<GiftCard[]>(`/gift-cards-engine/gift-cards${qs}`);
      setCards(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load gift cards."); }
    finally { setLoading(false); }
  }, [isOpen, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleIssue = async () => {
    setSubmitting(true);
    try {
      const c = await apiFetchV1<GiftCard>("/gift-cards-engine/gift-cards", {
        method: "POST",
        body: JSON.stringify({
          card_type: issueForm.card_type,
          face_value: parseFloat(issueForm.face_value) || 500,
          issued_to: issueForm.issued_to || undefined,
          valid_to: issueForm.valid_to || undefined,
        }),
      });
      if (c) { setCards((p) => [c, ...p]); onNotification?.("Card Issued", `${c.card_no} · ${fmt(c.face_value)}`, "success"); setActiveTab("LIST"); }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Issue failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleTxn = async (action: "topup" | "redeem") => {
    if (!txnCardId) { onNotification?.("Validation", "Card ID is required.", "info"); return; }
    setSubmitting(true);
    try {
      const c = await apiFetchV1<GiftCard>(`/gift-cards-engine/gift-cards/${txnCardId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(txnAmount) || 0, reference_no: txnRef || undefined }),
      });
      if (c) { setCards((p) => p.map((x) => x.id === c.id ? c : x)); onNotification?.("Updated", `${action} successful.`, "success"); setActiveTab("LIST"); }
    } catch (e: any) { onNotification?.("Error", e?.message ?? `${action} failed.`, "error"); }
    finally { setSubmitting(false); }
  };

  const handleBlock = async (id: string) => {
    try {
      const c = await apiFetchV1<GiftCard>(`/gift-cards-engine/gift-cards/${id}/block`, { method: "POST" });
      if (c) setCards((p) => p.map((x) => x.id === c.id ? c : x));
      onNotification?.("Blocked", "Gift card has been blocked.", "success");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Block failed.", "error"); }
  };

  const displayed = filterStatus === "ALL" ? cards : cards.filter((c) => c.status === filterStatus);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-pink-400 text-2xl">card_giftcard</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Gift Card Lifecycle Studio</h2>
              <p className="text-xs text-slate-400">Issue · Top-up · Redeem · Block</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(["LIST", "ISSUE", "TOPUP", "REDEEM"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {t === "LIST" ? "Cards" : t === "TOPUP" ? "Top-up" : t}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex-1 overflow-y-auto">
          {activeTab === "LIST" && (
            <>
              <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
                {["ALL", "ACTIVE", "BLOCKED", "EXPIRED", "REDEEMED"].map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${filterStatus === s ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                    {s}
                  </button>
                ))}
                {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
              </div>
              <div className="p-4 space-y-2">
                {displayed.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                    <span className="material-symbols-outlined text-4xl">card_giftcard</span>
                    <p className="text-sm">No gift cards found.</p>
                  </div>
                ) : displayed.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
                    <div>
                      <p className="font-bold text-slate-100 font-mono">{c.card_no}</p>
                      <p className="text-slate-500 mt-0.5">{c.card_type} · {c.issued_to ?? "—"} · Expires: {c.valid_to ?? "Open"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black font-mono text-pink-400">{fmt(c.balance)}</p>
                        <p className="text-slate-600 text-[10px]">of {fmt(c.face_value)}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</span>
                      {c.status === "ACTIVE" && (
                        <button onClick={() => handleBlock(c.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-rose-400 hover:bg-rose-950/30 border border-rose-800/30 transition-all">Block</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "ISSUE" && (
            <div className="p-6 space-y-4 text-xs max-w-md">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Issue New Gift Card</p>
              {[
                { label: "Face Value (₹)", key: "face_value", type: "number", placeholder: "500" },
                { label: "Issued To",      key: "issued_to",  placeholder: "Customer name / mobile" },
                { label: "Valid Until",    key: "valid_to",   type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(issueForm as any)[f.key]}
                    onChange={(e) => setIssueForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500/60" />
                </div>
              ))}
              <div className="flex gap-2">
                {["PHYSICAL", "DIGITAL"].map((t) => (
                  <button key={t} onClick={() => setIssueForm((p) => ({ ...p, card_type: t }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${issueForm.card_type === t ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : "text-slate-500 border-slate-700"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={handleIssue} disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-40 transition-all">
                {submitting ? "Issuing..." : "Issue Gift Card"}
              </button>
            </div>
          )}

          {(activeTab === "TOPUP" || activeTab === "REDEEM") && (
            <div className="p-6 space-y-4 text-xs max-w-md">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{activeTab === "TOPUP" ? "Top-up Gift Card" : "Redeem Gift Card"}</p>
              {[
                { label: "Card ID *", key: "cardId",    val: txnCardId, set: setTxnCardId,   placeholder: "Card UUID" },
                { label: "Amount (₹) *", key: "amount", val: txnAmount, set: setTxnAmount,   placeholder: "100", type: "number" },
                { label: "Reference No",  key: "ref",   val: txnRef,    set: setTxnRef,      placeholder: "POS-001" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={f.val} onChange={(e) => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500/60" />
                </div>
              ))}
              <button onClick={() => handleTxn(activeTab === "TOPUP" ? "topup" : "redeem")} disabled={submitting}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all ${activeTab === "TOPUP" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"}`}>
                {submitting ? "Processing..." : activeTab === "TOPUP" ? "Top-up Card" : "Redeem Card"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default GiftCardLifecycleModal;
