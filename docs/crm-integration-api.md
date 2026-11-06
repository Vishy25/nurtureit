# SalesOS CRM integration v1

## Availability and setup

API base: `https://nurtureit.lovable.app/api/crm/v1` after publishing this release. Local verification uses `http://localhost:8080/api/crm/v1`.

A workspace administrator creates a **CRM key** under **Integrations → CRM connections**. Keys expire after 90 days and appear only once. Store keys server-side, never in website JavaScript. Old `sos_` intake keys do not authorize CRM reads or updates. Create one CRM key per source and revoke it independently.

Scopes: `crm:read` (workspace-wide reads), `crm:write` (allowed patches and enquiry creation), `crm:assign` (owner mappings/explicit assignment), `crm:references` (external-reference registration). A write key does not imply read or assignment access. Keys stop working if revoked, expired, their issuing administrator is no longer an active workspace administrator, or the workspace is inactive. Each key is limited to 120 requests/minute.

Every request uses `Authorization: Bearer <CRM key>`. No browser-session credential is required by the handler. These private-data APIs are deliberately outside `/api/public`; test external access after publishing, especially if published-site visibility is private. Private-site platform access may be an additional boundary; never move these data APIs to `/api/public` to bypass it.

## Endpoints

Entities: `leads`, `contacts`, `organizations`, `opportunities`, `properties`, `tasks`, `enquiries`.

| Method | Path | Purpose | Scope |
|---|---|---|---|
| GET | `/{entity}?limit=50&offset=0` | List records, max 100/page | read |
| GET | `/{entity}/{uuid}` | Independent by-ID lookup | read |
| GET | `/{entity}?source_system=estateorbit&external_id=...` | External-ID lookup | read |
| PATCH | `/{entity}/{uuid}` | Partial update, allowed fields only | write |
| PUT | `/references` | Register/update a reference to an existing CRM record | references |
| GET | `/owners` | List first 100 owner mappings | read |
| PUT | `/owners` | Map an external agent to an active CRM seller | assign |
| POST | `/enquiries` | Transactional enquiry submission | write |
| GET | `/enquiries?lead_id={uuid}` | Enquiries for one lead | read |

List response: `{ "data": [...], "next_offset": 50 }`; final page uses `null`. Single read/patch/reference response: `{ "data": { ... } }`.

Errors: 401 invalid/revoked/expired key; 403 scope or inactive administrator/workspace; 404 target absent or belongs to another workspace; 409 conflicting external reference; 422 validation; 429 rate limit; 500 unexpected failure. Responses use `Cache-Control: no-store`. Bodies are limited to 64 KB.

### Register website property IDs

```json
{
  "source_system": "estateorbit",
  "entity_type": "properties",
  "external_id": "listing-101",
  "entity_id": "<existing CRM property UUID>"
}
```

`PUT /references`. Reference uniqueness: workspace + source + entity type + external ID. An external ID cannot point outside its workspace. This does not create properties; establish the CRM catalog first.

### Submit a structured enquiry

```json
{
  "source_system": "estateorbit",
  "external_id": "visitor-enquiry-001",
  "property_external_id": "listing-101",
  "full_name": "Jane Example",
  "email": "jane@example.com",
  "phone": "+15550123456",
  "message": "Please arrange a viewing",
  "budget": 500000,
  "timeline": "this month",
  "custom_fields": {"bedrooms": 3}
}
```

Provide exactly one of `property_id` or `property_external_id`. Provide either `lead_id`, or `full_name` with email/phone. Email and phone are normalized. Property and lead references must belong to the key's workspace. Budget is non-negative; message max 5,000 characters; source is 1–80 alphanumeric/underscore/hyphen characters; external ID max 200.

A new visitor creates an unassigned lead and an unassigned follow-up task. Workspace scoring is calculated deterministically. Repeat visitors matched by normalized email/phone reuse their lead but preserve each distinct enquiry. `custom_fields` accepts up to 50 scalar values; it is not automatically checked against workspace custom-field definitions. Keep an agreed field mapping.

Response: `{ "enquiry": {"id":"...","lead_id":"...","property_id":"...", ...}, "replayed": false }`, HTTP 201. Replaying workspace + source + external ID returns the original enquiry with `replayed:true`, HTTP 200, without creating another lead/task/enquiry. The first payload wins; a changed replay does not overwrite it. Use PATCH to correct it. Concurrent replay is serialized transactionally. New enquiry and dependent writes commit together. A normal CRM conversion links existing enquiries to the resulting contact and opportunity.

### Owner mapping and assignment

`PUT /owners`:
```json
{"source_system":"estateorbit","external_owner_id":"agent-42","user_id":"<CRM member UUID>"}
```

Only active administrator/manager/representative members of the same workspace may be owners. Obtain member UUIDs from your workspace's administrator; no public user-directory API exists.

Explicitly assign with `PATCH /leads/{id}` (or contacts, organizations, opportunities, tasks):
```json
{"source_system":"estateorbit","external_owner_id":"agent-42"}
```

Requires both write and assign scopes. `external_owner_id:null` unassigns. Direct `owner_id`, `assignee_id`, `tenant_id`, creator, and timestamp mutations are rejected. Incoming enquiries never auto-assign an owner.

