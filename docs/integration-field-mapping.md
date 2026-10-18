# Website → CRM field mapping (lead intake)

For development teams integrating a website or external AI program with SalesOS.
Endpoint, authentication and operational rules are in `docs/operations.md`; this
document covers how submitted fields map into the CRM data model.

## Endpoint contract (summary)

```
POST /api/public/intake/v1/leads
Authorization: Bearer sos_...        # per-workspace intake key (hashed at rest)
Idempotency-Key: <unique id>         # required, ≤200 chars; replay returns original result
X-Timestamp: <unix seconds>          # must be within ±5 minutes of server time
Content-Type: application/json       # body ≤64 KB
```

Rate limit: 60 requests/minute/key. Responses: `201` created, `200` duplicate/replay,
`422` validation failure, `401/400/413/429` as described in `docs/operations.md`.

## Field mapping: request JSON → `leads` table

| Website field | Request key | CRM column | Rules |
| --- | --- | --- | --- |
| Full name | `full_name` | `leads.full_name` | **Required.** Trimmed, 1–200 chars |
| Email | `email` | `leads.email` | Trimmed + lowercased on intake; optional, ≤255 |
| Phone | `phone` | `leads.phone` | Non-digits stripped (keeps `+`); optional, ≤40; kept only if ≥6 chars remain |
| Source / channel | `source` | `leads.source` | Optional, ≤60 chars, default `api` — e.g. `website`, `contact-form`, `landing-page-oct` |
| Enquiry message | `message` | `leads.notes` | Optional, ≤5000 chars |
| Budget | `budget` | `leads.provenance.budget` | Optional number ≥0. Stored in provenance, not a top-level column |
| Timeline | `timeline` | `leads.provenance.timeline` | Optional free text, ≤100 chars |
| Tags | `tags` | `leads.tags` | Optional array, ≤20 tags × ≤40 chars. The score category (e.g. `hot`) is appended automatically |
| Your system's ID | `external_id` | `leads.provenance.external_id` | Optional, ≤200 chars. Use for cross-reference and replays |

**At least one of `email` or `phone` must be present**, otherwise the event fails
with `422`.

## Fields the caller cannot set

These are system-owned; the API ignores client attempts to control them:

- `tenant_id` — derived from the intake key (one key = one workspace).
- `status` — always starts at `new`.
- `score` — computed by the workspace's deterministic scoring engine; a score
  history row is written with the breakdown.
- `owner_id` — always `null` on intake; a manager assigns the owner (this is the
  configured policy: incoming leads wait for manager assignment).
- `created_by` — the intake credential's owner.
- `custom_fields` — not accepted through the intake API. If the website collects
  extra questions, pass them inside `message` or as `tags`, or submit them after
  mapping by the CRM team.

## What happens on submit

1. Key is validated (SHA-256 hash lookup, revocable from **Integrations**).
2. Timestamp freshness and rate limit are enforced.
3. Idempotency: a repeated `Idempotency-Key` in the same workspace returns the
   original result with `replayed: true` — safe retries, no duplicate leads.
4. In-workspace duplicate check on normalized email/phone: a match marks the
   event `duplicate`, links it to the existing lead and appends an activity
   note ("Repeat enquiry received via …") instead of creating a second lead.
5. On success a lead is created plus an unassigned follow-up task
   ("Assign & contact new lead", due in 4 hours) and admin/manager
   notifications fire.

## Example

```json
{
  "full_name": "Jane Doe",
  "email": "Jane.Doe@Example.com",
  "phone": "+1 (555) 010-0123",
  "source": "website",
  "message": "Looking for a 3BHK near the north campus, budget around 450k",
  "budget": 450000,
  "timeline": "this quarter",
  "tags": ["3bhk", "north-campus"],
  "external_id": "webform-2026-001234"
}
```

Stored as:

| CRM column | Stored value |
| --- | --- |
| `full_name` | `Jane Doe` |
| `email` | `jane.doe@example.com` |
| `phone` | `+15550100123` |
| `source` | `website` |
| `notes` | `Looking for a 3BHK near the north campus, budget around 450k` |
| `tags` | `["3bhk","north-campus","<score category>"]` |
| `provenance.budget` | `450000` |
| `provenance.timeline` | `this quarter` |
| `provenance.external_id` | `webform-2026-001234` |
| `provenance.channel` | `intake_api` |
| `status` | `new` |
| `score` | computed by the workspace scoring config |
| `owner_id` | `null` (manager assigns) |

Response `201`:

```json
{ "event_id": "…", "status": "processed", "lead_id": "…" }
```

## Wider data model (context)

Intake writes only to `leads`. Downstream records — contacts, organizations,
opportunities, tasks, properties, site visits, offers — are created by CRM users
(e.g. via the **Convert lead** action), not through the intake API. There is
currently no public read/update API for CRM records; if the website needs to
display or edit CRM data, that requires additional integration work.
