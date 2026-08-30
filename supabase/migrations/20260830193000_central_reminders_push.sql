-- Central EMA reminders + multi-recipient push foundation
create table if not exists public.ema_reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  remind_at timestamptz not null,
  source_app text not null check (source_app in ('office','intelligence')),
  created_by uuid references auth.users(id) on delete set null,
  related_type text,
  related_id text,
  status text not null default 'scheduled' check (status in ('scheduled','sent','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ema_reminder_recipients (
  reminder_id uuid not null references public.ema_reminders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (reminder_id, user_id)
);

create table if not exists public.ema_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists ema_reminders_due_idx on public.ema_reminders(status, remind_at);
create index if not exists ema_reminder_recipients_user_idx on public.ema_reminder_recipients(user_id);
create index if not exists ema_push_subscriptions_user_idx on public.ema_push_subscriptions(user_id);

alter table public.ema_reminders enable row level security;
alter table public.ema_reminder_recipients enable row level security;
alter table public.ema_push_subscriptions enable row level security;

create policy "reminders visible to creator or recipient" on public.ema_reminders
for select to authenticated using (
  created_by = auth.uid() or exists (
    select 1 from public.ema_reminder_recipients r
    where r.reminder_id = id and r.user_id = auth.uid()
  )
);

create policy "authenticated users create reminders" on public.ema_reminders
for insert to authenticated with check (created_by = auth.uid());

create policy "creator updates reminders" on public.ema_reminders
for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "recipient rows visible to participants" on public.ema_reminder_recipients
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.ema_reminders e where e.id = reminder_id and e.created_by = auth.uid()
  )
);

create policy "creator assigns reminder recipients" on public.ema_reminder_recipients
for insert to authenticated with check (
  exists (select 1 from public.ema_reminders e where e.id = reminder_id and e.created_by = auth.uid())
);

create policy "users manage own push subscriptions" on public.ema_push_subscriptions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