### Allowed patch fields

- Leads: full_name, email, phone, notes, status (new/accepted/nurturing/disqualified), tags, next_action, next_action_at, custom_fields, external owner.
- Contacts: full_name, email, phone, title, notes, organization_id, custom_fields, external owner.
- Organizations: name, industry, website, phone, notes, external owner.
- Opportunities: name, value, expected_close, contact_id, organization_id, lead_id, external owner.
- Properties: title, location, project, price, status, notes.
- Tasks: title, notes, status (open/done/cancelled; completed alias maps to done), due_at, lead_id, contact_id, opportunity_id, external owner. Completion timestamp maintained automatically.
- Enquiries: message, status (new/contacted/qualified/closed), budget, timeline, contact_id, opportunity_id, custom_fields.

Unknown fields are rejected. Relationship UUIDs must resolve within the workspace. Deal stage/state, commercial closure and conversion remain human-authorized CRM operations; there is no unrestricted stage/closure patch. These APIs are not a general-purpose create/delete/upsert API for every entity and do not execute AI agents.

## Outbound CRM webhooks

Administrator registers an HTTPS destination and selects `{entity}.created` / `{entity}.updated` events under Integrations. Signing secret appears once; save it in the receiver. Reads by ordinary clients cannot retrieve stored signing secrets.

Minimal envelope (no lead/contact PII):
```json
{"id":"event-uuid","type":"enquiries.created","tenant_id":"workspace-uuid","occurred_at":"ISO timestamp","data":{"id":"record-uuid","entity_type":"enquiries","tenant_id":"workspace-uuid"}}
```

Receiver uses the read API to retrieve authorized details. Headers: `webhook-id`, `webhook-timestamp` (Unix seconds), `webhook-signature` (Standard Webhooks v1). Verify the unmodified body using `standardwebhooks` before processing:

```ts
import { Webhook } from 'standardwebhooks';
const event = new Webhook(process.env.CRM_WEBHOOK_SECRET).verify(rawBody, {
  'webhook-id': headers.get('webhook-id'),
  'webhook-timestamp': headers.get('webhook-timestamp'),
  'webhook-signature': headers.get('webhook-signature'),
});
// Persist/deduplicate event.id, enqueue processing, then return HTTP 2xx.
```

At-least-once delivery: duplicate events are possible, particularly after receiver success with interrupted acknowledgement. Events have stable IDs; no strict ordering guarantee. Enqueue occurs in the same transaction as the CRM change, including changes made in the CRM UI. Five jobs are claimed per batch with a two-minute lease. Retry backoff starts at 30 seconds and caps at one hour; eight attempts then failed review. **Deliver pending** processes due work; **Retry delivery** restarts a failed delivery with the same event ID.

Changes wake the delivery route immediately through one-time hashed tokens. A managed half-hour recovery job wakes pending work after missed calls; retries may wait up to roughly 30 minutes beyond the next-attempt time. The recovery job runs 48 times/day and adds recurring Cloud usage. It is recovery, not a promise of sub-minute delivery. Automatic callbacks point to the published URL, so publication is required. Scheduler timing can spread by about 30 seconds.

Destination protection: public HTTPS domain, port 443, no credentials/redirects/internal names/literal IPs; public DNS validation on every delivery, public IPv4 required. HTTPS transport pins the validated address and retains the original TLS hostname. Production transport and external delivery need a post-publish test with the team's receiver; local tests do not establish Worker compatibility or platform accessibility.

## Verification and team acceptance

Automated tests: `src/lib/crm-contract.test.ts`, `tests/crm-integration.test.ts`; synthetic fixture setup: `tests/setup-crm-e2e.ts`. Run on a disposable/test backend, with privileged test credentials available only to the test runner. Fixtures hold secrets under `/tmp`, not in source control. Never share fixture files or credential values.

```sh
lovable auth-session --json --self
bun tests/setup-crm-e2e.ts
CRM_E2E_FIXTURES=/tmp/browser/crm/fixtures.json bunx vitest run src/lib/crm-contract.test.ts tests/crm-integration.test.ts
```

Setup uses the minted session file or `CRM_TEST_SESSION_FILE`; `CRM_E2E_FIXTURES` overrides the fixture path. Every run creates two clearly labelled sample workspaces. Revoke test keys/disable synthetic subscriptions afterward.

Tests cover real localhost API calls, external property references, transactional enquiry creation, concurrent replay, repeat enquiry preservation, independent lead read/update, contact/task updates, scopes, owner mapping, cross-workspace reads/writes/foreign keys, pagination, exact rate limit, expiry, inactive administrator, conversion links and revocation. Webhook receiver/DNS failures are simulated while real database leases/status/retry and Standard Webhooks signature verification are exercised. A real pinned HTTPS request was checked separately. Signed-in desktop/mobile verification covers enquiry readback, key creation/use/revocation.

Still required from the team's environment: publish this release, select the real receiving HTTPS URL, register its subscription, verify signature and event deduplication there, configure website source IDs and agreed field mapping, then run website → CRM → webhook → website readback with real test inputs. No claim of HubSpot feature parity or EstateOrbit production acceptance is made.
