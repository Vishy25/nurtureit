# SalesOS — operations guide

## Environments
- One Lovable Cloud backend serves both preview and the published app. Test with synthetic demo workspaces, never real client data.
- Browser config: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (auto-managed).
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` (AI). Never exposed to the browser.

## Migrations
- All schema changes are SQL migrations in `supabase/migrations/`, applied in order. Every public table: GRANT → enable RLS → tenant policies via `is_tenant_member` / `has_tenant_role`.
- Re-run `docs/isolation-test.sql` after any policy change.

## Backup / restore
- Lovable Cloud takes automatic daily database backups. Restore is requested through Lovable support / Cloud settings.
- Per-workspace export: Leads → Export CSV (admins/managers/analysts).
- Attachments live in a private storage bucket; include it in any restore request.

## Deployment
- Publish from the editor. Frontend changes need re-publish; database migrations apply immediately to the shared backend.
- Intake partners call `https://<published-domain>/api/public/intake/v1/leads` with a per-workspace key.

## Monitoring
- Intake: Integrations page shows event log, failures and retries.
- AI: Administration → AI shows runs, failures, duration, daily cap, emergency stop.
- Audit: Administration → Audit for member/config changes.

## External infrastructure not yet provisioned
- Scheduled job runner (e.g. nightly forecast snapshots, scheduled AI evaluations, reminder emails) — today these are manual buttons.
- Email provider for invitations and reminders.
- Error-monitoring service beyond platform logs.

## Performance
- Tenant-aware composite indexes on leads, contacts, opportunities, tasks, activities, audit, AI runs, notifications and intake events.
- List queries are bounded (500–5,000 rows); Leads paginate 200 per page.
- Load test (Sep 2026, rolled back): 50,000 leads in one workspace + 10,000 in another, measured as a signed-in admin under RLS.
  - Before policy optimization: first page 35 ms, full count 1.5 s, filtered search 1.8 s, dashboard aggregate 1.8 s.
  - After rewriting membership checks to `tenant_id IN (SELECT private.my_tenants(...))` (evaluated once per query): first page 10 ms, count 38 ms, search 57 ms, dashboard aggregate 57 ms. Other workspace visible rows: 0.
  - Target <2 s met. Intake throughput is capped at 60 req/min per key by design.
