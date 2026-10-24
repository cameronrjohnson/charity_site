begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,40}$')
);

create unique index profiles_username_key on public.profiles (lower(username));
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.create_user_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, 'member_' || replace(new.id::text, '-', ''));
  return new;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_user_profile();

insert into public.profiles (user_id, username)
select id, 'member_' || replace(id::text, '-', '') from auth.users;

drop function public.get_charity_comments(public.charity_id, integer);
create function public.get_charity_comments(
  p_charity public.charity_id,
  p_offset integer default 0
)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  is_mine boolean,
  author_username text
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.body, c.created_at,
    (select count(*) from public.comment_likes l where l.comment_id = c.id),
    exists (
      select 1 from public.comment_likes l
      where l.comment_id = c.id and l.user_id = auth.uid()
    ),
    coalesce(c.user_id = auth.uid(), false),
    p.username
  from public.comments c
  join public.profiles p on p.user_id = c.user_id
  where c.charity_id = p_charity
  order by c.created_at desc, c.id desc
  limit 20 offset greatest(p_offset, 0);
$$;

revoke all on function public.get_charity_comments(public.charity_id, integer) from public;
grant execute on function public.get_charity_comments(public.charity_id, integer) to anon, authenticated;

commit;
