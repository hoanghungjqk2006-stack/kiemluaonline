-- KIEM LUA ONLINE: Supabase starter schema
-- Run this file in Supabase SQL Editor. Never put the service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Thành viên',
  referral_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  referred_by uuid references public.profiles(id),
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null check (task_type in ('short_link','app','other')),
  description text not null default '',
  reward_lua bigint not null check (reward_lua > 0),
  target_url text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  user_id uuid not null references public.profiles(id),
  proof_text text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount_lua bigint not null check (amount_lua <> 0),
  transaction_type text not null check (transaction_type in ('task_reward','referral_reward','adjustment','withdrawal')),
  description text not null default '',
  related_submission uuid references public.task_submissions(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount_lua bigint not null check (amount_lua > 0),
  payout_method text not null,
  payout_details text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_active_created_idx on public.tasks(is_active, created_at desc);
create index if not exists submissions_user_created_idx on public.task_submissions(user_id, created_at desc);
create index if not exists transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists withdrawals_user_created_idx on public.withdrawal_requests(user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer uuid;
begin
  ref_code := nullif(upper(trim(new.raw_user_meta_data ->> 'referral_code')), '');
  if ref_code is not null then
    select id into referrer from public.profiles where referral_code = ref_code;
  end if;
  insert into public.profiles(id, display_name, referred_by)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Thành viên'),
    referrer
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kiemlua on auth.users;
create trigger on_auth_user_created_kiemlua
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change a member role';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_kiemlua on public.profiles;
create trigger protect_profile_role_kiemlua
before update on public.profiles
for each row execute procedure public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "members read active tasks" on public.tasks;
create policy "members read active tasks" on public.tasks
for select to authenticated using (is_active = true or public.is_admin());

drop policy if exists "admins manage tasks" on public.tasks;
create policy "admins manage tasks" on public.tasks
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read own submissions or admin" on public.task_submissions;
create policy "members read own submissions or admin" on public.task_submissions
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "members submit own task" on public.task_submissions;
create policy "members submit own task" on public.task_submissions
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (select 1 from public.tasks t where t.id = task_id and t.is_active = true)
);

drop policy if exists "admins review submissions" on public.task_submissions;
create policy "admins review submissions" on public.task_submissions
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read own wallet or admin" on public.wallet_transactions;
create policy "members read own wallet or admin" on public.wallet_transactions
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage wallet transactions" on public.wallet_transactions;
create policy "admins manage wallet transactions" on public.wallet_transactions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read own withdrawals or admin" on public.withdrawal_requests;
create policy "members read own withdrawals or admin" on public.withdrawal_requests
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "members create own withdrawal" on public.withdrawal_requests;
create policy "members create own withdrawal" on public.withdrawal_requests
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'pending'
  and amount_lua > 0
);

drop policy if exists "admins review withdrawals" on public.withdrawal_requests;
create policy "admins review withdrawals" on public.withdrawal_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Balance is calculated from the immutable ledger. A production release should
-- additionally process withdrawals/rewards through server-side transactions.
create or replace view public.member_wallet_balances
with (security_invoker = true)
as
select user_id, coalesce(sum(amount_lua), 0)::bigint as balance_lua
from public.wallet_transactions
group by user_id;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.tasks to authenticated;
grant insert, select on public.task_submissions to authenticated;
grant select on public.wallet_transactions to authenticated;
grant select, insert on public.withdrawal_requests to authenticated;
grant select on public.member_wallet_balances to authenticated;

-- After creating your own account, promote that account manually in SQL Editor:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR_EMAIL');
