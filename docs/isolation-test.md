# Two-workspace isolation test

Run as the database owner. Uses an existing user id, creates two sample workspaces via `seed_demo_tenant`,
removes the user from workspace B, then checks what the user can read/write. Ends with RAISE EXCEPTION so
all test data is rolled back.

Last result (2026-09-27): member of A sees leads=3 contacts=2 tasks=2; after removal from B the user sees
0 leads, contacts, tasks, deals, properties, AI memory, custom fields and the tenant row of B; updates/deletes
in B affect 0 rows; inserts into B leads and AI memory are blocked (42501).

The script is the DO block recorded in the project chat history of that date (search "Isolation Test A").
