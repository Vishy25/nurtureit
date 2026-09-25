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
