# Cook Meal Reports — Development Design

Status: planning document only. This branch is isolated from `main`. No production website, Supabase project, schema, or data has been changed by this work.

## Goals

- Reuse the existing Supabase Auth sign-in and profile lifecycle.
- Add a Cook-only experience for recording meal reports.
- Let administrators assign a cook to one or more schools.
- Enforce school access in PostgreSQL/RLS or tightly scoped database functions, not only in client-side controls.
- Keep meal reports separate from inventory movements. Saving or submitting a report must not change inventory balances.
- Preserve existing employee, manager, and administrator workflows.

## Proposed cook workflow

1. A cook signs in through the existing login.
2. The app checks the active profile and completes required password setup if needed.
3. A Cook role is routed to a dedicated cook page before loading inventory/product/vendor/employee lists.
4. The cook selects one of their assigned schools, the service date, and meal program.
5. The cook records quantities by food item and meal-report measure (for example, offered, reused, and waste where applicable). Category totals are calculated from item rows.
6. The cook reviews and submits. Submission is attributable to the signed-in user and records a server timestamp.
7. The admin can review submissions, resolve duplicates/conflicts, approve the official report, and print/export it.

## School assignment model

Proposed relation: `cook_school_assignments` with a generated UUID, `cook_id` referencing `profiles(id)`, `school_id` referencing a canonical schools table, `assigned_by` referencing the admin profile, `created_at`, and an active/revocation mechanism. Enforce one active assignment per cook/school with a unique constraint or partial unique index.

The admin UI should support multiple assignments per cook using a list of checkboxes or multi-select controls. The cook's school list is sourced from active assignments. Assignment changes should be auditable.

Before implementation, inspect the repository and deployed database for an existing canonical school/location table. Do not create a duplicate school catalog if an appropriate table already exists. If a new schools table is needed, populate it only through an explicitly reviewed migration and an admin-controlled maintenance workflow.

## Proposed meal-report data model

- `meal_reports`: report ID, school ID, service date, meal program, cook ID, status (draft/submitted/approved/returned), submitted/approved timestamps, approved-by profile, created/updated timestamps, and any paper-form header fields.
- `meal_report_items`: report ID, food/product reference where a stable catalog reference exists, item label snapshot, category, and validated non-negative quantity fields needed by the official form.
- Optional audit/event table or immutable status-transition records for submit/return/approve actions.

A uniqueness rule for school + date + meal program must not silently merge two cooks' entries. First determine whether the district needs one report per cook or a shared school/day report. The safe default is separate cook submissions plus an admin-controlled combined/approved report, with duplicate/conflict warnings rather than automatic addition.

## Security requirements

- Cook profile role is verified server-side and must be active.
- A cook can read and edit only their own drafts, and only while in draft status.
- A cook can submit a report only for a school with an active assignment.
- Submitted reports are immutable to the cook; an admin-controlled return/reopen workflow is required for corrections.
- Only admins can assign schools, view reports across schools, approve official reports, or manage assignments.
- Managers and employees must not gain Cook-only access by changing client routes.
- Cook role must be denied access to existing inventory, employee stock, purchasing, product/vendor lists, staff lists, and inventory-changing RPCs.
- Use least-privilege table grants and RLS; use SECURITY DEFINER functions only when needed, with fixed `search_path`, explicit authorization checks, and restricted EXECUTE grants.
- Never trust client-supplied cook ID, role, assignment status, approval status, or timestamps.
- Keep Supabase service-role keys exclusively server-side.
- Audit assignment changes and report submit/approve/return transitions.

## Required review before implementation

The existing app's `assets/app.js` loads product, category, vendor, location, and profile lists before routing to the dashboard. A Cook role must be routed to a separate allowlisted page before this call. Hiding navigation items is not an authorization boundary.

The current account-creation function reportedly permits only employee and manager roles. Any Cook account creation change must be admin-only for assigning the Cook role; a manager must not be able to promote accounts to Cook or other privileged roles without explicit policy approval.

Existing migrations include inventory RPCs and broad application functionality. Before authoring an executable migration, inspect all existing table definitions, role constraints, RLS policies, grants, helper functions, and RPC EXECUTE privileges. Specifically test that a Cook cannot read other profiles or school reports, invoke stock-changing RPCs, or access unassigned schools through direct API calls.

## Safe implementation sequence

1. Complete schema/RLS/grant/RPC inventory from repository migrations and, only with authorization, a non-production Supabase test environment.
2. Confirm the existing canonical school table and paper-form fields.
3. Build and review an additive migration on this feature branch; do not apply it to production.
4. Build the Cook page and admin assignment/review UI on this branch.
5. Test with admin, manager, employee, and Cook test accounts, including direct API/RPC attempts.
6. Show the user the branch diff and test plan. Do not merge, deploy, or apply a production migration without separate explicit approval.

## Out of scope for this branch until approved

- Production database migrations or data changes.
- Production function deployment.
- Publishing/merging this feature into `main`.
- Automatic inventory balance changes from meal reports.


## Development branch progress (2026-10-17)

- Added a standalone `cook.html` preview and `assets/cook.js`. Draft save and submit remain disabled.
- Updated the branch copy of `assets/app.js` so Cook accounts are routed to `cook.html` before inventory lists load, including after required password setup.
- Added an administrator-only Cook School Assignments navigation entry and initial UI for adding school records and assigning/revoking multiple schools per cook.
- Drafted an enum migration for the `cook` role and a separate meal-report/school-assignment migration.
- Updated the branch copy of `admin-create-user` to allow Cook account creation only when the caller is an administrator. This function change has not been deployed.
- Read-only inspection of the linked production schema showed `public.locations` currently contains `Main Storage`, so it is not being treated as the school catalog.
- No migration has been applied, no Edge Function deployed, no branch merged, and no production site files changed.

## Current blockers / safety notes

The SQL draft is not production-ready. The role enum and the account-creation function must be coordinated; existing role-validation triggers and helper functions need review. Submission/approval must be implemented through restricted RPCs, not direct client updates. Every existing inventory RPC and table policy must be tested to ensure the Cook role cannot invoke inventory-changing operations. A non-production Supabase project/branch and dedicated test accounts are required before declaring this secure. The admin assignment UI will show database errors until the draft schema is installed in a test environment.
