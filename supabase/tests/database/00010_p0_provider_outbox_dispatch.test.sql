begin;

select plan(22);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'aa100000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'outbox-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values (
  'aa200000-0000-4000-8000-000000000001',
  'Outbox Workspace',
  'outbox-workspace',
  'aa100000-0000-4000-8000-000000000001'
);

insert into public.outbox_events (
  id,
  workspace_id,
  aggregate_type,
  aggregate_id,
  event_type,
  dedupe_key,
  payload
) values (
  'aa300000-0000-4000-8000-000000000001',
  'aa200000-0000-4000-8000-000000000001',
  'run',
  'aa400000-0000-4000-8000-000000000001',
  'run.dispatch_requested',
  'outbox-rpc-lease-1',
  '{"run_id":"aa400000-0000-4000-8000-000000000001","workspace_id":"aa200000-0000-4000-8000-000000000001"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(1, 'lease-owner-a', 60)
  ),
  1,
  'claim returns one pending row'
);
select is(
  (
    select status
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000001'
  ),
  'leased',
  'claim marks the row leased'
);
select is(
  (
    select lease_owner
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000001'
  ),
  'lease-owner-a',
  'claim records the lease owner'
);
select is(
  (
    select publish_attempts
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000001'
  ),
  0,
  'claim does not increment publish attempts'
);
select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(1, 'lease-owner-b', 60)
  ),
  0,
  'a fresh lease is not re-claimable'
);

update public.outbox_events
set lease_expires_at = statement_timestamp() - interval '1 second'
where id = 'aa300000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(1, 'lease-owner-b', 60)
  ),
  1,
  'an expired lease is re-claimable'
);
select is(
  (
    select lease_owner
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000001'
  ),
  'lease-owner-b',
  'expired-lease recovery transfers ownership'
);

select is(
  (public.publish_outbox_event('aa300000-0000-4000-8000-000000000001') ->> 'published')::boolean,
  true,
  'publish transitions a leased row'
);
select is(
  (
    select status
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000001'
  ),
  'published',
  'published is the stored terminal state'
);
select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(1, 'lease-owner-c', 60)
  ),
  0,
  'published rows are never re-claimed'
);

insert into public.outbox_events (
  id,
  workspace_id,
  aggregate_type,
  aggregate_id,
  event_type,
  dedupe_key,
  payload
) values (
  'aa300000-0000-4000-8000-000000000002',
  'aa200000-0000-4000-8000-000000000001',
  'run',
  'aa400000-0000-4000-8000-000000000002',
  'run.dispatch_requested',
  'outbox-rpc-failure-1',
  '{}'::jsonb
);

do $$
begin
  perform public.claim_outbox_events(1, 'failure-owner-a', 60);
end;
$$;

select is(
  public.fail_outbox_event(
    'aa300000-0000-4000-8000-000000000002',
    30,
    2
  ) ->> 'status',
  'pending',
  'first failure returns the event to pending'
);
select is(
  (
    select publish_attempts
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000002'
  ),
  1,
  'failure increments publish attempts once'
);
select cmp_ok(
  (
    select available_at
    from public.outbox_events
    where id = 'aa300000-0000-4000-8000-000000000002'
  ),
  '>',
  statement_timestamp(),
  'failure applies retry backoff'
);

update public.outbox_events
set available_at = statement_timestamp() - interval '1 second'
where id = 'aa300000-0000-4000-8000-000000000002';

do $$
begin
  perform public.claim_outbox_events(1, 'failure-owner-b', 60);
end;
$$;

select is(
  public.fail_outbox_event(
    'aa300000-0000-4000-8000-000000000002',
    30,
    2
  ) ->> 'status',
  'dead',
  'failure at the maximum attempt count dead-letters the event'
);
select is(
  (
    select count(*)::integer
    from public.claim_outbox_events(1, 'failure-owner-c', 60)
  ),
  0,
  'dead rows are never re-claimed'
);

insert into public.outbox_events (
  id,
  workspace_id,
  aggregate_type,
  aggregate_id,
  event_type,
  dedupe_key,
  payload,
  available_at
) values
  (
    'aa300000-0000-4000-8000-000000000003',
    'aa200000-0000-4000-8000-000000000001',
    'run',
    'aa400000-0000-4000-8000-000000000003',
    'run.dispatch_requested',
    'outbox-rpc-concurrency-1',
    '{}'::jsonb,
    statement_timestamp() - interval '2 seconds'
  ),
  (
    'aa300000-0000-4000-8000-000000000004',
    'aa200000-0000-4000-8000-000000000001',
    'run',
    'aa400000-0000-4000-8000-000000000004',
    'run.dispatch_requested',
    'outbox-rpc-concurrency-2',
    '{}'::jsonb,
    statement_timestamp() - interval '1 second'
  );

select is(
  (select count(*)::integer from public.claim_outbox_events(1, 'concurrent-owner-a', 60)),
  1,
  'the first bounded claimer receives one row'
);
select is(
  (select count(*)::integer from public.claim_outbox_events(1, 'concurrent-owner-b', 60)),
  1,
  'an overlapping bounded claimer receives the disjoint unlocked row'
);
select is(
  (
    select count(distinct lease_owner)::integer
    from public.outbox_events
    where id in (
      'aa300000-0000-4000-8000-000000000003',
      'aa300000-0000-4000-8000-000000000004'
    )
  ),
  2,
  'skip-locked claimers own disjoint row sets'
);
select alike(
  upper(pg_get_functiondef(
    'public.claim_outbox_events(integer,text,integer)'::regprocedure
  )),
  '%FOR UPDATE SKIP LOCKED%',
  'claim uses row locks with skip locked for concurrent workers'
);

select ok(
  not has_table_privilege('authenticated', 'public.outbox_events', 'select')
  and not has_table_privilege('anon', 'public.outbox_events', 'select'),
  'authenticated and anon cannot select outbox rows'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_outbox_events(integer,text,integer)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.publish_outbox_event(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fail_outbox_event(uuid,integer,integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.claim_outbox_events(integer,text,integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.publish_outbox_event(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.fail_outbox_event(uuid,integer,integer)',
    'execute'
  ),
  'authenticated and anon cannot execute any outbox lifecycle RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_outbox_events(integer,text,integer)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.publish_outbox_event(uuid)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.fail_outbox_event(uuid,integer,integer)',
    'execute'
  ),
  'only the machine service role receives the outbox lifecycle surface'
);

select * from finish();

rollback;
