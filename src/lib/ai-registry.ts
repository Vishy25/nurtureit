/** Registry of AI agents. Client-safe: no prompts or secrets. */
export type AgentId = "lead_qualification" | "deal_health";

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
    objective: "Flag stalled or at-risk deals and suggest recovery steps.",
    allowedActions: ["Read deals and their history"],
    requiresApproval: ["All actions"],
    readScope: "Deals the requesting person can see.",
    promptVersion: "deal-health-v0",
    model: "openai/gpt-6-astra",
    budget: { maxRunsPerDay: "Workspace daily limit", timeout: "—" },
    availability: "planned",
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
