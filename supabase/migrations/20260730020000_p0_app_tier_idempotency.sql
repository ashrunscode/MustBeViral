begin;

-- Durable idempotency for the operations whose RPCs do not record their own.
--
-- The app-tier idempotency port was a passthrough: it ran the work and reported 'created' every
-- time. Real duplicate protection existed only inside the five RPCs that write idempotency_records
-- themselves (create_workspace, create_canvas_with_revision, apply_canvas_revision,
-- start_run_barrier, create_quote). create_project, cancel_run, create_export and
-- create_artifact_upload had none, despite the transport requiring an Idempotency-Key header - a
-- retried create_export must not double-write the receipt that is the product.
--
-- The operation allowlist is enforced HERE, in SQL, not just in the Worker: the RPC-owned
-- operations insert into the same unique (workspace_id, actor_id, operation, idempotency_key)
-- tuple, and an app-tier record for one of them would collide with - or worse, mask - the RPC's
-- own record. Rows are immutable, so the design is find-first, record-after-work, with the unique
-- index resolving races: the loser of a concurrent insert re-reads and replays the winner.

create or replace function app_private.assert_app_idempotency_input(
  p_workspace_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text
)
returns uuid
language plpgsql
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_workspace_id is null
    or p_operation is null
    or p_operation not in (
      'create_project', 'cancel_run', 'create_export', 'create_artifact_upload',
      'approve_artifacts'
    )
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if not app_private.is_workspace_owner(p_workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return v_actor_id;
end;
$fn$;

revoke all on function app_private.assert_app_idempotency_input(uuid, text, text, text)
  from public;

create or replace function public.find_app_idempotency(
  p_workspace_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid;
  v_row public.idempotency_records%rowtype;
begin
  v_actor_id := app_private.assert_app_idempotency_input(
    p_workspace_id, p_operation, p_idempotency_key, p_request_hash);

  select * into v_row
  from public.idempotency_records
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key;

  if not found then
    return jsonb_build_object('status', 'absent');
  end if;
  if v_row.request_hash = p_request_hash then
    return jsonb_build_object('status', 'replay', 'response', v_row.response_payload);
  end if;
  return jsonb_build_object('status', 'conflict');
end;
$fn$;

revoke all on function public.find_app_idempotency(uuid, text, text, text) from public;
grant execute on function public.find_app_idempotency(uuid, text, text, text) to authenticated;

create or replace function public.record_app_idempotency(
  p_workspace_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid;
  v_row public.idempotency_records%rowtype;
begin
  v_actor_id := app_private.assert_app_idempotency_input(
    p_workspace_id, p_operation, p_idempotency_key, p_request_hash);
  if p_response is null or jsonb_typeof(p_response) <> 'object' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  insert into public.idempotency_records (
    workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload
  ) values (
    p_workspace_id, v_actor_id, p_operation, p_idempotency_key, p_request_hash, p_response
  )
  -- Must mirror idempotency_records_contract_key_idx exactly: it is an expression index over
  -- coalesce(workspace_id, ...), and a plain column list would not match it.
  on conflict (
    actor_id,
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    operation,
    idempotency_key
  ) do nothing;

  if found then
    return jsonb_build_object('status', 'recorded');
  end if;

  -- Lost a race or retried after a crash between work and record. The stored row decides.
  select * into v_row
  from public.idempotency_records
  where workspace_id = p_workspace_id
    and actor_id = v_actor_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key;

  if v_row.request_hash = p_request_hash then
    return jsonb_build_object('status', 'replay', 'response', v_row.response_payload);
  end if;
  return jsonb_build_object('status', 'conflict');
end;
$fn$;

revoke all on function public.record_app_idempotency(uuid, text, text, text, jsonb) from public;
grant execute on function public.record_app_idempotency(uuid, text, text, text, jsonb)
  to authenticated;

commit;
