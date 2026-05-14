alter table public.meal_logs
  add column if not exists meal_type    text,
  add column if not exists day_of_week  text,
  add column if not exists foods        jsonb default '[]'::jsonb,
  add column if not exists pre_meal     jsonb default '[]'::jsonb,
  add column if not exists post_meal    jsonb default '[]'::jsonb,
  add column if not exists tags         jsonb default '[]'::jsonb;
