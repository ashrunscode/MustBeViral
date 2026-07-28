begin;

select plan(14);

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

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'artifact-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values (
  'b2000000-0000-4000-8000-000000000001',
  'Artifact Workspace',
  'artifact-workspace',
  'b1000000-0000-4000-8000-000000000001'
);

insert into public.projects (id, workspace_id, name, status, created_by)
values (
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'Artifact Project',
  'active',
  'b1000000-0000-4000-8000-000000000001'
);

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values (
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'Artifact Canvas',
  'b1000000-0000-4000-8000-000000000001'
);

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot,
  canonical_hash, actor_type, actor_id, reason
) values (
  'b5000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  1,
  '{
    "nodes": [
      {"id":"master","kind":"image_generation","parameter_schema_version":1,"parameters":{"asset_role":"master_static"}},
      {"id":"adaptation","kind":"image_edit","parameter_schema_version":1,"parameters":{"asset_role":"adaptation"}},
      {"id":"full-master","kind":"image_generation","parameter_schema_version":1,"parameters":{"asset_role":"master_static"}}
    ],
    "edges": [
      {"id":"master-adaptation","kind":"dependency","source_node_id":"master","target_node_id":"adaptation"}
    ]
  }'::jsonb,
  repeat('b', 64),
  'user',
  'b1000000-0000-4000-8000-000000000001',
  'artifact fixture'
);

update public.canvases
set head_revision_id = 'b5000000-0000-4000-8000-000000000001'
where id = 'b4000000-0000-4000-8000-000000000001';

insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id,
  price_catalog_version_id, execution_plan, quote_hash,
  maximum_charge_micros, created_by, created_at, expires_at
) values
  (
    'b6000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    '0c000000-0000-4000-8000-000000000001',
    '[
      {"node_id":"master","model_route_id":"0b000000-0000-4000-8000-000000000002","price_components":[{"unit":"image","quantity":"1","unit_price_micros":"500000","total_micros":"500000"}],"total_micros":"500000"},
      {"node_id":"adaptation","model_route_id":"0b000000-0000-4000-8000-000000000003","price_components":[{"unit":"image","quantity":"1","unit_price_micros":"200000","total_micros":"200000"}],"total_micros":"200000"}
    ]'::jsonb,
    repeat('c', 64),
    700000,
    'b1000000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp() + interval '15 minutes'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    '0c000000-0000-4000-8000-000000000001',
    '[
      {"node_id":"full-master","model_route_id":"0b000000-0000-4000-8000-000000000002","price_components":[{"unit":"image","quantity":"1","unit_price_micros":"500000","total_micros":"500000"}],"total_micros":"500000"}
    ]'::jsonb,
    repeat('d', 64),
    500000,
    'b1000000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp() + interval '15 minutes'
  );

insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id,
  canvas_revision_hash, quote_id, status, confirmed_by
) values
  (
    'b7000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    repeat('b', 64),
    'b6000000-0000-4000-8000-000000000001',
    'running',
    'b1000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    repeat('b', 64),
    'b6000000-0000-4000-8000-000000000002',
    'running',
    'b1000000-0000-4000-8000-000000000001'
  );

insert into public.run_nodes (
  id, workspace_id, run_id, node_key, model_route_id, status
) values
  (
    'b8000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'master',
    '0b000000-0000-4000-8000-000000000002',
    'running'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'adaptation',
    '0b000000-0000-4000-8000-000000000003',
    'running'
  ),
  (
    'b8000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002',
    'full-master',
    '0b000000-0000-4000-8000-000000000002',
    'running'
  );

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id,
  attempt_number, request_id, status
) values
  (
    'b9000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    '0a000000-0000-4000-8000-000000000001',
    1,
    'billing-partial-success',
    'running'
  ),
  (
    'b9000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000002',
    '0a000000-0000-4000-8000-000000000001',
    1,
    'billing-partial-failed',
    'running'
  ),
  (
    'b9000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002',
    'b8000000-0000-4000-8000-000000000003',
    '0a000000-0000-4000-8000-000000000001',
    1,
    'billing-full-success',
    'running'
  );

