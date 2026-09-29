begin;

-- The dispatch expansion returned a node's own parameters and its plan line, and nothing else. That
-- is enough for a copy node, which carries the whole brief in its own parameters, and insufficient
-- for everything else:
--
--   * Adaptation and motion nodes carry NO prompt material at all - only an asset_role and, for
--     motion, a duration. Without the run's brief and brand context, 10 of the launch pack's 16
--     nodes fail payload_invalid even with a working image_url.
--   * Those same 10 nodes need a fetchable image produced by a parent node. Nothing exposed which
--     artifact that is.
--
-- Both are added here as returned columns rather than as extra round trips from the Worker, so the
-- dispatch expansion stays the single statement that decides what a provider is asked to do.
--
-- upstream_images filters on mime_type like 'image/%' deliberately. motion-1's parents include a
-- copy node whose artifact is JSON; an unfiltered join would hand that JSON blob to Seedance as its
-- image_url.

-- Adding OUT columns changes the function's row type, which `create or replace` cannot do. The drop
-- and recreate happen in one transaction, so no window exists where dispatch has no expansion
-- function; and because the signature (uuid, text) is unchanged, every caller keeps resolving.
drop function if exists public.get_outbox_dispatch_attempts(uuid, text);

create function public.get_outbox_dispatch_attempts(
  p_event_id uuid,
  p_lease_owner text
)
returns table (
  event_id uuid,
  workspace_id uuid,
  run_id uuid,
  attempt_id uuid,
  provider_registration_id uuid,
  route_id text,
  billing_idempotency_key text,
  node_parameters jsonb,
  execution_plan_line jsonb,
  brief_context jsonb,
  upstream_images jsonb
)
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  if p_event_id is null
    or p_lease_owner is null or char_length(p_lease_owner) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    event.id,
    event.workspace_id,
    run.id,
    attempt.id,
    attempt.provider_registration_id,
    route.route_key,
    attempt.request_id,
    coalesce(node.item -> 'parameters', '{}'::jsonb),
    plan.item,
    brief_ctx.context,
    upstream.images
  from public.outbox_events as event
  join public.runs as run
    on run.workspace_id = event.workspace_id
   and run.id = event.aggregate_id
  join public.quotes as quote
    on quote.workspace_id = run.workspace_id
   and quote.id = run.quote_id
  join public.canvas_revisions as revision
    on revision.workspace_id = run.workspace_id
   and revision.canvas_id = run.canvas_id
   and revision.id = run.canvas_revision_id
  join public.run_nodes as run_node
    on run_node.workspace_id = run.workspace_id
   and run_node.run_id = run.id
  join public.attempts as attempt
    on attempt.workspace_id = run_node.workspace_id
   and attempt.run_node_id = run_node.id
  join public.model_routes as route
    on route.id = run_node.model_route_id
   and route.provider_registration_id = attempt.provider_registration_id
  cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'nodes') as node(item)
  cross join lateral jsonb_array_elements(quote.execution_plan) as plan(item)
  -- Brief and brand context are run-wide inputs every node reads. Kept as two named objects rather
  -- than merged, so a key present in both cannot silently shadow the other.
  cross join lateral (
    select jsonb_build_object(
      'brief', coalesce((
        select context_node.item -> 'parameters'
        from jsonb_array_elements(revision.graph_snapshot -> 'nodes') as context_node(item)
        where context_node.item ->> 'kind' = 'brief'
        limit 1
      ), '{}'::jsonb),
      'brand_context', coalesce((
        select context_node.item -> 'parameters'
        from jsonb_array_elements(revision.graph_snapshot -> 'nodes') as context_node(item)
        where context_node.item ->> 'kind' = 'brand_context'
        limit 1
      ), '{}'::jsonb)
    ) as context
  ) as brief_ctx
  cross join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'artifact_id', artifact.id,
          'object_key', artifact.object_key,
          'content_hash', artifact.content_hash,
          'byte_size', artifact.byte_size,
          'mime_type', artifact.mime_type
        )
        order by artifact.created_at, artifact.id
      ),
      '[]'::jsonb
    ) as images
    from jsonb_array_elements(revision.graph_snapshot -> 'edges') as edge(item)
    join public.run_nodes as parent
      on parent.workspace_id = run.workspace_id
     and parent.run_id = run.id
     and parent.node_key = edge.item ->> 'source_node_id'
    join public.artifacts as artifact
      on artifact.workspace_id = run.workspace_id
     and artifact.run_node_id = parent.id
     and artifact.status = 'available'
     and artifact.artifact_kind in ('provider_output', 'approved_output')
     and artifact.mime_type like 'image/%'
    where edge.item ->> 'target_node_id' = run_node.node_key
  ) as upstream
  where event.id = p_event_id
    and event.status = 'leased'
    and event.lease_owner = p_lease_owner
    and event.event_type = 'run.dispatch_requested'
    and event.aggregate_type = 'run'
    and run.status not in ('cancel_requested', 'canceled', 'failed', 'succeeded', 'partial_succeeded')
    and run_node.status = 'ready'
    and attempt.status = 'created'
    and node.item ->> 'id' = run_node.node_key
    and plan.item ->> 'node_id' = run_node.node_key
    and plan.item ->> 'model_route_id' = route.id::text
  order by attempt.created_at, attempt.id;
end;
$fn$;

-- DROP FUNCTION above clears every grant on the object - `create or replace` cannot change a row
-- type, but it also cannot lose grants the way a drop-then-create does. The default-privileges
-- bootstrap (20260719010000, line 9) revokes execute from every role including service_role for
-- every future function, so the explicit re-grant below is load-bearing, not defensive: without it
-- every dispatch cron tick fails closed with "provider outbox persistence rejected the privileged
-- credential" and no attempt is ever submitted. Discovered live on staging after this migration
-- shipped without it - the reason to grep for `drop function` before every deploy from now on.
revoke all on function public.get_outbox_dispatch_attempts(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.get_outbox_dispatch_attempts(uuid, text) to service_role;

commit;
