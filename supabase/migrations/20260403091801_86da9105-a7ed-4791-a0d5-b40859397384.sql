
-- Fix search_path on all functions
create or replace function public.generate_short_code() returns trigger as $$
begin
  new.short_code := encode(gen_random_bytes(5), 'base64');
  new.short_code := replace(replace(replace(new.short_code, '+', ''), '/', ''), '=', '');
  new.short_code := lower(substring(new.short_code from 1 for 8));
  return new;
end;
$$ language plpgsql set search_path = public;

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
$$ language plpgsql security definer set search_path = public;

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql set search_path = public;

-- Fix permissive access_logs insert policy
drop policy if exists "System can insert access logs" on public.access_logs;
create policy "Authenticated users insert access logs" on public.access_logs for insert
  with check (auth.role() = 'authenticated');
