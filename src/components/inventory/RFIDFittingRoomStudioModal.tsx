/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.89.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import FittingRoomEngine, {
  FittingRoomSession,
  RFIDGarmentTag,
  CrossSellRecommendation,
  FittingRoomStatus,
} from "../../utils/fittingRoomEngine";

interface RFIDFittingRoomStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const ROOM_LIST = ["FR-01", "FR-02", "FR-03", "FR-04"];

const STATUS_STYLES: Record<FittingRoomStatus, { label: string; bg: string; text: string }> = {
  VACANT:            { label: "Vacant",           bg: "bg-slate-700/50",   text: "text-slate-400" },
  OCCUPIED:          { label: "Occupied",          bg: "bg-blue-500/20",    text: "text-blue-300" },
  TRIAL_IN_PROGRESS: { label: "Trial in Progress", bg: "bg-amber-500/20",   text: "text-amber-300" },
  NEEDS_ATTENTION:   { label: "Needs Attention",   bg: "bg-rose-500/20",    text: "text-rose-300" },
  CLEANING:          { label: "Cleaning",          bg: "bg-violet-500/20",  text: "text-violet-300" },
};

const CATALOG_GARMENTS: RFIDGarmentTag[] = [
  { rfidTag: "RFID-APP-001", sku: "APP-POLO-NAVY-M",    productName: "Polo Shirt Navy M",     category: "Apparel",  size: "M",  color: "Navy",   mrp: 1499, sellingPrice: 1200 },
  { rfidTag: "RFID-APP-002", sku: "APP-KURTA-WHT-L",    productName: "Cotton Kurta White L",  category: "Apparel",  size: "L",  color: "White",  mrp: 1999, sellingPrice: 1599 },
  { rfidTag: "RFID-DNM-001", sku: "DNM-SLIM-BLK-32",    productName: "Slim Fit Denim Black",  category: "Denim",    size: "32", color: "Black",  mrp: 2499, sellingPrice: 1999 },
  { rfidTag: "RFID-FRM-001", sku: "FRM-SHIRT-BLU-M",    productName: "Formal Shirt Blue M",   category: "Formals",  size: "M",  color: "Blue",   mrp: 1799, sellingPrice: 1499 },
  { rfidTag: "RFID-FTW-001", sku: "FTW-SNEAKER-WHT-8",  productName: "Sneakers White Size 8", category: "Footwear", size: "8",  color: "White",  mrp: 3499, sellingPrice: 2800 },
];

