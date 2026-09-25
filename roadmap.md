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
- [ ] Automated two-tenant isolation test evidence
- [ ] Seeded synthetic demo data across two isolated tenants

## Milestone 2 — Core workflow

- [ ] Leads (source, qualification, score, owner, status, tags, next action, aging)
- [ ] Contacts and organizations with unified activity history
- [ ] Opportunities + seven-stage pipeline with server-enforced transition rules and stage history
- [ ] Activities, tasks, reminders, attachments
- [ ] Property catalog, buyer preferences, shortlists, site visits, offers
- [ ] Lead conversion preserving source attribution and history
- [ ] Productivity: search, filters, saved views, bulk assignment, CSV import/export, duplicate review

## Milestone 3 — Agent intake

- [ ] Versioned intake API + webhook with tenant-scoped credentials (rotation/revocation)
- [ ] Payload validation, idempotency, replay protection, rate limits, correlation IDs
- [ ] Ingestion event log, processing state, retry history, failed-event review queue
- [ ] Normalization, in-tenant duplicate detection, provenance preservation
- [ ] Deterministic explainable scoring engine (fit, intent, completeness, category) with history and overrides
- [ ] Assignment rules + automatic follow-up task

## Milestone 4 — Intelligence

- [ ] AI copilot (summaries, missing information, next actions, drafts, property matching, pipeline risks)
- [ ] Review-before-send for external communications and high-risk actions
- [ ] Workflow automation with execution history, retries, loop prevention, disable controls
- [ ] Dashboards with documented metric definitions

## Milestone 5 — Configuration

- [ ] Industry templates, terminology, typed custom fields, pipeline/stage configuration
- [ ] Scoring rules, assignment policies, task templates, notifications, trigger-condition-action workflows
- [ ] Template versioning with safe stage mapping
- [ ] Software-sales template working without code changes
- [ ] Starter templates: book sales, agriculture produce, retreat sales, senior living

## Milestone 6 — Hardening

- [ ] End-to-end verification of the acceptance criteria
- [ ] Pagination, tenant-aware indexes, bounded queries, load-test plan and measurements
- [ ] Structured logs, error monitoring, job status, integration health, cost visibility
- [ ] Environment, secrets, migration, backup/restore and deployment documentation

## Open assumptions (recorded, revisit if wrong)

- A workspace = one tenant; anyone signed in may create a workspace and becomes its administrator.
- Invitation delivery by email is not connected; codes are shared manually until an email provider is configured.
- Platform administrators are granted by inserting into `platform_admins`; no self-service path.
- Default currency per tenant is USD; no cross-currency conversion policy yet.
