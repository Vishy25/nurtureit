<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Every tenant-scoped table carries `tenant_id` and enforces RLS through the `is_tenant_member` / `has_tenant_role` security-definer helpers, so one business can never read another's records.
- Roles live only in `public.memberships` (per tenant) and `public.platform_admins`; never store a role on `profiles`, to avoid privilege escalation.
- UI permission checks come from `src/lib/permissions.ts` and tenant selection from `src/lib/tenant-context.tsx`; they are convenience layers on top of RLS, never the only guard.
- Lead intake lives at `/api/public/intake/v1/leads`, authenticated by hashed per-workspace keys; processing shared in `src/lib/intake.server.ts` so retries reuse the same path. Why: one idempotent code path for live and replayed events.
- Industry templates only relabel menus/stages (`src/lib/industry-templates.ts`); the underlying stage enum stays fixed. Why: safe switching without data migration.
- AI calls run server-side in `src/lib/ai-assistant.functions.ts` under the caller's RLS session, with every run persisted in `ai_runs`. Why: traceability and tenant isolation for agent actions.
- AI agents are declared in `src/lib/ai-registry.ts`; release to real leads is gated by `ai_agent_settings.release_stage` and a DB trigger requiring an approved `ai_evaluations` row for the same prompt version. Why: no unevaluated prompt reaches real leads.
- Per-workspace config (stage labels, scoring rules, custom lead fields) is read via `useWorkspaceConfig` in `src/lib/workspace-config.ts`; scoring always goes through `scoreLead(input, config)`. Why: one source of truth for forms, intake and dashboards.

- RLS policies check membership via `tenant_id IN (SELECT private.my_tenants(roles))`; security-definer helpers live in schema `private`. Why: evaluated once per query (40x faster at 50k rows) and not callable from the public API.
- Offline writes for tasks/site visits go through `queueOp` in `src/lib/offline-queue.ts` (client ids + upsert). Why: safe retries without duplicates.
