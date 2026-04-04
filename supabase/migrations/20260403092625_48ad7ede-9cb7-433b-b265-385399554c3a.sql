
-- Enable pgcrypto extension for gen_random_bytes
create extension if not exists pgcrypto with schema extensions;

-- Update generate_short_code to use extensions.gen_random_bytes
create or replace function public.generate_short_code() returns trigger as $$
begin
  new.short_code := encode(extensions.gen_random_bytes(5), 'base64');
  new.short_code := replace(replace(replace(new.short_code, '+', ''), '/', ''), '=', '');
  new.short_code := lower(substring(new.short_code from 1 for 8));
  return new;
end;
$$ language plpgsql set search_path = public;

-- Recreate triggers (they were lost)
drop trigger if exists set_short_code on public.files;
create trigger set_short_code before insert on public.files
  for each row when (new.short_code is null) execute function public.generate_short_code();

drop trigger if exists on_file_change on public.files;
create trigger on_file_change after insert or delete on public.files
  for each row execute function public.update_user_stats();

drop trigger if exists files_updated_at on public.files;
create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

-- Also fix file_shares default to use extensions schema
alter table public.file_shares alter column share_token set default encode(extensions.gen_random_bytes(16), 'hex');
