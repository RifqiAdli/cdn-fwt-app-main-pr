
-- Enable uuid-ossp
create extension if not exists "uuid-ossp";

-- Folders table (must be created before files due to FK)
create table public.folders (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  parent_id   uuid references public.folders(id) on delete cascade,
  color       text default '#60a5fa',
  icon        text default 'folder',
  created_at  timestamptz not null default now()
);

-- Files table
create table public.files (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  original_name text not null,
  size          bigint not null default 0,
  mime_type     text not null,
  storage_path  text not null unique,
  public_url    text not null,
  short_code    text unique,
  folder_id     uuid references public.folders(id) on delete set null,
  is_public     boolean not null default true,
  download_count bigint not null default 0,
  view_count    bigint not null default 0,
  bandwidth_used bigint not null default 0,
  tags          text[] default '{}',
  metadata      jsonb default '{}',
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Access logs
create table public.access_logs (
  id          bigserial primary key,
  file_id     uuid references public.files(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete set null,
  ip_address  inet,
  user_agent  text,
  referer     text,
  country     text,
  event_type  text not null check (event_type in ('view','download','copy_link')),
  bytes_served bigint default 0,
  created_at  timestamptz not null default now()
);

-- API Keys
create table public.api_keys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  key_hash    text not null unique,
  key_prefix  text not null,
  scopes      text[] default '{"read","upload"}',
  last_used_at timestamptz,
  expires_at  timestamptz,
  is_active   boolean default true,
  created_at  timestamptz not null default now()
);

-- File shares
create table public.file_shares (
  id          uuid primary key default uuid_generate_v4(),
  file_id     uuid references public.files(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  share_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  password_hash text,
  max_downloads int,
  download_count int default 0,
  expires_at  timestamptz,
  is_active   boolean default true,
  created_at  timestamptz not null default now()
);

-- User stats
create table public.user_stats (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  total_files       int default 0,
  total_storage     bigint default 0,
  total_downloads   bigint default 0,
  total_bandwidth   bigint default 0,
  storage_limit     bigint default 5368709120,
  updated_at        timestamptz default now()
);

-- RLS
alter table public.files       enable row level security;
alter table public.folders     enable row level security;
alter table public.access_logs enable row level security;
alter table public.api_keys    enable row level security;
alter table public.file_shares enable row level security;
alter table public.user_stats  enable row level security;

-- Files policies
create policy "Users manage own files" on public.files for all using (auth.uid() = user_id);
create policy "Public files are readable" on public.files for select using (is_public = true);

-- Folders policies
create policy "Users manage own folders" on public.folders for all using (auth.uid() = user_id);

-- Access logs policies
create policy "Users view own access logs" on public.access_logs for select using (
  exists (select 1 from public.files where files.id = access_logs.file_id and files.user_id = auth.uid())
);
create policy "System can insert access logs" on public.access_logs for insert with check (true);

-- API Keys policies
create policy "Users manage own api keys" on public.api_keys for all using (auth.uid() = user_id);

-- Shares policies
create policy "Users manage own shares" on public.file_shares for all using (auth.uid() = user_id);
create policy "Active shares are readable" on public.file_shares for select using (is_active = true);

-- Stats policies
create policy "Users view own stats" on public.user_stats for select using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.files;
alter publication supabase_realtime add table public.access_logs;
alter publication supabase_realtime add table public.user_stats;

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('cdn-files', 'cdn-files', true, 104857600);

create policy "Public read cdn-files" on storage.objects for select using (bucket_id = 'cdn-files');
create policy "Auth upload cdn-files" on storage.objects for insert with check (bucket_id = 'cdn-files' and auth.role() = 'authenticated');
create policy "Owner delete cdn-files" on storage.objects for delete using (bucket_id = 'cdn-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- Short code trigger
create or replace function public.generate_short_code() returns trigger as $$
begin
  new.short_code := encode(gen_random_bytes(5), 'base64');
  new.short_code := replace(replace(replace(new.short_code, '+', ''), '/', ''), '=', '');
  new.short_code := lower(substring(new.short_code from 1 for 8));
  return new;
end;
$$ language plpgsql;

create trigger set_short_code before insert on public.files
  for each row when (new.short_code is null) execute function public.generate_short_code();

-- User stats trigger
create or replace function public.update_user_stats() returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.user_stats (user_id, total_files, total_storage)
    values (new.user_id, 1, new.size)
    on conflict (user_id) do update
    set total_files   = user_stats.total_files + 1,
        total_storage = user_stats.total_storage + new.size,
        updated_at    = now();
  elsif TG_OP = 'DELETE' then
    update public.user_stats
    set total_files   = greatest(total_files - 1, 0),
        total_storage = greatest(total_storage - old.size, 0),
        updated_at    = now()
    where user_id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_file_change after insert or delete on public.files
  for each row execute function public.update_user_stats();

-- Updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();
