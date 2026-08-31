/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.110.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import LoyaltyTierEngine, {
  LoyaltyMember, LoyaltyTier, TierAuditEntry,
  DEFAULT_TIER_POLICY,
} from "../../utils/loyaltyTierEngine";

interface LoyaltyTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TIER_STYLE: Record<LoyaltyTier, { badge: string; bar: string; icon: string }> = {
  BRONZE:   { badge: "text-amber-700 bg-amber-900/30 border-amber-700/40",   bar: "bg-amber-700",   icon: "ðŸ¥‰" },
  SILVER:   { badge: "text-slate-300 bg-slate-700/30 border-slate-500/40",   bar: "bg-slate-400",   icon: "ðŸ¥ˆ" },
  GOLD:     { badge: "text-yellow-300 bg-yellow-900/30 border-yellow-600/40", bar: "bg-yellow-500",  icon: "ðŸ¥‡" },
  PLATINUM: { badge: "text-cyan-300 bg-cyan-900/30 border-cyan-500/40",       bar: "bg-cyan-400",    icon: "ðŸ’Ž" },
};

function buildSampleMembers(): LoyaltyMember[] {
  const NOW = new Date("2026-08-28T00:00:00.000Z");
  let m1 = LoyaltyTierEngine.createMember({ memberId: "MBR-001", memberNo: "LYL-0001", name: "Priya Sharma",    joinDate: "2024-08-28", initialTier: "BRONZE" });
  m1 = LoyaltyTierEngine.accrue(m1, 55000, 5500);   // Qualifies for GOLD
  const { member: um1 } = LoyaltyTierEngine.evaluateTier(m1, NOW);
  let m1Final = LoyaltyTierEngine.checkAnniversary(um1, NOW);

  let m2 = LoyaltyTierEngine.createMember({ memberId: "MBR-002", memberNo: "LYL-0002", name: "Rahul Mehta",     joinDate: "2023-03-10", initialTier: "GOLD" });
  m2 = { ...m2, lastTierChangeAt: new Date("2026-07-01").toISOString() };   // Recent â€” downgrade locked
  m2 = LoyaltyTierEngine.accrue(m2, 8000, 800);     // Below GOLD threshold but cooldown active

  let m3 = LoyaltyTierEngine.createMember({ memberId: "MBR-003", memberNo: "LYL-0003", name: "Sunita Rao",      joinDate: "2022-01-15", initialTier: "PLATINUM" });
  m3 = LoyaltyTierEngine.accrue(m3, 200000, 20000);

  let m4 = LoyaltyTierEngine.createMember({ memberId: "MBR-004", memberNo: "LYL-0004", name: "Karthik Subramaniam", joinDate: "2025-05-20", initialTier: "BRONZE" });
  m4 = LoyaltyTierEngine.accrue(m4, 18000, 1800);   // Qualifies for SILVER
  const { member: um4 } = LoyaltyTierEngine.evaluateTier(m4, NOW);

  return [m1Final, m2, m3, um4];
}