export const RFIDFittingRoomStudioModal: React.FC<RFIDFittingRoomStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [sessions, setSessions] = useState<Record<string, FittingRoomSession | null>>({ "FR-01": null, "FR-02": null, "FR-03": null, "FR-04": null });
  const [selectedRoom, setSelectedRoom] = useState<string>("FR-01");
  const [selectedGarments, setSelectedGarments] = useState<Set<string>>(new Set());
  const [completedSessions, setCompletedSessions] = useState<FittingRoomSession[]>([]);
  const [activeTab, setActiveTab] = useState<"ROOMS" | "ANALYTICS">("ROOMS");

  const currentSession = sessions[selectedRoom];

  const analytics = useMemo(() => FittingRoomEngine.computeAnalytics(completedSessions), [completedSessions]);

  if (!isOpen) return null;

  const handleOpenSession = () => {
    const tagsToAdd = CATALOG_GARMENTS.filter((g) => selectedGarments.has(g.rfidTag));
    if (tagsToAdd.length === 0) { onNotification?.("No Garments Selected", "Select at least one garment to open a session.", "error"); return; }
    const session = FittingRoomEngine.openSession({ roomId: selectedRoom, garmentTags: tagsToAdd, customerId: "WALK-IN" });
    setSessions((prev) => ({ ...prev, [selectedRoom]: session }));
    setSelectedGarments(new Set());
    onNotification?.("Session Opened", `${tagsToAdd.length} garment(s) scanned into ${selectedRoom}`, "info");
  };

  const handleGarmentExit = (rfidTag: string, purchased: boolean) => {
    if (!currentSession) return;
    const updated = FittingRoomEngine.recordGarmentOut(currentSession, rfidTag, purchased);
    setSessions((prev) => ({ ...prev, [selectedRoom]: updated }));
    if (updated.status === "VACANT") {
      setCompletedSessions((prev) => [...prev, updated]);
      setSessions((prev) => ({ ...prev, [selectedRoom]: null }));
      onNotification?.("Session Closed", `${selectedRoom} session complete. Garment data saved to analytics.`, "success");
    }
  };

  const toggleGarment = (rfidTag: string) => {
    setSelectedGarments((prev) => {
      const n = new Set(prev);
      n.has(rfidTag) ? n.delete(rfidTag) : n.add(rfidTag);
      return n;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <span className="material-symbols-outlined text-2xl">door_open</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">RFID Smart Fitting Room Studio</h2>
              <p className="text-xs text-slate-400">Real-Time Garment Tracking · AI Cross-Sell · Session Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("ROOMS")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "ROOMS" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              Rooms
            </button>
            <button onClick={() => setActiveTab("ANALYTICS")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "ANALYTICS" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
              Analytics
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "ROOMS" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Room Selector Grid */}
              <div className="lg:col-span-1 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Fitting Rooms</p>
                {ROOM_LIST.map((room) => {
                  const sess = sessions[room];
                  const status: FittingRoomStatus = sess ? sess.status : "VACANT";
                  const st = STATUS_STYLES[status];
                  return (
                    <button
                      key={room}
                      onClick={() => setSelectedRoom(room)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedRoom === room
                          ? "bg-cyan-950/20 border-cyan-500/50 shadow-lg"
                          : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-sm">{room}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text} border border-slate-700/40`}>{st.label}</span>
                      </div>
                      {sess && (
                        <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                          {sess.garments.filter((e) => e.action === "BROUGHT_IN").length} garment(s) in trial
                        </div>
                      )}
                      {!sess && <div className="text-[10px] text-slate-500 mt-1.5">No active session</div>}
                    </button>
                  );
                })}
              </div>

              {/* Session Detail Panel */}
              <div className="lg:col-span-2 space-y-4">
                {!currentSession ? (
                  /* ?? Start New Session ?? */
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Scan Garments into {selectedRoom}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {CATALOG_GARMENTS.map((g) => (
                          <button
                            key={g.rfidTag}
                            onClick={() => toggleGarment(g.rfidTag)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              selectedGarments.has(g.rfidTag)
                                ? "bg-cyan-950/30 border-cyan-500/50"
                                : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-all ${selectedGarments.has(g.rfidTag) ? "bg-cyan-500 border-cyan-500" : "border-slate-600"}`}>
                              {selectedGarments.has(g.rfidTag) && <span className="material-symbols-outlined text-[10px] text-white leading-none">check</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">{g.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{g.rfidTag} · {g.category} · Size {g.size}</div>
                            </div>
                            <div className="text-xs font-bold text-emerald-400 font-mono">₹{g.sellingPrice}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleOpenSession}
                      disabled={selectedGarments.size === 0}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">sensors</span>
                        Scan {selectedGarments.size} Garment(s) Into {selectedRoom}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* ?? Active Session View ?? */
                  <div className="space-y-4">
                    {/* Cross-Sell Recommendations */}
                    {currentSession.crossSellsGenerated.length > 0 && (
                      <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4">
                        <p className="text-xs font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                          AI Cross-Sell Recommendations for Customer Display
                        </p>
                        <div className="space-y-2">
                          {currentSession.crossSellsGenerated.map((rec) => (
                            <div key={rec.recommendationId} className="flex items-start justify-between gap-3 text-xs bg-slate-900/60 rounded-lg p-3">
                              <div>
                                <div className="text-slate-200 font-semibold">{rec.recommendedProductName}</div>
                                <div className="text-slate-400 text-[10px] mt-0.5">{rec.reason}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-emerald-400 font-bold font-mono">₹{rec.recommendedPrice}</div>
                                <div className="text-[10px] text-amber-400">{Math.round(rec.affinity * 100)}% match</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Garments In Room */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Garments in {selectedRoom}</p>
                      {currentSession.garments.filter((e) => e.action === "BROUGHT_IN").map((evt) => {
                        const catalog = CATALOG_GARMENTS.find((g) => g.rfidTag === evt.rfidTag);
                        return (
                          <div key={evt.rfidTag} className="flex items-center justify-between gap-3 p-3 mb-2 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                            <div>
                              <div className="text-sm font-semibold text-slate-200">{evt.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{evt.rfidTag}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleGarmentExit(evt.rfidTag, false)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 font-semibold transition-all"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => handleGarmentExit(evt.rfidTag, true)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-500 shadow-sm shadow-emerald-500/20 transition-all"
                              >
                                Purchased
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ?? ANALYTICS ??????????????????????????????????????????????????????? */}
          {activeTab === "ANALYTICS" && (
            <div className="space-y-5">
              {completedSessions.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">Complete fitting room sessions to see analytics here.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Total Sessions", value: analytics.totalSessions, color: "text-slate-300" },
                      { label: "Garments Tried", value: analytics.totalGarmentsTrialled, color: "text-cyan-400" },
                      { label: "Purchased", value: analytics.totalGarmentsPurchased, color: "text-emerald-400" },
                      { label: "Conversion Rate", value: `${analytics.conversionRate}%`, color: "text-amber-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                        <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {analytics.topTrialledSkus.length > 0 && (
                    <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Most Trialled Garments</p>
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                            <th className="py-1.5 pb-2">Product</th>
                            <th className="py-1.5 pb-2 text-center">Trials</th>
                            <th className="py-1.5 pb-2 text-center">Purchases</th>
                            <th className="py-1.5 pb-2 text-right">Conversion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {analytics.topTrialledSkus.map((s) => (
                            <tr key={s.sku}>
                              <td className="py-2"><div className="font-semibold text-slate-200">{s.productName}</div><div className="text-[10px] text-slate-500 font-mono">{s.sku}</div></td>
                              <td className="py-2 text-center text-cyan-400 font-bold">{s.trialCount}</td>
                              <td className="py-2 text-center text-emerald-400 font-bold">{s.purchaseCount}</td>
                              <td className="py-2 text-right font-bold text-amber-400">
                                {s.trialCount > 0 ? `${Math.round((s.purchaseCount / s.trialCount) * 100)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {analytics.abandonedGarments.length > 0 && (
                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4">
                      <p className="text-xs font-bold text-rose-300 mb-3">Abandoned Garments (Tried but Not Purchased)</p>
                      {analytics.abandonedGarments.map((g) => (
                        <div key={g.sku} className="flex justify-between text-xs text-slate-300 py-1.5 border-b border-slate-800/40 last:border-0">
                          <span>{g.productName} <span className="text-slate-500 font-mono text-[10px]">({g.sku})</span></span>
                          <span className="text-slate-400">{g.avgTrialMs > 0 ? `${Math.round(g.avgTrialMs / 1000)}s avg trial` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RFIDFittingRoomStudioModal;

