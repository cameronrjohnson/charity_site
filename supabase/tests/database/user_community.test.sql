begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select set_config('test.user_a', gen_random_uuid()::text, true);
select set_config('test.user_b', gen_random_uuid()::text, true);
select set_config('test.comment', gen_random_uuid()::text, true);
insert into auth.users (id) values
  (current_setting('test.user_a')::uuid),
  (current_setting('test.user_b')::uuid);

select ok((select relrowsecurity from pg_class where oid = 'public.comments'::regclass), 'Comments use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.comment_likes'::regclass), 'Likes use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.favorites'::regclass), 'Favorites use RLS');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select lives_ok($$insert into public.comments (charity_id, body) values ('direct-relief', 'First test comment')$$, 'User can post a comment');
select set_config('test.comment', (select id::text from public.comments where body = 'First test comment'), true);
select is((select user_id::text from public.comments where id = current_setting('test.comment')::uuid), current_setting('test.user_a'), 'Comment author defaults to current user');
select throws_ok($$insert into public.comments (charity_id, body) values ('direct-relief', E' \t\n\r')$$, '23514', null, 'Whitespace-only comments are rejected');
select throws_ok($$insert into public.comments (charity_id, body) values ('direct-relief', repeat('x', 2001))$$, '23514', null, 'Overlong comments are rejected');
select lives_ok($$insert into public.comments (charity_id, body) values ('donorschoose', repeat('x', 2000))$$, 'A 2,000-character comment is allowed');
select throws_ok($$insert into public.comments (charity_id, body) values ('not-a-charity', 'Test')$$, '22P02', null, 'Unknown charity IDs are rejected');
select throws_ok($$insert into public.comments (charity_id, body, user_id) values ('direct-relief', 'Forged', current_setting('test.user_b')::uuid)$$, '42501', null, 'Cannot forge a comment author');
select throws_ok($$update public.comments set body = 'Changed'$$, '42501', null, 'Comment updates are not granted');

select lives_ok($$insert into public.favorites (charity_id) values ('direct-relief')$$, 'User can save a charity');
select throws_ok($$insert into public.favorites (charity_id) values ('direct-relief')$$, '23505', null, 'Cannot save the same charity twice');
select throws_ok($$insert into public.favorites (charity_id, user_id) values ('donorschoose', current_setting('test.user_b')::uuid)$$, '42501', null, 'Cannot create favorites for another user');

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select is((select count(*) from public.favorites), 0::bigint, 'Another user cannot read private favorites');
select lives_ok($$delete from public.favorites$$, 'Deleting invisible favorites affects no rows');
select lives_ok($$delete from public.comments$$, 'Deleting invisible comments affects no rows');
select is((select count(*) from public.comments), 0::bigint, 'Raw comment ownership is not exposed to other users');
select is((select count(*) from public.get_charity_comments('direct-relief')), 1::bigint, 'Public discussion reads another user comment');
select is((select is_mine from public.get_charity_comments('direct-relief')), false, 'Ownership flag is false for another user');
select lives_ok($$insert into public.comment_likes (comment_id) values (current_setting('test.comment')::uuid)$$, 'User can like another user comment');
select throws_ok($$insert into public.comment_likes (comment_id) values (current_setting('test.comment')::uuid)$$, '23505', null, 'Cannot like a comment twice');
select throws_ok($$insert into public.comment_likes (comment_id) values (gen_random_uuid())$$, '23503', null, 'Cannot like a nonexistent comment');
select throws_ok($$insert into public.comment_likes (comment_id, user_id) values (current_setting('test.comment')::uuid, current_setting('test.user_a')::uuid)$$, '42501', null, 'Cannot forge another user like');
select is((select liked_by_me from public.get_charity_comments('direct-relief')), true, 'Own like is reflected in discussion');

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select is((select count(*) from public.favorites), 1::bigint, 'Own favorite survived another user delete attempt');
select is((select count(*) from public.comments), 2::bigint, 'Own comments survived another user delete attempt');
select is((select count(*) from public.comment_likes), 0::bigint, 'Other users like rows remain private');
select is((select like_count from public.get_charity_comments('direct-relief')), 1::bigint, 'Aggregate like count includes other users');
select is((select liked_by_me from public.get_charity_comments('direct-relief')), false, 'Other user like does not mark own like');
select is((select is_mine from public.get_charity_comments('direct-relief')), true, 'Ownership flag identifies own comment');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.get_charity_comments('direct-relief')), 1::bigint, 'Signed-out visitors can read public comments');
select is((select is_mine from public.get_charity_comments('direct-relief')), false, 'Signed-out visitors never own comments');
select throws_ok($$select * from public.favorites$$, '42501', null, 'Signed-out visitors cannot read favorites');
select throws_ok($$insert into public.comments (charity_id, body) values ('direct-relief', 'Anonymous')$$, '42501', null, 'Signed-out visitors cannot post');
select throws_ok($$insert into public.comment_likes (comment_id) values (current_setting('test.comment')::uuid)$$, '42501', null, 'Signed-out visitors cannot like');
select throws_ok($$insert into public.favorites (charity_id) values ('direct-relief')$$, '42501', null, 'Signed-out visitors cannot save');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select lives_ok($$delete from public.comment_likes where comment_id = current_setting('test.comment')::uuid$$, 'User can unlike');
select is((select like_count from public.get_charity_comments('direct-relief')), 0::bigint, 'Unlike reduces public count');
insert into public.comment_likes (comment_id) values (current_setting('test.comment')::uuid);
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select lives_ok($$delete from public.favorites where charity_id = 'direct-relief'$$, 'User can remove own favorite');
select is((select count(*) from public.favorites), 0::bigint, 'Removed favorite is gone');
select lives_ok($$delete from public.comments where id = current_setting('test.comment')::uuid$$, 'Author can delete own comment');

reset role;
select is((select count(*) from public.comment_likes where comment_id = current_setting('test.comment')::uuid), 0::bigint, 'Deleting a comment cascades its likes');
insert into public.favorites (user_id, charity_id) values (current_setting('test.user_a')::uuid, 'nature-conservancy');
delete from auth.users where id = current_setting('test.user_a')::uuid;
select is((select count(*) from public.comments where user_id = current_setting('test.user_a')::uuid), 0::bigint, 'Deleting a user removes their comments');
select is((select count(*) from public.favorites where user_id = current_setting('test.user_a')::uuid), 0::bigint, 'Deleting a user removes their favorites');

select * from finish();
rollback;
