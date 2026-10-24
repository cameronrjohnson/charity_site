begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select set_config('test.profile_a', gen_random_uuid()::text, true);
select set_config('test.profile_b', gen_random_uuid()::text, true);
select set_config('test.username', 'test_' || replace(gen_random_uuid()::text, '-', ''), true);
insert into auth.users (id) values
  (current_setting('test.profile_a')::uuid),
  (current_setting('test.profile_b')::uuid);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'Profiles use RLS');
select is((select count(*) from public.profiles where user_id in (
  current_setting('test.profile_a')::uuid, current_setting('test.profile_b')::uuid
)), 2::bigint, 'Signup trigger creates a profile for each user');
select is((select count(*) from auth.users u left join public.profiles p on p.user_id = u.id where p.user_id is null),
  0::bigint, 'Existing users all have backfilled profiles');
select isnt((select username from public.profiles where user_id = current_setting('test.profile_a')::uuid),
  'member_' || replace(current_setting('test.profile_a'), '-', ''), 'Generated public username does not encode the private user ID');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_a'), true);
select is((select count(*) from public.profiles), 1::bigint, 'User can only read their own profile row');
select lives_ok($$update public.profiles set username = current_setting('test.username') where user_id = auth.uid()$$, 'User can change their username');
select is((select username from public.profiles), current_setting('test.username'), 'New username is persisted');
select throws_ok($$update public.profiles set username = 'ab'$$, '23514', null, 'Too-short username is rejected');
select throws_ok($$update public.profiles set username = repeat('x', 41)$$, '23514', null, 'Too-long username is rejected');
select throws_ok($$update public.profiles set username = 'two words'$$, '23514', null, 'Spaces are rejected');
select throws_ok($$update public.profiles set username = '<script>'$$, '23514', null, 'Markup is rejected');
select throws_ok($$update public.profiles set user_id = current_setting('test.profile_b')::uuid$$, '42501', null, 'Cannot transfer profile ownership');
select throws_ok($$delete from public.profiles$$, '42501', null, 'Cannot delete own profile independently');
select throws_ok($$insert into public.profiles (user_id, username) values (auth.uid(), 'forged')$$, '42501', null, 'Cannot create extra profiles');
insert into public.comments (charity_id, body) values ('direct-relief', 'Profile display test');
select is((select author_username from public.get_charity_comments('direct-relief') where body = 'Profile display test'),
  current_setting('test.username'), 'Comment exposes current username');
select lives_ok($$update public.profiles set username = upper(current_setting('test.username')) where user_id = auth.uid()$$, 'User may change username capitalization');
select is((select author_username from public.get_charity_comments('direct-relief') where body = 'Profile display test'),
  upper(current_setting('test.username')), 'Existing comments reflect the renamed username');

select set_config('request.jwt.claim.sub', current_setting('test.profile_b'), true);
select throws_ok($$update public.profiles set username = current_setting('test.username')$$, '23505', null, 'Username uniqueness ignores case');
select lives_ok($$update public.profiles set username = 'forged' where user_id = current_setting('test.profile_a')::uuid$$, 'Other profile rows cannot be updated');
select is((select count(*) from public.profiles where user_id = current_setting('test.profile_a')::uuid),
  0::bigint, 'Another user cannot query a profile row');
select is((select author_username from public.get_charity_comments('direct-relief') where body = 'Profile display test'),
  upper(current_setting('test.username')), 'Another user can see username on public comments');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.profiles$$, '42501', null, 'Anonymous visitors cannot query profile rows');
select throws_ok($$update public.profiles set username = 'forged'$$, '42501', null, 'Anonymous visitors cannot change usernames');
select is((select author_username from public.get_charity_comments('direct-relief') where body = 'Profile display test'),
  upper(current_setting('test.username')), 'Anonymous visitors can read author usernames on comments');

reset role;
delete from auth.users where id = current_setting('test.profile_a')::uuid;
select is((select count(*) from public.profiles where user_id = current_setting('test.profile_a')::uuid),
  0::bigint, 'Deleting Auth user removes their profile');

select * from finish();
rollback;
