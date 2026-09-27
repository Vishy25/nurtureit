/** Deterministic, explainable deal health. Rules run first; AI is only for ambiguous cases. */
export type DealHealthInput = {
  state: string;
  stage: string;
  value: number | null;
  expected_close: string | null;
  follow_up_at: string | null;
  updated_at: string;
  contact_id?: string | null;
};
export type DealHealth = { score: number; level: "healthy" | "at_risk" | "critical" | "closed"; reasons: string[] };

const DAY = 86_400_000;

export function dealHealth(d: DealHealthInput, now = Date.now()): DealHealth {
  if (d.state === "won" || d.state === "lost") return { score: 100, level: "closed", reasons: [] };
  let score = 100;
  const reasons: string[] = [];
  const idle = Math.floor((now - new Date(d.updated_at).getTime()) / DAY);
  if (idle > 30) { score -= 35; reasons.push(`No change for ${idle} days`); }
  else if (idle > 14) { score -= 20; reasons.push(`No change for ${idle} days`); }
  if (!d.expected_close) { score -= 15; reasons.push("No expected close date"); }
  else if (new Date(d.expected_close).getTime() < now - DAY) { score -= 25; reasons.push("Expected close date has passed"); }
  if (d.value == null || Number(d.value) <= 0) { score -= 10; reasons.push("No deal value"); }
  if (d.contact_id === null) { score -= 10; reasons.push("No linked contact"); }
  if ((d.state === "on_hold" || d.state === "nurturing") && d.follow_up_at && new Date(d.follow_up_at).getTime() < now - DAY) {
    score -= 25; reasons.push("Follow-up date overdue");
  }
  score = Math.max(0, score);
  return { score, level: score >= 70 ? "healthy" : score >= 40 ? "at_risk" : "critical", reasons };
}

export const HEALTH_LABEL: Record<DealHealth["level"], string> = {
  healthy: "Healthy", at_risk: "At risk", critical: "Critical", closed: "Closed",
};
