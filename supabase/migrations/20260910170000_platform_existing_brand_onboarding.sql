begin;
-- Existing mapped brands can start onboarding without allocating another brand or tenant.
create function public.platform_onboarding_command(p_operation text,p_input jsonb,p_idempotency_key text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); ws uuid; st uuid; br uuid; result jsonb; draft jsonb; payload_hash text; replay public.idempotency_records%rowtype;
begin
  if actor is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  if p_operation is distinct from 'initialize_brand_draft' or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  perform app_private.platform_setup_validate(p_input,array['studio_id','workspace_id','brand_id']);
  ws:=(p_input->>'workspace_id')::uuid; st:=(p_input->>'studio_id')::uuid; br:=(p_input->>'brand_id')::uuid;
  payload_hash:=app_private.hash_canonical_json(p_input);
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||ws::text||':'||p_operation||':'||p_idempotency_key,0));
  perform app_private.lock_platform_workspace(ws,st);
  if not exists(select 1 from public.brands where id=br and workspace_id=ws) or app_private.platform_studio_role(st) is null
    or not exists(select 1 from public.workspace_access_grants g where g.studio_id=st and g.workspace_id=ws and (g.brand_id is null or g.brand_id=br)
      and app_private.platform_grant_current(g.id)) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  if app_private.platform_studio_role(st) not in ('owner','editor') or not exists(select 1 from public.workspace_access_grants g where g.studio_id=st and g.workspace_id=ws
    and (g.brand_id is null or g.brand_id=br) and 'brand:write'=any(g.actions) and app_private.platform_grant_current(g.id)) then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select * into replay from public.idempotency_records where actor_id=actor and workspace_id=ws and operation=p_operation and idempotency_key=p_idempotency_key;
  if found then
    if replay.request_hash<>payload_hash then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return replay.response_payload;
  end if;
  if not exists(select 1 from public.brands where id=br and workspace_id=ws and status='active') then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
  select to_jsonb(d) into draft from public.brand_onboarding_drafts d where workspace_id=ws and brand_id=br;
  if draft is null then
    insert into public.brand_onboarding_drafts(workspace_id,brand_id,origin_studio_id,created_by,updated_by)
      values(ws,br,st,actor,actor) returning to_jsonb(brand_onboarding_drafts.*) into draft;
    insert into public.audit_events(workspace_id,actor_type,actor_id,action,entity_type,entity_id,request_id,details)
      values(ws,'user',actor,'platform.initialize_brand_draft','platform_setup',(draft->>'id')::uuid,p_request_id,'{}');
  end if;
  result:=jsonb_build_object('record',draft);
  insert into public.idempotency_records(workspace_id,actor_id,operation,idempotency_key,request_hash,response_payload)
    values(ws,actor,p_operation,p_idempotency_key,payload_hash,result);
  return result;
end;
$$;
revoke all on function public.platform_onboarding_command(text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_onboarding_command(text,jsonb,text,text) to authenticated;
commit;
