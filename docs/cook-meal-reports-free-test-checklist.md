# Cook Meal Reports — Free Testing and Completion Checklist

This checklist is for the development branch only. It does not authorize production deployment.

## What is currently implemented in the branch
- Cook role route guard in the main app, before inventory lists load.
- Standalone Cook preview page with school/date/program and food-item entry fields.
- Admin-only school assignment page and account role selection for Cook.
- Draft schema migrations for the Cook role and report tables.
- Cook draft save and submit are deliberately disabled.

## Required before the feature can be called complete
- [ ] Verify the repository's complete migration history and deployed schema; resolve role enum/check constraints and any profile triggers.
- [ ] Replace direct Cook updates of report status/metadata with narrow server-side RPCs for save draft, submit, return for correction, and approve.
- [ ] Enforce immutable submitted/approved reports; validate school assignment and active role inside each RPC.
- [ ] Add audit/history records for assignment changes and every status transition.
- [ ] Add server-side validation for numeric quantities, dates, meal program, item names/units, and empty reports.
- [ ] Confirm whether reports are separate per cook or consolidated by school/date/program; never silently add duplicate submissions together.
- [ ] Review every existing table grant, RLS policy, trigger, and RPC so Cook cannot access inventory, purchasing, products, vendors, staff lists, or inventory-changing functions.
- [ ] Fix assignment UI so it correctly handles revoked assignments, inactive schools, partial failures, and duplicate school creation.
- [ ] Test admin, manager, employee, and Cook accounts, including direct REST/RPC calls that attempt to bypass the UI.
- [ ] Run syntax checks on the JavaScript and Edge Function, then automated tests.
- [ ] Test schema and RLS in a separate test database before any production migration.
- [ ] Obtain explicit approval before merging to main, deploying the Edge Function, or changing production Supabase.

## Free local test option
Use the Supabase CLI with Docker locally, if Docker is already available. Start with `supabase start`, reset only the local database using repository migrations, and run tests against the local Supabase URL/keys. Do not put production keys in local test configuration and do not run `supabase db push` against the production project.

If Docker or the Supabase CLI is not installed, perform static code review first and install/use the tools only if available at no cost. A local schema test is not a substitute for a final production backup and explicit migration approval.

## Safety status
No production migration has been applied and no Edge Function has been deployed for this feature. The pull request must remain a draft until the checklist is satisfied.