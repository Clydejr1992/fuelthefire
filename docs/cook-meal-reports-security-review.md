# Cook Meal Reports — Static Security Review (2026-10-17)

Status: **BLOCKED — not safe to merge or deploy.** This is a code-review note for the feature branch, not evidence of a runtime test. No production schema, function, or website change was made during this review.

## Critical finding: Cook can potentially invoke inventory RPCs

The existing `supabase/migrations/001_employee_inventory.sql` defines `public.record_inventory_movement(...)` as `SECURITY DEFINER`. Its authorization checks require an active signed-in user, then restrict selected movement types (`receive`, `adjustment`, `transfer`, `count`, `correction`) to managers/admins. The ordinary `use` and `waste` movement types are allowed for any active signed-in user. Migration 006 grants execute on this RPC to all `authenticated` users.

The proposed Cook role is an authenticated user, so hiding inventory screens and redirecting Cook users in JavaScript does **not** stop direct RPC calls. If the role is added without a server-side role denial, a Cook may be able to call `record_inventory_movement` directly with `use` or `waste` and change stock. `record_employee_stock_use` also remains executable by all authenticated users and needs an explicit policy decision for Cook accounts.

### Required fix before a Cook account is used

- Add and test server-side role authorization inside every inventory/purchasing RPC that should not be callable by a Cook. For this existing RPC, reject role `cook` before any product lookup or mutation. Keep the existing employee, manager, and admin permissions unchanged.
- Review every other SECURITY DEFINER function, table grant, view, and RLS policy for the Cook role, including employee inventory and purchasing.
- Do not rely on client route guards, hidden navigation, or the absence of a button as a security boundary.
- Test direct PostgREST RPC calls as a Cook and verify rejection plus unchanged product balances and no new transaction/audit rows.

## Other blockers found in the draft report schema

1. The draft migration grants authenticated users direct `INSERT, UPDATE` on `meal_reports`. The Cook update policy permits `draft` and `returned` statuses and does not fully freeze server-managed metadata. This is not an acceptable final submission boundary.
2. Admin report updates are direct table updates rather than narrow transition RPCs. Submission, return, and approval must validate allowed transitions and set timestamps/actor IDs on the server.
3. The schema lacks a report status history/audit table and does not add `updated_at` triggers.
4. The Cook page intentionally does not persist drafts or submit. Those controls must stay disabled until the database API is hardened and tested.
5. Assignment creation/revocation and school deactivation need audit behavior and a tested policy for existing reports.
6. Duplicate reports must be flagged for admin review; do not automatically sum multiple cooks' entries into the official total.

## Required test matrix

Run only against a disposable local/test database, with separate accounts for each role:

| Test | Expected result |
|---|---|
| Cook loads the dedicated Cook page | Allowed; no inventory lists requested |
| Cook queries products, vendors, locations, employee inventory, or staff profiles directly | Denied or limited to specifically approved fields; no broad catalog/staff access |
| Cook calls inventory movement RPC with `use` or `waste` | Denied; balances, transaction rows, and audit rows unchanged |
| Cook calls employee stock-use RPC | Denied unless a documented business rule explicitly allows it |
| Cook selects an unassigned/inactive school in a direct API request | Denied |
| Cook reads another Cook's report/items | Denied |
| Cook changes submitted/approved report or approval metadata directly | Denied |
| Manager attempts to create a Cook or assign a school | Denied |
| Admin assigns a Cook to multiple schools and revokes one assignment | Correct access; changes audited |
| Admin approves a submitted report | Server stamps approver/time and records immutable history |
| Two cooks submit the same school/date/program | Separate submissions preserved and duplicate/conflict flagged |

## Environment limits

The repository could be inspected through GitHub, but Docker and the Supabase CLI were unavailable in the current environment and a local Git clone could not resolve GitHub's hostname. Therefore no JavaScript runtime checks, migration execution, RLS tests, or end-to-end tests have been performed. Do not describe this feature as complete until the above tests pass.

## Release rule

Keep PR #3 in draft. Do not merge it, deploy the Edge Function, apply either draft migration, or modify the production Supabase project until the blockers are resolved and the user explicitly approves the production release.
