# Cook Role Inventory RPC Denial — Draft Migration 011

**Draft only. Not applied to production and not runtime-tested.**

Migration `011_draft_deny_cook_inventory_rpcs.sql` redefines the two stock-changing SECURITY DEFINER RPCs found in the existing migration chain:

- `record_inventory_movement(...)`
- `record_employee_stock_use(...)`

Both now check the signed-in user's `profiles.role` and reject `cook` before any inventory read-for-update or write. Existing movement validation and ledger/audit behavior are otherwise preserved from migration 001. Execute is revoked from `PUBLIC` and `anon`, and retained for `authenticated`, so existing non-Cook RPC callers continue through the existing server-side role checks.

## Important limitations

This is a targeted defense-in-depth change, not a complete role-security review. It does **not** prove Cook accounts cannot read product/vendor/location/profile data or call any other inventory or purchasing functions. Review all SECURITY DEFINER functions, views, RLS policies, table privileges, Edge Functions, and profile access. In particular, test purchasing RPC `receive_purchase_order`, the password-setup RPC, and direct REST access under Cook credentials.

The draft meal-report migration and workflow also remain untested. Keep Save/Submit disabled and PR #3 in Draft until:
1. SQL parses and applies cleanly to a disposable local Supabase database.
2. Cook direct calls to both stock-changing RPCs fail and leave product balances, transaction ledger, employee inventory, and audit logs unchanged.
3. Existing employee/manager/admin tests pass.
4. A full grants/RLS/RPC review confirms Cook isolation.
5. Report create/save/submit/return/approve transitions and audit events are tested with separate role accounts.

No production Supabase project or live website was changed.
