# Fuel the Fire — rebuild package

This package is for the separate Fuel the Fire school inventory project. It does not connect to or change Where It All Began.

## Install
1. Edit `assets/config.js` and insert the Fuel the Fire Supabase **Project URL** and public **anon/publishable key**. Never place a service-role or secret key in frontend files.
2. Upload the contents of this folder to the root of the `fuelthefire` GitHub repository.
3. Apply `supabase/migrations/001_employee_inventory.sql` in the Fuel the Fire Supabase SQL Editor after reviewing the schema assumptions below.
4. The package expects your existing protected `admin-create-user` Edge Function. A reference implementation is included. Deploy `admin-manage-user` too, using the same helper/runtime style as your working function.
5. In GitHub Settings → Pages, publish the main branch root and configure `fuelthefire.site` if it is already pointed at this repository.

## Existing project assumptions
- `products.cases_on_hand` is whole cases and `products.units_on_hand` is loose units. Together they represent the on-hand amount. If your current column semantics differ, reconcile before running the migration.
- Existing `profiles`, `products`, `categories`, `vendors`, `locations`, `inventory_transactions`, `audit_logs`, role enums and helper functions are already configured in the Fuel the Fire project.
- Test receiving, central use, transfer, employee stock view, and employee-held stock use with test items before relying on this for real counts.
- Employee-held stock movement is stored separately in `employee_inventory`. Transfers out of central stock are atomic via SQL RPC.
- The frontend supports typed or hardware-scanner barcode entry/search. Camera barcode scanning, expiration alerts, advanced valuation, and multi-page printable reports are not included yet.
- The current stock movement screen supports receive, use, waste, transfer, adjustment and count. For adjustment removal, begin the reference with `REMOVE:`; count replaces central on-hand stock with the count entered.
- Review the migration, RLS policies, and Supabase security advisor before production use.`
