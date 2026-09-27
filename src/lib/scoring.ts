/**
 * Deterministic, explainable lead scoring. Same input always yields the same score.
 * Weights: completeness 40, intent 35, fit 25.
 */
export type ScoreInput = {
  full_name?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  source?: string | null | undefined;
  message?: string | null | undefined;
  budget?: number | null | undefined;
  timeline?: string | null | undefined;
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

/** Per-workspace scoring rules. Weights are the maximum points per factor; thresholds split hot/warm/cold. */
export type ScoringConfig = {
  weights: { name: number; email: number; phone: number; detail: number; budget: number; timeline: number; source: number };
  sources: Record<string, number>; // 0–25 source fit before weighting
  hot: number;
  warm: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  weights: { name: 10, email: 15, phone: 15, detail: 15, budget: 10, timeline: 10, source: 25 },
  sources: SOURCE_FIT,
  hot: 70,
  warm: 40,
};

export function resolveScoring(raw: unknown): ScoringConfig {
  const r = (raw ?? {}) as Partial<ScoringConfig>;
  return {
    weights: { ...DEFAULT_SCORING.weights, ...(r.weights ?? {}) },
    sources: { ...DEFAULT_SCORING.sources, ...(r.sources ?? {}) },
    hot: typeof r.hot === "number" ? r.hot : DEFAULT_SCORING.hot,
    warm: typeof r.warm === "number" ? r.warm : DEFAULT_SCORING.warm,
  };
}

const DEFAULT_MAX = { Name: 10, Email: 15, Phone: 15, "Enquiry detail": 15, Budget: 10, Timeline: 10, "Source fit": 25 } as const;
const WEIGHT_KEY = { Name: "name", Email: "email", Phone: "phone", "Enquiry detail": "detail", Budget: "budget", Timeline: "timeline", "Source fit": "source" } as const;

export function scoreLead(i: ScoreInput, config?: ScoringConfig | null): ScoreBreakdown {
  const cfg = config ?? DEFAULT_SCORING;
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
  const fit = cfg.sources[src] ?? 8;
  parts.push({ factor: "Source fit", points: fit, max: 25, reason: `Source "${src || "unknown"}"` });

  // Apply workspace weights, then normalise to 0–100
  for (const p of parts) {
    const f = p.factor as keyof typeof DEFAULT_MAX;
    const w = Math.max(0, cfg.weights[WEIGHT_KEY[f]]);
    p.points = Math.round((p.points / DEFAULT_MAX[f]) * w);
    p.max = w;
  }
  const maxSum = parts.reduce((s, p) => s + p.max, 0) || 1;
  const total = Math.min(100, Math.round((parts.reduce((s, p) => s + p.points, 0) / maxSum) * 100));
  const category = total >= cfg.hot ? "hot" : total >= cfg.warm ? "warm" : "cold";
  return { total, category, parts, version: config ? `${SCORING_VERSION}-custom` : SCORING_VERSION };
}

export function normalizeEmail(e?: string | null) {
  const v = (e ?? "").trim().toLowerCase();
  return v || null;
}
export function normalizePhone(p?: string | null) {
  const v = (p ?? "").replace(/[^\d+]/g, "");
  return v.length >= 6 ? v : null;
}
