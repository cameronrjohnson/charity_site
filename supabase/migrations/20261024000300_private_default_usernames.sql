begin;

create or replace function public.create_user_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, 'member_' || replace(pg_catalog.gen_random_uuid()::text, '-', ''));
  return new;
end;
$$;

update public.profiles
set username = 'member_' || replace(gen_random_uuid()::text, '-', '')
where username = 'member_' || replace(user_id::text, '-', '');

commit;
