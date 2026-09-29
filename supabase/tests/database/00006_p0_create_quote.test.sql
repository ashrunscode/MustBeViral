begin;

select plan(12);

create temporary table quote_graph_fixture (graph_snapshot jsonb not null);
create temporary table quote_result (payload jsonb not null);
grant select on pg_temp.quote_graph_fixture to authenticated;
grant select, insert on pg_temp.quote_result to authenticated;

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

insert into quote_graph_fixture (graph_snapshot)
select jsonb_build_object(
  'nodes',
  jsonb_agg(
    jsonb_build_object(
      'id', node.role || '-' || node.ordinal::text,
      'kind', 'output',
      'parameter_schema_version', 1,
      'parameters',
        case
          when node.role = 'motion_branch'
            then jsonb_build_object('asset_role', node.role, 'duration_seconds', 8)
          else jsonb_build_object('asset_role', node.role)
        end
    )
    order by node.sort_order, node.ordinal
  ),
  'edges',
  '[]'::jsonb
)
from (
  select 'copy_set'::text as role, ordinal, 1 as sort_order
  from generate_series(1, 3) as ordinal
  union all
  select 'master_static', ordinal, 2
  from generate_series(1, 3) as ordinal
  union all
  select 'adaptation', ordinal, 3
  from generate_series(1, 9) as ordinal
  union all
  select 'motion_branch', 1, 4
) as node;

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
) values
  (
    'e1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'quote-owner@example.test',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'quote-non-owner@example.test',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.workspaces (
  id,
  name,
  slug,
  status,
  created_by,
  per_run_spend_cap_micros,
  daily_spend_cap_micros
) values (
  'e2000000-0000-4000-8000-000000000001',
  'Quote RPC Workspace',
  'quote-rpc-workspace',
  'active',
  'e1000000-0000-4000-8000-000000000001',
  8000000,
  25000000
);

insert into public.workspace_memberships (
  id,
  workspace_id,
  user_id,
  role,
  status
) values (
  'e3000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'owner',
  'active'
);

insert into public.projects (
  id,
  workspace_id,
  name,
  status,
  created_by
) values (
  'e4000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'Quote RPC Project',
  'active',
  'e1000000-0000-4000-8000-000000000001'
);

insert into public.canvases (
  id,
  workspace_id,
  project_id,
  name,
  head_revision_id,
  created_by
) values (
  'e5000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',
  'Quote RPC Canvas',
  null,
  'e1000000-0000-4000-8000-000000000001'
);

insert into public.canvas_revisions (
  id,
  workspace_id,
  canvas_id,
  parent_revision_id,
  graph_schema_version,
  graph_snapshot,
  canonical_hash,
  actor_type,
  actor_id,
  reason
) select
  'e6000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000001',
  null,
  1,
  graph_snapshot,
  repeat('1', 64),
  'user',
  'e1000000-0000-4000-8000-000000000001',
  'non-head fixture'
from quote_graph_fixture;

update public.canvases
set head_revision_id = 'e6000000-0000-4000-8000-000000000001'
where id = 'e5000000-0000-4000-8000-000000000001';

insert into public.canvas_revisions (
  id,
  workspace_id,
  canvas_id,
  parent_revision_id,
  graph_schema_version,
  graph_snapshot,
  canonical_hash,
  actor_type,
  actor_id,
  reason
) select
  'e6000000-0000-4000-8000-000000000002',
  'e2000000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000001',
  1,
  graph_snapshot,
  repeat('2', 64),
  'user',
  'e1000000-0000-4000-8000-000000000001',
  'launch-pack head fixture'
from quote_graph_fixture;

update public.canvases
set head_revision_id = 'e6000000-0000-4000-8000-000000000002'
where id = 'e5000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';

insert into quote_result (payload)
select public.create_quote(
  'e2000000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000002',
  'quote-key',
  'quote-request'
);

select ok(
  (select (payload ->> 'quote_id')::uuid is not null from quote_result),
  'honest create_quote succeeds with a persisted quote identifier'
);

select is(
  (select payload ->> 'maximum_charge_micros' from quote_result),
  '4550000',
  'honest create_quote returns the graph-derived 4,550,000-micro maximum'
);

select is(
  (
    select maximum_charge_micros
    from public.quotes
    where id = (select (payload ->> 'quote_id')::uuid from quote_result)
  ),
  4550000::bigint,
  'the persisted quote stores the server-derived amount'
);

select is(
  (
    select sum((plan.line ->> 'total_micros')::bigint)
    from public.quotes as quote
    cross join lateral jsonb_array_elements(quote.execution_plan) as plan(line)
    where quote.id = (select (payload ->> 'quote_id')::uuid from quote_result)
  ),
  4550000::numeric,
  'the persisted execution plan lines sum to the authoritative quote total'
);

select is(
  (
    select array_to_string(procedure.proargnames, ',')
    from pg_proc as procedure
    where procedure.oid =
      'public.create_quote(uuid,uuid,uuid,text,text)'::regprocedure
  ),
  'p_workspace_id,p_canvas_id,p_expected_revision_id,p_idempotency_key,p_request_id',
  'create_quote exposes no client-supplied plan, catalog, or amount input to forge'
);

select is(
  (
    public.create_quote(
      'e2000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000002',
      'quote-key',
      'quote-replay-request'
    ) ->> 'quote_id'
  )::uuid,
  (select (payload ->> 'quote_id')::uuid from quote_result),
  'idempotent replay returns the original quote identifier'
);

select is(
  (
    select count(*)::integer
    from public.quotes
    where workspace_id = 'e2000000-0000-4000-8000-000000000001'
  ),
  1,
  'idempotent replay creates no duplicate quote'
);

select is(
  pg_temp.error_of($sql$
    select public.create_quote(
      'e2000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000001',
      'non-head-key',
      'non-head-request'
    )
  $sql$),
  'P0001:REVISION_CONFLICT',
  'a non-head expected revision is rejected'
);

set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000002';

select is(
  pg_temp.error_of($sql$
    select public.create_quote(
      'e2000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000002',
      'non-owner-key',
      'non-owner-request'
    )
  $sql$),
  '42501:FORBIDDEN',
  'a non-owner caller is forbidden'
);

reset role;
update public.workspaces
set per_run_spend_cap_micros = 0
where id = 'e2000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';

select is(
  pg_temp.error_of($sql$
    select public.create_quote(
      'e2000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000002',
      'zero-cap-key',
      'zero-cap-request'
    )
  $sql$),
  'P0001:BUDGET_EXCEEDED',
  'a zero per-run cap rejects a positive launch quote'
);

reset role;
update public.workspaces
set per_run_spend_cap_micros = 8000000
where id = 'e2000000-0000-4000-8000-000000000001';
set local session_replication_role = replica;
update public.price_catalog_versions
set status = 'draft'
where status = 'active';
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';

select is(
  pg_temp.error_of($sql$
    select public.create_quote(
      'e2000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000002',
      'stale-key',
      'stale-request'
    )
  $sql$),
  'P0001:QUOTE_STALE',
  'no active complete catalog fails closed with QUOTE_STALE'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where action = 'quote.created'
      and entity_id = (select (payload ->> 'quote_id')::uuid from quote_result)
  ),
  1,
  'successful quote creation appends exactly one audit event'
);

select * from finish();

rollback;
