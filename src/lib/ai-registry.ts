/** Registry of AI agents. Client-safe: no prompts or secrets. */
export type AgentId = "lead_qualification" | "deal_health" | "executive_briefing";

export type AgentDef = {
  id: AgentId;
  name: string;
  objective: string;
  allowedActions: string[];
  requiresApproval: string[];
  readScope: string;
  promptVersion: string;
  model: string;
  budget: { maxRunsPerDay: string; timeout: string };
  availability: "available" | "planned";
};

export const AGENTS: AgentDef[] = [
  {
    id: "lead_qualification",
    name: "Lead qualification",
    objective: "Summarise a lead, judge qualification, list missing information and suggest one next step with a draft message.",
    allowedActions: ["Read the lead it was asked about", "Read workspace memory", "Propose a task"],
    requiresApproval: ["Creating the task", "Sending any message"],
    readScope: "Only the lead the requesting person can already see, plus this workspace's memory.",
    promptVersion: "lead-qual-v2",
    model: "openai/gpt-6-astra",
    budget: { maxRunsPerDay: "Workspace daily limit", timeout: "One request, no automatic retries" },
    availability: "available",
  },
  {
    id: "deal_health",
    name: "Deal health",
    objective: "Explain why a deal may stall, citing its history, and suggest up to three recovery steps.",
    allowedActions: ["Read the deal it was asked about, its stage history, activities and tasks"],
    requiresApproval: ["Turning any recovery step into a task"],
    readScope: "Only the deal the requesting person can already see.",
    promptVersion: "deal-health-v1",
    model: "openai/gpt-6-sol",
    budget: { maxRunsPerDay: "Workspace daily limit", timeout: "One request, fallback provider on outage" },
    availability: "available",
  },
  {
    id: "executive_briefing",
    name: "Executive briefing",
    objective: "Narrate workspace metrics in plain language; every point must cite a computed metric.",
    allowedActions: ["Read aggregate metrics computed by the app"],
    requiresApproval: ["None — read-only, never changes data"],
    readScope: "Aggregate counts the requesting admin, manager or analyst can already see.",
    promptVersion: "exec-brief-v1",
    model: "openai/gpt-6-sol",
    budget: { maxRunsPerDay: "Workspace daily limit", timeout: "One request, fallback provider on outage" },
    availability: "available",
  },
];

export const RELEASE_STAGES = [
  { id: "shadow", label: "Testing", description: "Runs only in evaluations and sample-data workspaces. Real leads are not touched." },
  { id: "pilot", label: "Pilot", description: "Admins and managers can use it on real leads." },
  { id: "live", label: "Live", description: "Everyone who can edit leads can use it." },
] as const;
export type ReleaseStage = (typeof RELEASE_STAGES)[number]["id"];

export const MEMORY_KINDS = [
  { id: "verified_fact", label: "Verified fact" },
  { id: "interaction", label: "Interaction" },
  { id: "approved_knowledge", label: "Approved knowledge" },
  { id: "preference", label: "Team preference" },
  { id: "hypothesis", label: "AI hypothesis" },
] as const;

/** Minimum share of evaluation outputs rated "good" before a release can be approved. */
export const EVAL_PASS_THRESHOLD = 0.7;

export function getAgent(id: string) {
  return AGENTS.find((a) => a.id === id);
}
