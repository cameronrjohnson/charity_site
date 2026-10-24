begin;

create type public.charity_id as enum (
  'direct-relief',
  'donorschoose',
  'nature-conservancy'
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  charity_id public.charity_id not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body, E' \t\n\r')) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index comments_charity_created_idx on public.comments (charity_id, created_at desc, id desc);
create index comments_user_idx on public.comments (user_id);

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (comment_id, user_id)
);

create index comment_likes_user_idx on public.comment_likes (user_id);

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  charity_id public.charity_id not null,
  created_at timestamptz not null default now(),
  primary key (user_id, charity_id)
);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.favorites enable row level security;

revoke all on public.comments, public.comment_likes, public.favorites from anon, authenticated;
grant select, delete on public.comments, public.comment_likes, public.favorites to authenticated;
grant insert (charity_id, body) on public.comments to authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;
grant insert (charity_id) on public.favorites to authenticated;
grant usage on type public.charity_id to anon, authenticated;

create policy comments_read_own on public.comments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy comments_insert_own on public.comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy comments_delete_own on public.comments
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy likes_read_own on public.comment_likes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy likes_insert_own on public.comment_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy likes_delete_own on public.comment_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy favorites_read_own on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy favorites_delete_own on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Public discussion reads omit user IDs and expose only aggregate like counts.
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
  is_mine boolean
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
    coalesce(c.user_id = auth.uid(), false)
  from public.comments c
  where c.charity_id = p_charity
  order by c.created_at desc, c.id desc
  limit 20 offset greatest(p_offset, 0);
$$;

revoke all on function public.get_charity_comments(public.charity_id, integer) from public;
grant execute on function public.get_charity_comments(public.charity_id, integer) to anon, authenticated;

commit;
