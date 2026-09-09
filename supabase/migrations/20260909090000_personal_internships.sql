create table if not exists public.internships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  organization text check (organization is null or char_length(organization) <= 100),
  start_date date not null,
  end_date date not null,
  target_hours numeric(8,2) not null check (target_hours > 0 and target_hours <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internships_valid_period check (end_date >= start_date),
  unique (id, user_id)
);
alter table public.time_entries add column if not exists internship_id uuid references public.internships(id) on delete cascade;
create index if not exists internships_user_id_idx on public.internships(user_id);
create index if not exists time_entries_internship_id_date_idx on public.time_entries(internship_id, date desc);
alter table public.internships enable row level security;
alter table public.time_entries enable row level security;
drop policy if exists "Allow all" on public.time_entries;
create policy "Users manage own internships" on public.internships for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read own entries" on public.time_entries for select to authenticated using (exists (select 1 from public.internships i where i.id = internship_id and i.user_id = (select auth.uid())));
create policy "Users create own entries" on public.time_entries for insert to authenticated with check (exists (select 1 from public.internships i where i.id = internship_id and i.user_id = (select auth.uid())));
create policy "Users update own entries" on public.time_entries for update to authenticated using (exists (select 1 from public.internships i where i.id = internship_id and i.user_id = (select auth.uid()))) with check (exists (select 1 from public.internships i where i.id = internship_id and i.user_id = (select auth.uid())));
create policy "Users delete own entries" on public.time_entries for delete to authenticated using (exists (select 1 from public.internships i where i.id = internship_id and i.user_id = (select auth.uid())));
revoke all on public.internships from anon;
revoke all on public.time_entries from anon;
grant select, insert, update, delete on public.internships to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
create schema if not exists private;
revoke all on schema private from public;
create or replace function private.bootstrap_praktik_tracker_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare internship_uuid uuid;
begin
  if lower(new.email) = 'zoubben@gmail.com' then
    insert into public.internships (user_id, name, organization, start_date, end_date, target_hours)
    values (new.id, 'Mit DLG-praktikforløb', 'DLG', '2026-06-15', '2026-11-30', 230)
    returning id into internship_uuid;
    update public.time_entries set internship_id = internship_uuid where internship_id is null;
  end if;
  return new;
end;
$$;
revoke all on function private.bootstrap_praktik_tracker_user() from public;
drop trigger if exists on_praktik_tracker_user_created on auth.users;
create trigger on_praktik_tracker_user_created after insert on auth.users for each row execute function private.bootstrap_praktik_tracker_user();