insert into public.provider_jobs (
  id, workspace_id, run_id, attempt_id, provider_registration_id,
  provider_request_id, request_hash, status
) values
  (
    'ba000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'b9000000-0000-4000-8000-000000000001',
    '0a000000-0000-4000-8000-000000000001',
    'fal-job-partial-success',
    repeat('1', 64),
    'running'
  ),
  (
    'ba000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'b9000000-0000-4000-8000-000000000002',
    '0a000000-0000-4000-8000-000000000001',
    'fal-job-partial-failed',
    repeat('2', 64),
    'running'
  ),
  (
    'ba000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002',
    'b9000000-0000-4000-8000-000000000003',
    '0a000000-0000-4000-8000-000000000001',
    'fal-job-full-success',
    repeat('3', 64),
    'running'
  );

insert into public.cost_reservations (
  id, workspace_id, quote_id, run_id, amount_micros
) values
  (
    'bb000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    700000
  ),
  (
    'bb000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000002',
    500000
  );

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_artifact(uuid,uuid,text,text,text,text,text,bigint,uuid[],text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.register_artifact(uuid,uuid,text,text,text,text,text,bigint,uuid[],text)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.register_artifact(uuid,uuid,text,text,text,text,text,bigint,uuid[],text)',
    'execute'
  ),
  'artifact registration is executable only by the machine role'
);

select ok(
  not has_table_privilege('authenticated', 'public.artifacts', 'insert')
  and not has_table_privilege('anon', 'public.artifacts', 'insert')
  and not has_table_privilege('service_role', 'public.artifacts', 'insert'),
  'artifacts retain no direct insert grant'
);

select like(
  pg_temp.error_of($sql$
    insert into public.artifacts (
      workspace_id, project_id, run_id, run_node_id, canvas_revision_id,
      artifact_kind, status, object_key, content_hash, mime_type, byte_size
    ) values (
      'b2000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b7000000-0000-4000-8000-000000000001',
      'b8000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      'provider_output',
      'available',
      'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/no-hash',
      null,
      'image/png',
      24
    )
  $sql$),
  '23514:%',
  'an artifact cannot become available without a content hash'
);

select is(
  (public.register_artifact(
    'b7000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'provider_output',
    'available',
    'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/attempts/b9000000-0000-4000-8000-000000000001/provider-output',
    repeat('a', 64),
    'image/png',
    24
  ) ->> 'replayed')::boolean,
  false,
  'the first deterministic provider artifact registration inserts'
);

select is(
  (public.register_artifact(
    'b7000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001',
    'provider_output',
    'available',
    'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/attempts/b9000000-0000-4000-8000-000000000001/provider-output',
    repeat('a', 64),
    'image/png',
    24
  ) ->> 'replayed')::boolean,
  true,
  'replaying the same registration returns the existing artifact'
);

select is(
  (
    select count(*)::integer
    from public.artifacts
    where object_key =
      'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/attempts/b9000000-0000-4000-8000-000000000001/provider-output'
  ),
  1,
  'the unique deterministic object key holds one artifact row'
);

do $$
begin
  perform public.register_artifact(
    'b7000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000002',
    'approved_output',
    'available',
    'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/approved/adaptation',
    repeat('e', 64),
    'image/png',
    24
  );
end;
$$;

select is(
  (
    select relationship
    from public.artifact_lineage
    where child_artifact_id = (
      select id from public.artifacts
      where object_key =
        'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/approved/adaptation'
    )
  ),
  'adaptation',
  'graph-derived provider lineage uses the accepted adaptation relationship'
);

