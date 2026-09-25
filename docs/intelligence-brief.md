## Intelligent platform: learning and agentic execution

Treat intelligence as a core platform capability. Extend the architecture beyond an AI copilot to include specialized agents, persistent context, outcome-driven learning, and controlled autonomous execution.

### 1. Specialized agents

Implement agents with clear responsibilities:

- Intake agent: validate incoming leads, identify missing information, and resolve potential duplicates.
- Qualification agent: assess evidence, recommend qualification, and propose follow-up questions.
- Matching agent: match buyer requirements to available properties or offerings.
- Sales execution agent: prepare follow-ups, maintain next actions, and coordinate approved tasks.
- Deal health agent: detect stalled opportunities, missing stakeholders, and closure risks.
- Sales intelligence agent: analyze conversion patterns, source quality, and recommendations for managers.

Use an orchestrator to route work, coordinate handoffs, and track execution. Prefer deterministic workflows when the steps are known; use agent reasoning for ambiguous tasks.

Each agent must have a defined objective, allowed tools, permission scope, structured outputs, execution budget, timeout, retry policy, and escalation rules.

### 2. Persistent, permission-aware memory

Separate:

- Verified CRM facts.
- Interaction history.
- Tenant-approved business knowledge.
- User preferences.
- Agent-generated hypotheses.

Store provenance, timestamps, confidence, and expiry where appropriate. Do not promote an inference into a verified fact without evidence or approval.

Make memory tenant-isolated, inspectable, correctable, and deletable. Retrieve only information the current user and agent are authorized to access.

### 3. Outcome-driven learning

Capture meaningful feedback signals:

- Qualification accepted or rejected, with reasons.
- Recommendations accepted, edited, or dismissed.
- Responses to approved outreach.
- Site visits, offers, stage progression, and closure outcomes.
- Loss reasons, elapsed time, revenue, and human corrections.

Version the features, rules, prompts, models, recommendations, and decisions associated with each outcome.

Use this data to evaluate and improve lead scoring, matching, next-action recommendations, and workflow effectiveness. Account for incomplete outcomes, delayed closures, selection bias, and data leakage.

Start with transparent rules. Introduce trained predictive models only when sufficient representative data exists and they outperform the baseline on held-out outcomes.

### 4. Controlled improvement cycle

Implement this cycle:

Observe outcomes → propose an improvement → evaluate offline → approve → release to a limited cohort → monitor → promote or roll back.

Maintain an evaluation registry and version history. Never automatically change production prompts, scoring weights, permissions, or workflows without the configured release process.

Measure business outcomes alongside factual accuracy, tool-use correctness, safety, latency, and cost. Do not optimize solely for engagement or message volume.

Keep tenant learning isolated by default. Any cross-tenant learning must require explicit authorization and a documented data-governance design.

### 5. Graduated autonomy

Support configurable autonomy levels by agent and action:

1. Recommend only.
2. Prepare actions for human approval.
3. Execute explicitly authorized, low-risk actions.
4. Execute bounded workflows with monitoring and escalation.

Start at levels 1–2. Enable higher levels only after evaluation.

For autonomous execution, enforce action limits, communication preferences, frequency caps, spending limits, allowed tools, and stop conditions. External communications require review unless an administrator has explicitly authorized the relevant workflow.

Require human approval for contractual commitments, commercial-term changes, destructive actions, and final deal closure.

Provide pause controls, an emergency stop, and a readable audit trail explaining what happened and why.

### 6. Reliable agent execution

Persist agent runs and workflow state. Support durable jobs, event-triggered execution, scheduled work, safe retries, idempotent actions, and recovery after interruption.

Distinguish attempted, completed, failed, and uncertain external actions. Reconcile uncertain outcomes before retrying actions that could send duplicate messages or create duplicate records.

Treat external content as untrusted. Prevent prompt injection from granting permissions or changing tool policies.

### 7. Model and knowledge strategy

Use a provider-independent model interface. Select models through task-specific evaluations rather than assuming one model is best for everything.

Support structured outputs, tool calling, permission-aware retrieval, model fallback, and per-tenant usage budgets.

Use retrieval for changing business knowledge. Consider fine-tuning only when a measured need and suitable governed dataset justify it.

### 8. Delivery and acceptance

Add a dedicated intelligence milestone after reliable CRM and intake workflows exist.

First deliver one complete agent-assisted workflow:
lead received → evidence evaluated → missing information identified → next action proposed → human review → authorized execution → outcome captured.

Demonstrate that:

- Agent decisions are traceable to evidence and versioned logic.
- Unauthorized tool actions are blocked.
- Tenant memory never leaks across tenants.
- Human corrections influence subsequent recommendations appropriately.
- A proposed improvement is evaluated against a baseline before release.
- A poorly performing update can be rolled back.
- Interrupted workflows resume without duplicate external actions.

Clearly identify any external job runner, model service, or evaluation infrastructure needed beyond the Lovable application. Do not simulate learning or describe an unvalidated feedback loop as self-learning.