# SalesOS — architecture brief (Milestone 1)

Multi-tenant, AI-enabled sales CRM. Real estate is the first complete template; the core is
industry-neutral and extended through configuration.

## Modules

| Module | Responsibility |
| --- | --- |
| Identity & tenancy | Accounts, workspaces (tenants), memberships, teams, invitations, audit |
| CRM records | Leads, contacts, organizations, opportunities, activities, documents |
| Pipelines & workflow | Stages, transition rules, tasks, automation |
| Intake & integrations | Agent intake API, webhooks, providers |
| Scoring & AI | Deterministic scoring engine, AI copilot |
| Reporting & administration | Dashboards, configuration, platform operations |

## Entity model (implemented in Milestone 1)

```text
tenants ──< memberships >── auth users ── profiles
   │            │
   │            └── role: tenant_admin | sales_manager | sales_rep | ops_coordinator | analyst
   ├──< teams ──< team_members
   ├──< invitations (email, role, token, expiry)
   └──< audit_events (actor, action, entity, metadata)

platform_admins (separate from tenant membership)
```

Every tenant-owned table carries `tenant_id`. Future CRM tables follow the same rule.

## Tenant isolation

- Tenant access is derived from the authenticated user's active membership, never from a
  client-supplied tenant identifier.
- `is_tenant_member`, `has_tenant_role` and `is_platform_admin` are `SECURITY DEFINER` helpers used
  by row-level security policies; execution is revoked from anonymous callers.
- Tenant creation and invitation acceptance run in `SECURITY DEFINER` functions that derive the
  actor from `auth.uid()` and write an audit event.
- Platform administration lives in its own table, separate from ordinary customer-data access.

## Permission matrix

Enforced in the database; mirrored in `src/lib/permissions.ts` for the interface. See
Administration → Overview in the app for the rendered matrix.

## Not yet built

Everything listed in `roadmap.md` under Milestones 2–6. No part of the interface simulates data or
a provider connection.
