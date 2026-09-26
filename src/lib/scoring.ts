/**
 * Deterministic, explainable lead scoring. Same input always yields the same score.
 * Weights: completeness 40, intent 35, fit 25.
 */
export type ScoreInput = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  message?: string | null;
  budget?: number | null;
  timeline?: string | null;
};

export type ScoreBreakdown = {
  total: number;
  category: "hot" | "warm" | "cold";
  parts: { factor: string; points: number; max: number; reason: string }[];
  version: string;
};

export const SCORING_VERSION = "v1";

const SOURCE_FIT: Record<string, number> = {
  referral: 25,
  website: 18,
  partner: 18,
  api: 15,
  event: 15,
  portal: 12,
  social: 10,
  ads: 10,
  cold: 5,
};

export function scoreLead(i: ScoreInput): ScoreBreakdown {
  const parts: ScoreBreakdown["parts"] = [];
  const name = (i.full_name ?? "").trim();
  parts.push({ factor: "Name", points: name.split(/\s+/).length >= 2 ? 10 : name ? 5 : 0, max: 10, reason: name ? "Name provided" : "No name" });
  parts.push({ factor: "Email", points: i.email ? 15 : 0, max: 15, reason: i.email ? "Email provided" : "No email" });
  parts.push({ factor: "Phone", points: i.phone ? 15 : 0, max: 15, reason: i.phone ? "Phone provided" : "No phone" });

  const msg = (i.message ?? "").trim();
  const msgPts = msg.length >= 80 ? 15 : msg.length >= 20 ? 8 : 0;
  parts.push({ factor: "Enquiry detail", points: msgPts, max: 15, reason: msg ? `${msg.length} characters of detail` : "No message" });
  parts.push({ factor: "Budget", points: i.budget && i.budget > 0 ? 10 : 0, max: 10, reason: i.budget ? "Budget stated" : "No budget" });
  const t = (i.timeline ?? "").toLowerCase();
  const tPts = /immediate|now|week|month|asap/.test(t) ? 10 : t ? 5 : 0;
  parts.push({ factor: "Timeline", points: tPts, max: 10, reason: t ? `Timeline: ${t}` : "No timeline" });

  const src = (i.source ?? "").toLowerCase();
  const fit = SOURCE_FIT[src] ?? 8;
  parts.push({ factor: "Source fit", points: fit, max: 25, reason: `Source "${src || "unknown"}"` });

  const total = Math.min(100, parts.reduce((s, p) => s + p.points, 0));
  const category = total >= 70 ? "hot" : total >= 40 ? "warm" : "cold";
  return { total, category, parts, version: SCORING_VERSION };
}

export function normalizeEmail(e?: string | null) {
  const v = (e ?? "").trim().toLowerCase();
  return v || null;
}
export function normalizePhone(p?: string | null) {
  const v = (p ?? "").replace(/[^\d+]/g, "");
  return v.length >= 6 ? v : null;
}
