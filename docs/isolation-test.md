# Two-workspace isolation test

Script: `docs/isolation-test.sql` (run as database owner; rolls itself back by raising `RESULT ...`).

Last result (2026-09-27, re-run): A visible leads=3 contacts=2 tasks=2 | B visible leads=0 contacts=0 tasks=0 deals=0 tenant=0 | B updated=0 | B insert blocked=yes.
