begin;

select plan(37);

create or replace function pg_temp.error_of(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000:';
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

create or replace function pg_temp.insert_unbalanced_ledger()
returns void
language plpgsql
as $$
begin
  insert into public.ledger_transactions (
    workspace_id,
    transaction_id,
    entry_type,
    account_code,
    direction,
    amount_micros,
    causative_key
  ) values (
    '40000000-0000-4000-8000-000000000001',
    '49900000-0000-4000-8000-000000000001',
    'credit',
    'wallet_available',
    'credit',
    1,
    'unbalanced-fixture'
  );
  set constraints ledger_transactions_balance immediate;
end;
$$;

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
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'authenticated',
  'authenticated',
  'barrier-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (
  id, name, slug, created_by, per_run_spend_cap_micros, daily_spend_cap_micros
) values (
  '40000000-0000-4000-8000-000000000001',
  'Barrier Workspace',
  'barrier-workspace',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  8000000,
  25000000
);

insert into public.workspace_memberships (workspace_id, user_id)
values (
  '40000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
);

insert into public.projects (id, workspace_id, name, status, created_by)
values (
  '41000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'Barrier Project',
  'active',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
);

insert into public.canvases (id, workspace_id, project_id, name, created_by) values
  (
    '42000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'Barrier Canvas',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'Other Canvas',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  );

insert into public.canvas_revisions (
  id,
  workspace_id,
  canvas_id,
  graph_schema_version,
  graph_snapshot,
  canonical_hash,
  actor_type,
  actor_id,
  reason
) values
  (
    '42100000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    1,
    '{"nodes":[{"id":"node-1"}],"edges":[]}'::jsonb,
    repeat('2', 64),
    'user',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'root'
  ),
  (
    '42100000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000002',
    1,
    '{"nodes":[],"edges":[]}'::jsonb,
    repeat('3', 64),
    'user',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'other root'
  );

update public.canvases
set head_revision_id = case id
  when '42000000-0000-4000-8000-000000000001'::uuid
    then '42100000-0000-4000-8000-000000000001'::uuid
  else '42100000-0000-4000-8000-000000000002'::uuid
end;

insert into public.provider_registrations (
  id, provider_key, display_name, transport_version, status, evidence_ref
) values (
  '43000000-0000-4000-8000-000000000001',
  'barrier-provider',
  'Barrier Provider',
  '1.0.0',
  'enabled',
  'governance/evidence/barrier-provider'
);

insert into public.price_catalog_versions (
  id,
  provider_registration_id,
  version,
  source_hash,
  source_ref,
  status,
  effective_at
) values (
  '43100000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000001',
  'barrier-v1',
  repeat('4', 64),
  'governance/evidence/barrier-price',
  'draft',
  statement_timestamp()
);

insert into public.model_routes (
  id,
  provider_registration_id,
  route_key,
  provider_model_id,
  driver_version,
  capability,
  status,
  input_schema_version,
  output_schema_version
) values (
  '43200000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000001',
  'barrier.image',
  'barrier/image',
  '1.0.0',
  'image',
  'enabled',
  1,
  1
);

insert into public.quotes (
  id,
  workspace_id,
  project_id,
  canvas_id,
  canvas_revision_id,
  price_catalog_version_id,
  execution_plan,
  quote_hash,
  maximum_charge_micros,
  created_by,
  created_at,
  expires_at
) values
  (
    '44000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    '0c000000-0000-4000-8000-000000000001',
    '[{"node_id":"node-1","model_route_id":"43200000-0000-4000-8000-000000000001","ready":true}]'::jsonb,
    repeat('5', 64),
    2000000,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    statement_timestamp(),
    statement_timestamp() + interval '15 minutes'
  ),
  (
    '44000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    '0c000000-0000-4000-8000-000000000001',
    '[{"node_id":"node-1","model_route_id":"43200000-0000-4000-8000-000000000001","ready":true}]'::jsonb,
    repeat('6', 64),
    1000000,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    statement_timestamp() - interval '20 minutes',
    statement_timestamp() - interval '5 minutes'
  );

insert into public.ledger_transactions (
  workspace_id,
  transaction_id,
  entry_type,
  account_code,
  direction,
  amount_micros,
  causative_key
) values
  (
    '40000000-0000-4000-8000-000000000001',
    '45000000-0000-4000-8000-000000000001',
    'credit',
    'funding_clearing',
    'debit',
    5000000,
    'initial-credit'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '45000000-0000-4000-8000-000000000001',
    'credit',
    'wallet_available',
    'credit',
    5000000,
    'initial-credit'
  );

select is(
  (
    select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
    from public.ledger_transactions
    where transaction_id = '45000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'seed credit is a balanced integer-micros transaction'
);

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

select ok(
  (public.start_run_barrier(
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000001',
    true,
    'start-run-key',
    'start-run-request'
  ) ->> 'run_id') is not null,
  'barrier returns a durable run ID'
);

select is(
  (select count(*)::integer from public.runs where quote_id = '44000000-0000-4000-8000-000000000001'),
  1,
  'barrier creates exactly one run'
);
select is(
  (select count(*)::integer from public.cost_reservations where quote_id = '44000000-0000-4000-8000-000000000001'),
  1,
  'barrier creates exactly one reservation'
);
select is(
  (select count(*)::integer from public.attempts where run_id = (
    select id from public.runs where quote_id = '44000000-0000-4000-8000-000000000001'
  )),
  1,
  'barrier creates the initial ready attempt'
);
select is(
  (select count(*)::integer from public.outbox_events where aggregate_id = (
    select id from public.runs where quote_id = '44000000-0000-4000-8000-000000000001'
  )),
  1,
  'barrier creates one unique outbox event'
);
select is(
  (select count(*)::integer from public.ledger_transactions where entry_type = 'reserve'),
  2,
  'barrier appends one balanced reserve pair'
);
select is(
  (
    select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
    from public.ledger_transactions
    where account_code = 'wallet_available'
  ),
  3000000::bigint,
  'reserve reduces available wallet balance without fractional money'
);

select is(
  (public.start_run_barrier(
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000001',
    true,
    'start-run-key',
    'replay-request'
  ) ->> 'run_id')::uuid,
  (select id from public.runs where quote_id = '44000000-0000-4000-8000-000000000001'),
  'same-input idempotent replay returns the original run'
);
select is(
  (select count(*)::integer from public.runs where quote_id = '44000000-0000-4000-8000-000000000001'),
  1,
  'idempotent replay creates no duplicate run'
);

select is(
  pg_temp.error_of($sql$
    select public.start_run_barrier(
      '40000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '42100000-0000-4000-8000-000000000001',
      '44000000-0000-4000-8000-000000000002',
      true,
      'start-run-key',
      'changed-input-request'
    )
  $sql$),
  'P0001:IDEMPOTENCY_CONFLICT',
  'same key with changed input fails closed'
);

select is(
  pg_temp.error_of($sql$
    select public.start_run_barrier(
      '40000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '42100000-0000-4000-8000-000000000001',
      '44000000-0000-4000-8000-000000000002',
      true,
      'expired-run-key',
      'expired-run-request'
    )
  $sql$),
  'P0001:QUOTE_EXPIRED',
  'expired quote aborts the barrier'
);
select is(
  (select count(*)::integer from public.runs where quote_id = '44000000-0000-4000-8000-000000000002'),
  0,
  'expired barrier leaves no run'
);
select is(
  (select count(*)::integer from public.idempotency_records where idempotency_key = 'expired-run-key'),
  0,
  'expired barrier rolls back its idempotency result'
);
select is(
  (select count(*)::integer from public.outbox_events where dedupe_key like '%expired-run-key%'),
  0,
  'expired barrier leaves no outbox effect'
);

select ok(
  (public.apply_canvas_revision(
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    1,
    '{"nodes":[{"id":"node-1"},{"id":"node-2"}],"edges":[]}'::jsonb,
    'add node',
    'revision-key',
    'revision-request'
  ) ->> 'revision_id') is not null,
  'expected-head RPC creates an immutable child revision'
);
select is(
  (public.apply_canvas_revision(
    '40000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '42100000-0000-4000-8000-000000000001',
    1,
    '{"nodes":[{"id":"node-1"},{"id":"node-2"}],"edges":[]}'::jsonb,
    'add node',
    'revision-key',
    'revision-replay'
  ) ->> 'revision_id')::uuid,
  (
    select head_revision_id from public.canvases
    where id = '42000000-0000-4000-8000-000000000001'
  ),
  'revision replay returns the same child after the head advances'
);
select is(
  (
    select count(*)::integer from public.canvas_revisions
    where canvas_id = '42000000-0000-4000-8000-000000000001'
  ),
  2,
  'revision replay creates no duplicate child'
);
select is(
  pg_temp.error_of($sql$
    select public.apply_canvas_revision(
      '40000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '42100000-0000-4000-8000-000000000001',
      1,
      '{"nodes":[],"edges":[]}'::jsonb,
      'changed input',
      'revision-key',
      'revision-conflict'
    )
  $sql$),
  'P0001:IDEMPOTENCY_CONFLICT',
  'revision key reuse with changed graph conflicts'
);

reset role;

select is(
  pg_temp.error_of($sql$
    update public.quotes
    set maximum_charge_micros = 1
    where id = '44000000-0000-4000-8000-000000000001'
  $sql$),
  '55000:quotes_IMMUTABLE',
  'quotes cannot be updated'
);
select is(
  pg_temp.error_of($sql$
    delete from public.quotes
    where id = '44000000-0000-4000-8000-000000000001'
  $sql$),
  '55000:quotes_IMMUTABLE',
  'quotes cannot be deleted'
);
select is(
  (
    select extract(epoch from (expires_at - created_at))::integer
    from public.quotes
    where id = '44000000-0000-4000-8000-000000000001'
  ),
  900,
  'quotes are immutable exact 15-minute offers'
);

select is(
  pg_temp.error_of($sql$
    update public.canvas_revisions
    set reason = 'mutated'
    where canvas_id = '42000000-0000-4000-8000-000000000001'
  $sql$),
  '55000:canvas_revisions_IMMUTABLE',
  'canvas revisions cannot be updated'
);
select is(
  pg_temp.error_of($sql$
    delete from public.canvas_revisions
    where id = '42100000-0000-4000-8000-000000000001'
  $sql$),
  '55000:canvas_revisions_IMMUTABLE',
  'canvas revisions cannot be deleted'
);

select is(
  pg_temp.error_of($sql$
    insert into public.canvas_revisions (
      id, workspace_id, canvas_id, parent_revision_id, graph_schema_version,
      graph_snapshot, canonical_hash, actor_type, actor_id, reason
    ) values (
      '42100000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '42100000-0000-4000-8000-000000000002',
      1,
      '{"nodes":[],"edges":[]}'::jsonb,
      repeat('7', 64),
      'user',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'wrong canvas parent'
    )
  $sql$),
  '23503:REVISION_PARENT_NOT_FOUND',
  'parent revision must belong to the same workspace and canvas'
);
select is(
  pg_temp.error_of($sql$
    insert into public.canvas_revisions (
      id, workspace_id, canvas_id, parent_revision_id, graph_schema_version,
      graph_snapshot, canonical_hash, actor_type, actor_id, reason
    ) values (
      '42100000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '42100000-0000-4000-8000-000000000004',
      1,
      '{"nodes":[],"edges":[]}'::jsonb,
      repeat('8', 64),
      'user',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'self parent'
    )
  $sql$),
  '23514:REVISION_PARENT_SELF_REFERENCE',
  'revision cannot parent itself'
);

select is(
  pg_temp.error_of('select pg_temp.insert_unbalanced_ledger()'),
  '23514:LEDGER_TRANSACTION_UNBALANCED',
  'deferred ledger constraint rejects an unbalanced group'
);
select is(
  pg_temp.error_of($sql$
    update public.ledger_transactions
    set amount_micros = amount_micros + 1
    where causative_key = 'initial-credit'
  $sql$),
  '55000:ledger_transactions_IMMUTABLE',
  'ledger entries cannot be updated'
);
select is(
  pg_temp.error_of($sql$
    delete from public.ledger_transactions
    where causative_key = 'initial-credit'
  $sql$),
  '55000:ledger_transactions_IMMUTABLE',
  'ledger entries cannot be deleted'
);
select is(
  (
    select count(*)::integer
    from (
      select transaction_id
      from public.ledger_transactions
      group by transaction_id
      having sum(case direction when 'credit' then amount_micros else -amount_micros end) <> 0
    ) as unbalanced
  ),
  0,
  'every persisted ledger transaction sums to zero'
);
select is(
  split_part(pg_temp.error_of($sql$
    insert into public.ledger_transactions (
      workspace_id, transaction_id, entry_type, account_code, direction, amount_micros, causative_key
    ) values (
      '40000000-0000-4000-8000-000000000001',
      '49900000-0000-4000-8000-000000000002',
      'credit',
      'wallet_available',
      'credit',
      -1,
      'negative-fixture'
    )
  $sql$), ':', 1),
  '23514',
  'negative micros are rejected by the ledger schema'
);

select is(
  (public.record_ledger_movement(
    '40000000-0000-4000-8000-000000000001',
    'credit',
    1000000,
    'machine-credit',
    null,
    null,
    'machine-credit-request',
    '{}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'machine ledger RPC writes the first semantic credit once'
);
select is(
  (public.record_ledger_movement(
    '40000000-0000-4000-8000-000000000001',
    'credit',
    1000000,
    'machine-credit',
    null,
    null,
    'machine-credit-replay',
    '{}'::jsonb
  ) ->> 'replayed')::boolean,
  true,
  'machine ledger RPC replays a duplicate causative key'
);
select is(
  (select count(*)::integer from public.ledger_transactions where causative_key = 'machine-credit'),
  2,
  'machine credit replay creates no duplicate money movement'
);
select is(
  (
    select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
    from public.ledger_transactions
    where account_code = 'wallet_available'
  ),
  4000000::bigint,
  'wallet balance reflects credit minus the immutable reservation'
);
select is(
  (select count(*)::integer from public.idempotency_records where operation = 'start_run'),
  1,
  'only the successful barrier owns a start-run idempotency result'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'run.started'),
  1,
  'successful barrier emits one append-only audit event'
);

select * from finish();

rollback;
