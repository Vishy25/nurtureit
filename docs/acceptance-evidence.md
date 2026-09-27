# Milestone 4 acceptance evidence

Script: `docs/acceptance-evidence.sql` (runs as database owner, everything rolled back).
Last run: 2026-09-27 — all passed.

| # | Check | Result |
|---|-------|--------|
| 1 | Workspace B AI memory invisible to non-member; insert into B blocked | visible=0, insert blocked |
| 2 | Sales rep cannot change assistant release settings | blocked |
| 3 | Stage skipping and direct stage edits bypassing transition rules | both blocked |
| 4 | Users cannot forge notifications | blocked |
| 5 | Release to pilot without approved evaluation for the same prompt version | blocked by trigger |
| 6 | Release to live with approved evaluation, then roll back to testing | succeeded |
| 7 | Admin can set emergency stop | succeeded |

Evaluation baseline: each evaluation compares AI qualification to the deterministic scoring rules ("agrees with rules x/y") alongside human ratings.
Deal-health and briefing assistants are advisory only: they cite evidence ids, drop uncited claims, and never change data without a person approving.


## Run Sep 27 2026

`1 memory of B visible=0 insert=blocked | 2 rep release=blocked | 3 skip=blocked direct-edit=blocked | 4 forge=blocked | 5 ungated pilot=blocked | 6 live-then-rollback ok=t | 7 emergency stop set=t | 8 outcomes of B visible=0 first claim=1 second claim=0`

Isolation: `A visible: leads=3 contacts=2 tasks=2 | B visible: all 0 | B updated=0 | B insert blocked=yes`. Signed-in walk of 18 pages: 0 console/page errors.