export const LoyaltyTierModal: React.FC<LoyaltyTierModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [members, setMembers]   = useState<LoyaltyMember[]>(buildSampleMembers);
  const [selectedId, setSelectedId] = useState(members[0]?.memberId ?? "");
  const [activeTab, setActiveTab]   = useState<"MEMBERS" | "EVALUATE" | "SUMMARY">("MEMBERS");

  const NOW     = useMemo(() => new Date("2026-08-28T00:00:00.000Z"), []);
  const selected = members.find((m) => m.memberId === selectedId);
  const summary  = useMemo(() => LoyaltyTierEngine.tierSummary(members), [members]);

  if (!isOpen) return null;

  const updateMember = (m: LoyaltyMember) => setMembers((prev) => prev.map((x) => x.memberId === m.memberId ? m : x));

  const handleEvaluateAll = () => {
    const { members: updated, evaluations } = LoyaltyTierEngine.evaluateBatch(members, NOW);
    setMembers(updated);
    const changes = evaluations.filter((e) => e.changeType !== "NO_CHANGE");
    onNotification?.(
      "Batch Evaluation Complete",
      changes.length > 0 ? `${changes.length} tier change(s) applied` : "No tier changes",
      "success"
    );
  };

  const handleAnniversary = (member: LoyaltyMember) => {
    const updated = LoyaltyTierEngine.checkAnniversary(member, NOW);
    if (updated.auditTrail.length > member.auditTrail.length) {
      updateMember(updated);
      const bonus = DEFAULT_TIER_POLICY.tiers.find((t) => t.tier === member.currentTier)?.anniversaryBonus ?? 0;
      onNotification?.("Anniversary Reward", `+${bonus} points awarded to ${member.name}`, "success");
    } else {
      onNotification?.("No Anniversary", `${member.name}'s anniversary is not today`, "info");
    }
  };

  const fmt = (n: number) => `â‚¹${n.toLocaleString("en-IN")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-2xl">ðŸ’Ž</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Loyalty Tier Upgrade Engine</h2>
              <p className="text-xs text-slate-400">Bronze â†’ Silver â†’ Gold â†’ Platinum Â· Downgrade Cooldown Â· Anniversary Rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["MEMBERS", "EVALUATE", "SUMMARY"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "EVALUATE" ? "Bulk Evaluate" : tab === "SUMMARY" ? "Tier Summary" : "Members"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Member sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {members.map((m) => (
              <button key={m.memberId} onClick={() => { setSelectedId(m.memberId); setActiveTab("MEMBERS"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === m.memberId ? "bg-yellow-950/20 border-yellow-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-xs font-medium text-slate-200">{m.name}</p>
                <p className="text-[10px] text-slate-500">{m.memberNo}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_STYLE[m.currentTier].badge}`}>
                    {TIER_STYLE[m.currentTier].icon} {m.currentTier}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{m.currentPoints.toLocaleString("en-IN")} pts</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "MEMBERS" && selected && (
              <>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100">{selected.name}</p>
                    <p className="text-xs text-slate-400">{selected.memberNo} Â· Joined: {selected.joinDate}</p>
                    <p className="text-[10px] text-slate-500">Last tier change: {new Date(selected.lastTierChangeAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black px-3 py-1.5 rounded-full border ${TIER_STYLE[selected.currentTier].badge}`}>
                      {TIER_STYLE[selected.currentTier].icon} {selected.currentTier}
                    </span>
                    <button onClick={() => handleAnniversary(selected)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 transition-all">
                      ðŸŽ‚ Anniversary Check
                    </button>
                  </div>
                </div>

                {/* Points KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Current Points",  value: selected.currentPoints.toLocaleString("en-IN"),  color: "text-yellow-400" },
                    { label: "Lifetime Points", value: selected.lifetimePoints.toLocaleString("en-IN"), color: "text-slate-300" },
                    { label: "Window Spend",    value: fmt(selected.windowSpend),                        color: "text-teal-400" },
                    { label: "Lifetime Spend",  value: fmt(selected.lifetimeSpend),                      color: "text-slate-300" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                      <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tier progression */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tier Thresholds</p>
                  <div className="space-y-2">
                    {DEFAULT_TIER_POLICY.tiers.map((t) => {
                      const met = selected.windowSpend >= t.minSpend && selected.windowPoints >= t.minPoints;
                      return (
                        <div key={t.tier} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs ${selected.currentTier === t.tier ? `${TIER_STYLE[t.tier].badge} border-opacity-60` : "bg-slate-800/20 border-slate-800/40"}`}>
                          <div className="flex items-center gap-2">
                            <span>{TIER_STYLE[t.tier].icon}</span>
                            <span className="font-bold text-slate-200">{t.tier}</span>
                            {selected.currentTier === t.tier && <span className="text-[9px] text-emerald-400 font-bold">â— CURRENT</span>}
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-mono">
                            <span className={met ? "text-emerald-400" : "text-slate-500"}>Spend: {fmt(t.minSpend)}</span>
                            <span className={met ? "text-emerald-400" : "text-slate-500"}>Points: {t.minPoints.toLocaleString("en-IN")}</span>
                            <span className="text-yellow-400">ðŸŽ‚ +{t.anniversaryBonus} pts/yr</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Audit trail */}
                {selected.auditTrail.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tier History</p>
                    <div className="space-y-2">
                      {[...selected.auditTrail].reverse().map((e) => (
                        <div key={e.auditId} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 flex-shrink-0 ${
                            e.type === "UPGRADE"           ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                            : e.type === "DOWNGRADE"        ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                            : e.type === "ANNIVERSARY_REWARD" ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/20"
                            : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                          }`}>{e.type.replace(/_/g, " ")}</span>
                          <div>
                            <p className="font-mono text-[10px] text-slate-500">{e.fromTier} â†’ {e.toTier} Â· {new Date(e.performedAt).toLocaleDateString("en-IN")}</p>
                            <p className="text-slate-400 mt-0.5">{e.reason}</p>
                            {e.pointsDelta && <p className="text-yellow-400 mt-0.5">+{e.pointsDelta} pts awarded</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "EVALUATE" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-200">Bulk Tier Evaluation</p>
                  <button onClick={handleEvaluateAll}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-500 transition-all">
                    âš¡ Evaluate All Members
                  </button>
                </div>
                <div className="space-y-3">
                  {members.map((m) => {
                    const ev = LoyaltyTierEngine.evaluateTier(m, NOW);
                    const changeType = ev.evaluation.changeType;
                    return (
                      <div key={m.memberId} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{TIER_STYLE[m.currentTier].icon}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{m.name}</p>
                            <p className="text-[10px] text-slate-500">Spend: {fmt(m.windowSpend)} Â· Points: {m.windowPoints.toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_STYLE[m.currentTier].badge}`}>{m.currentTier}</span>
                          <span className="text-slate-500">â†’</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_STYLE[ev.evaluation.proposedTier].badge}`}>{ev.evaluation.proposedTier}</span>
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${
                            changeType === "UPGRADE"   ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                            : changeType === "DOWNGRADE" ? ev.evaluation.downgradeLocked ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : "text-rose-300 bg-rose-500/10 border-rose-500/20"
                            : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                          }`}>
                            {changeType === "DOWNGRADE" && ev.evaluation.downgradeLocked ? "LOCKED" : changeType.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "SUMMARY" && (
              <div className="space-y-5">
                <p className="text-sm font-bold text-slate-200">Tier Distribution â€” {members.length} Members</p>
                <div className="grid grid-cols-2 gap-4">
                  {(["PLATINUM", "GOLD", "SILVER", "BRONZE"] as LoyaltyTier[]).map((tier) => {
                    const count = summary[tier];
                    const pct   = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
                    return (
                      <div key={tier} className={`rounded-2xl border p-5 ${TIER_STYLE[tier].badge}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-3xl">{TIER_STYLE[tier].icon}</div>
                          <div className="text-right">
                            <div className="text-3xl font-black font-mono">{count}</div>
                            <div className="text-[10px] uppercase tracking-wide opacity-70">members</div>
                          </div>
                        </div>
                        <p className="text-sm font-bold">{tier}</p>
                        <div className="h-1.5 bg-black/20 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${TIER_STYLE[tier].bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] opacity-70 mt-1">{pct}% of members</p>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Policy Reference</p>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Â· Evaluation Window: <strong className="text-slate-200">{DEFAULT_TIER_POLICY.evaluationWindowMonths} months</strong></p>
                    <p>Â· Downgrade Cooldown: <strong className="text-slate-200">{DEFAULT_TIER_POLICY.downgradeCooldownMonths} months</strong></p>
                    <p>Â· Auto-Upgrade: Immediate on crossing threshold.</p>
                    <p>Â· Downgrade: Blocked until cooldown elapsed since last tier change.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyTierModal;

