-- EMA personal assistant: private memory, reminders and per-device push subscriptions.
-- Every user-owned table is protected with RLS so Ali and Tuba remain isolated.

create extension if not exists pgcrypto;

create table if not exists public.ema_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ema_memories_content_length check (char_length(content) between 1 and 4000)
);

create table if not exists public.ema_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz not null,
  completed_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ema_reminders_title_length check (char_length(title) between 1 and 500)
);

create table if not exists public.ema_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists ema_memories_user_idx on public.ema_memories(user_id, updated_at desc);
create index if not exists ema_reminders_due_idx on public.ema_reminders(user_id, due_at) where completed_at is null;
create index if not exists ema_push_subscriptions_user_idx on public.ema_push_subscriptions(user_id);

alter table public.ema_memories enable row level security;
alter table public.ema_reminders enable row level security;
alter table public.ema_push_subscriptions enable row level security;

grant select, insert, update, delete on public.ema_memories to authenticated;
grant select, insert, update, delete on public.ema_reminders to authenticated;
grant select, insert, update, delete on public.ema_push_subscriptions to authenticated;

drop policy if exists "ema_memories_owner_select" on public.ema_memories;
create policy "ema_memories_owner_select" on public.ema_memories for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "ema_memories_owner_insert" on public.ema_memories;
create policy "ema_memories_owner_insert" on public.ema_memories for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "ema_memories_owner_update" on public.ema_memories;
create policy "ema_memories_owner_update" on public.ema_memories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ema_memories_owner_delete" on public.ema_memories;
create policy "ema_memories_owner_delete" on public.ema_memories for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ema_reminders_owner_select" on public.ema_reminders;
create policy "ema_reminders_owner_select" on public.ema_reminders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "ema_reminders_owner_insert" on public.ema_reminders;
create policy "ema_reminders_owner_insert" on public.ema_reminders for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "ema_reminders_owner_update" on public.ema_reminders;
create policy "ema_reminders_owner_update" on public.ema_reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ema_reminders_owner_delete" on public.ema_reminders;
create policy "ema_reminders_owner_delete" on public.ema_reminders for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ema_push_owner_select" on public.ema_push_subscriptions;
create policy "ema_push_owner_select" on public.ema_push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "ema_push_owner_insert" on public.ema_push_subscriptions;
create policy "ema_push_owner_insert" on public.ema_push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "ema_push_owner_update" on public.ema_push_subscriptions;
create policy "ema_push_owner_update" on public.ema_push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ema_push_owner_delete" on public.ema_push_subscriptions;
create policy "ema_push_owner_delete" on public.ema_push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
