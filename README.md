# Fuel the Fire

Responsive school food-service inventory app for the separate `fuelthefire` project. This repository does not touch or connect to Where It All Began.

## Current files
- `index.html` — employee/manager sign-in
- `admin.html` — administrator sign-in with server-backed role verification
- `app.html` — authenticated workspace
- `assets/login.js`, `assets/admin-login.js`, `assets/app.js`, `assets/app.css`
- `assets/config.js` — Supabase project URL and browser-safe publishable key
- `supabase/migrations/001_employee_inventory.sql` — employee-held stock and atomic stock-movement functions

## Required setup
1. GitHub Pages must publish the `main` branch from the repository root and the custom domain `fuelthefire.site` must point to this repository.
2. In Supabase, confirm the project URL and browser-safe publishable key in `assets/config.js`. Never put a `service_role` or secret key in frontend files.
3. Before running the migration, back up the database and confirm the assumptions below match the existing schema. Run `supabase/migrations/001_employee_inventory.sql` in the Supabase SQL Editor. Do not run it against a different project.
4. The project expects the existing `admin-create-user` Supabase Edge Function for account creation. Employee management actions beyond account creation may need the separate `admin-manage-user` Edge Function deployed.
5. The existing core schema must include `profiles`, `products`, `categories`, `vendors`, `locations`, `inventory_transactions`, `audit_logs`, the `user_role` and `inventory_transaction_type` enums, and helper functions `is_active_user()` and `is_manager_or_admin()`.

## Migration assumptions — verify before applying
- `products.cases_on_hand` is the count of whole cases.
- `products.units_on_hand` is the loose-unit count, not the total unit count.
- `products.units_per_case` is the number of individual units per case.
- `inventory_transactions` has `user_id`, `product_id`, `transaction_type`, `quantity_units`, `cases_delta`, `units_delta`, `reference`, `notes`, and `location_id`.
- `audit_logs` has `user_id`, `action`, `entity_type`, `entity_id`, and `metadata`.

## Features in the current frontend
- Email/password sign-in, role-aware navigation, and forced first-login password setup
- Product catalog, categories/vendors/locations, barcode text entry/search
- Cases + loose-unit stock display, movement entry, low-stock alerts
- Employee inventory view and stock ledger CSV export

## Important testing status
Files are committed to GitHub and the JavaScript files parse syntactically. The live site, Supabase schema/migration, role policies, and end-to-end login have **not** been verified from this repository tool. Do not use the system for official stock counts until sign-in, receiving, use, waste, transfer, employee-held stock, and ledger history have been tested with non-critical test products.

Camera-based barcode scanning, expiration-date alerts, advanced valuation, and complete printable reports are not implemented yet.
