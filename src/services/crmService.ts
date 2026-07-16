/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  date: string;
  score?: number;
}

export function scoreLead(lead: Lead): number {
  let score = 50; // baseline

  if (lead.source === "Referral") score += 20;
  if (lead.source === "In-Store") score += 15;
  if (lead.email && lead.email.endsWith(".com")) score += 5;
  if (lead.phone && lead.phone.startsWith("9")) score += 5;

  return Math.min(100, Math.max(0, score));
}

export function filterLeads(leads: Lead[], query: string): Lead[] {
  const q = query.toLowerCase().trim();
  if (!q) return leads;
  return leads.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.id.toLowerCase().includes(q)
  );
}
