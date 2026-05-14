# Supabase Migration

## Environment

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

## Dry run

```bash
node scripts/migrateJsonToSupabase.cjs <user_uuid>
```

## Apply migration

```bash
node scripts/migrateJsonToSupabase.cjs <user_uuid> --apply
```

The script is idempotent by intent of usage (dry-run default), validates UUID input, and logs final insert totals.