select like(
  pg_temp.error_of($sql$
    insert into public.artifact_lineage (
      workspace_id, parent_artifact_id, child_artifact_id, relationship
    )
    select
      'b2000000-0000-4000-8000-000000000001',
      (
        select id
        from public.artifacts
        where object_key like '%/attempts/%/provider-output'
        order by id
        limit 1
      ),
      (
        select id
        from public.artifacts
        where object_key like '%/approved/adaptation'
        order by id
        limit 1
      ),
      'generated_from'
  $sql$),
  '23514:%',
  'lineage relationship values remain constrained to the accepted vocabulary'
);

do $$
declare
  v_artifact_id uuid;
begin
  v_artifact_id := (
    public.register_artifact(
      'b7000000-0000-4000-8000-000000000002',
      'b8000000-0000-4000-8000-000000000003',
      'provider_output',
      'available',
      'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000002/attempts/b9000000-0000-4000-8000-000000000003/provider-output',
      repeat('f', 64),
      'image/png',
      24
    ) -> 'artifact' ->> 'id'
  )::uuid;
  perform public.record_ledger_movement(
    'b2000000-0000-4000-8000-000000000001',
    'capture',
    500000,
    'run:b7000000-0000-4000-8000-000000000002:attempt:b9000000-0000-4000-8000-000000000003:capture',
    'bb000000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000002',
    'request-full-capture',
    '{}'::jsonb
  );
  perform public.advance_fal_provider_attempt(
    'fal-job-full-success',
    'succeeded',
    'event-full-success',
    v_artifact_id,
    500000
  );
end;
$$;

select is(
  (
    select status from public.runs
    where id = 'b7000000-0000-4000-8000-000000000002'
  ),
  'succeeded',
  'a run with every attempt succeeded reaches succeeded'
);

select is(
  (
    select amount_micros - captured_micros - released_micros
    from public.cost_reservations
    where id = 'bb000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'a fully captured successful run leaves zero residual reservation'
);

do $$
declare
  v_artifact_id uuid;
begin
  v_artifact_id := (
    select id from public.artifacts
    where object_key =
      'workspaces/b2000000-0000-4000-8000-000000000001/runs/b7000000-0000-4000-8000-000000000001/attempts/b9000000-0000-4000-8000-000000000001/provider-output'
  );
  perform public.record_ledger_movement(
    'b2000000-0000-4000-8000-000000000001',
    'capture',
    500000,
    'run:b7000000-0000-4000-8000-000000000001:attempt:b9000000-0000-4000-8000-000000000001:capture',
    'bb000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'request-partial-capture',
    '{}'::jsonb
  );
  perform public.advance_fal_provider_attempt(
    'fal-job-partial-success',
    'succeeded',
    'event-partial-success',
    v_artifact_id,
    500000
  );
  perform public.record_ledger_movement(
    'b2000000-0000-4000-8000-000000000001',
    'release',
    200000,
    'run:b7000000-0000-4000-8000-000000000001:attempt:b9000000-0000-4000-8000-000000000002:release',
    'bb000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'request-partial-release',
    '{}'::jsonb
  );
  perform public.advance_fal_provider_attempt(
    'fal-job-partial-failed',
    'failed',
    'event-partial-failed'
  );
end;
$$;

select is(
  (
    select status from public.runs
    where id = 'b7000000-0000-4000-8000-000000000001'
  ),
  'partial_succeeded',
  'mixed succeeded and failed attempts reach partial_succeeded'
);

select is(
  (
    select amount_micros - captured_micros - released_micros
    from public.cost_reservations
    where id = 'bb000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a partial run captures delivered branches and releases the exact remainder'
);

select is(
  (
    select count(distinct transaction_id)::integer
    from public.ledger_transactions
    where causative_key =
      'run:b7000000-0000-4000-8000-000000000001:attempt:b9000000-0000-4000-8000-000000000001:capture'
  ),
  1,
  'the delivered partial branch has one idempotent capture transaction'
);

select is(
  (
    select get_fal_artifact_context('fal-job-partial-success') ->> 'attempt_id'
  ),
  'b9000000-0000-4000-8000-000000000001',
  'fal provider_request_id resolves through provider_jobs to the exact attempt'
);

select * from finish();

rollback;
