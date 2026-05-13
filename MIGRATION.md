# JSON to Supabase migration

This script migrates migrate-able demo JSON data from `src/data/` into Supabase tables (`meal_logs`, `cgm_stints`, `cgm_readings`) and is safe to re-run (idempotent checks skip already-seeded rows).

## Setup

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
```

Find `user_id` in Supabase Dashboard → **Auth** → **Users**.

## Commands

```bash
node scripts/migrateJsonToSupabase.cjs <user_id>            # dry-run (default)
node scripts/migrateJsonToSupabase.cjs <user_id> --execute  # actual write
```

The script defaults to dry-run and will not write unless `--execute` is supplied.
