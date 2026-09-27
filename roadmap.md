# SalesOS — build roadmap

Source brief: `docs/salesos-brief.md` (Master_Prompt). Implement one milestone at a time.

## Milestone 1 — Foundation (in progress)

- [x] Database schema: tenants, profiles, memberships, teams, team_members, invitations, audit_events, platform_admins
- [x] Roles enum + server-side permission helpers (`is_tenant_member`, `has_tenant_role`, `is_platform_admin`)
- [x] Row-level security on every table, tenant derived from authenticated membership
- [x] Email/password + Google authentication
- [x] Tenant creation, invitation issue/accept, role change, deactivation, tenant switching
- [x] Audit history view
- [x] Primary navigation shell with all sections routed
- [x] Two-tenant isolation test evidence (Sep 26 2026: workspace owner saw 3 leads / 2 deals; a second user saw 0 leads, 0 contacts, 0 deals; a non-member saw 0 across all tables)
- [x] Synthetic demo data across two isolated tenants (Administration → Workspaces → "Create two sample workspaces")

## Milestone 2 — Core workflow

- [x] Leads table + list/create/status change (source, score, owner, status, tags, next action, aging)
- [x] Lead detail, reassignment, qualification notes, lead→contact+deal conversion
- [x] Contacts and organizations with unified activity history
- [x] Opportunities + seven-stage pipeline with server-enforced transition rules and stage history
- [x] Tasks and reminders (due dates, overdue view, assigned-to-me)
- [x] Attachments
- [x] Property catalog (type, area, bedrooms, price, status, amenities)
- [x] Buyer preferences, rule-based matching, shortlists, site visits, offers
- [x] Lead conversion preserving source attribution and history
- [x] Productivity: search, filters, saved views, bulk assignment, CSV import/export, duplicate review

## Milestone 3 — Agent intake

- [x] Versioned intake API + webhook with tenant-scoped credentials (rotation/revocation)
- [x] Payload validation, idempotency, replay protection, rate limits, correlation IDs
- [x] Ingestion event log, processing state, retry history, failed-event review queue
- [x] Normalization, in-tenant duplicate detection, provenance preservation
- [x] Deterministic explainable scoring engine (fit, intent, completeness, category) with history and overrides
- [x] Assignment rules + automatic follow-up task

## Milestone 4 — Intelligence (agentic platform; starts only after M2 + M3 are reliable)

Source: `docs/intelligence-brief.md`.

- [~] Orchestrator + agent registry (registry done; deal health agent planned) (intake, qualification, matching, sales execution, deal health, sales intelligence), each with objective, allowed tools, permission scope, structured output, budget, timeout, retry and escalation rules
- [x] Deterministic workflows first (rule-based deal health + automations)
- [x] Tenant-isolated memory split: verified facts / interactions / approved knowledge / user preferences / agent hypotheses, with provenance, confidence, expiry; inspect, correct, delete
- [~] Outcome capture (recommendation accept/edit/dismiss + feedback done; feeds later suggestions) (qualification accept/reject, recommendation accept/edit/dismiss, stage moves, losses, revenue, corrections) linked to versioned rules, prompts, models
- [~] Improvement cycle (human-rated evaluation + approval gate before pilot/live done; automated baselines pending): evaluation registry, offline eval vs baseline, approval, limited cohort, monitor, promote or roll back
- [~] Graduated autonomy per agent/action (done: workspace level, emergency stop, daily run cap; pending: per-agent levels) (start at levels 1–2); caps, stop conditions, pause + emergency stop; human approval for contracts, commercial terms, destructive actions, deal closure
- [~] Durable agent runs (done: persisted runs with status/model/prompt version, duplicate-run guard, untrusted-data prompt containment; pending: resume/reconcile): persisted state, idempotent actions, attempted/completed/failed/uncertain tracking, reconciliation before retry, prompt-injection containment
- [ ] Provider-independent model interface, per-task evaluation, fallback, per-tenant usage budgets
- [x] First end-to-end workflow (lead qualification assistant: analyze → missing info → next action → human approve/edit/dismiss → task created → outcome + feedback stored): lead received → evidence evaluated → missing info → next action → human review → authorized execution → outcome captured
- [ ] Acceptance evidence: traceability, blocked unauthorized tools, no cross-tenant memory, corrections influence later recommendations, eval-before-release, rollback, resume without duplicates
- [x] Workflow automation with execution history, loop prevention, disable controls (Administration → Automations)
- [x] Dashboards with documented metric definitions (Reports)
- [x] Document external infrastructure needed (docs/operations.md)

## Milestone 4b — Executive dashboards & mobile

- [~] Role-based dashboards, targets, forecast snapshots (done; Reports page) — AI briefing citing sources pending
- [x] Mobile-friendly layouts, quick actions, installable web app, in-app notification centre (lead/task assignment, incoming leads, AI suggestions)
- [ ] Later: offline notes/tasks/visit outcomes with sync; native store apps separately

## Milestone 5 — Configuration

- [x] Industry templates, terminology, typed custom fields, pipeline/stage configuration
- [ ] Scoring rules, assignment policies, task templates, notifications, trigger-condition-action workflows
- [ ] Template versioning with safe stage mapping
- [x] Software-sales template working without code changes (select in Settings)
- [x] Starter templates: book sales, agriculture produce, retreat sales, senior living

## Milestone 6 — Hardening

- [ ] End-to-end verification of the acceptance criteria
- [~] Tenant-aware indexes, bounded queries, load-test plan done (docs/operations.md); pagination + measurements pending
- [ ] Structured logs, error monitoring, job status, integration health, cost visibility
- [x] Environment, secrets, migration, backup/restore and deployment documentation (docs/operations.md)

## Decisions (Sep 2026)

- AI autonomy chosen per workspace by admin; default suggest-only.
- Incoming leads are manager-assigned (unassigned follow-up task created).
- Templates: real estate, B2B services, software, SaaS, B2C products, staffing. Custom fields still open.
- Attachments max 10 MB.

## Open assumptions (recorded, revisit if wrong)

- A workspace = one tenant; anyone signed in may create a workspace and becomes its administrator.
- Invitation delivery by email is not connected; codes are shared manually until an email provider is configured.
- Platform administrators are granted by inserting into `platform_admins`; no self-service path.
- Default currency per tenant is USD; no cross-currency conversion policy yet.

## Current request (Sep 27)
- [x] AI agent registry, tenant-isolated memory, evaluation + release cycle (shadow → pilot → live)
- [x] AI suggestions in alert bell, opening the lead panel to act
- [x] Custom lead fields; per-workspace stage labels and scoring rules
- [x] Two-workspace isolation test with demo data (leads, contacts, tasks)
- [x] Role-based dashboards: leads, conversions, pipeline stages, tasks, property activity

## Current request (Sep 27, "implement them all") — batches 1–2 done; remaining: per-agent autonomy, run resume, model fallback/budgets, assignment policies/task templates, template versioning, pagination, monitoring, offline, security warnings, email invites
