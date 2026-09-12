begin;
create function public.platform_presentation_query(p_operation text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare st uuid; row_data jsonb; member_role text;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  if p_operation is distinct from 'get_studio_access' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  perform app_private.platform_setup_validate(p_input,array['studio_id']);
  st:=(p_input->>'studio_id')::uuid;
  select to_jsonb(s) into row_data from public.studios s where id=st;
  member_role:=app_private.platform_studio_role(st);
  if row_data is null or member_role is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  return jsonb_build_object('studio',row_data,'role',member_role);
end;
$$;
revoke all on function public.platform_presentation_query(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.platform_presentation_query(text,jsonb) to authenticated;
commit;
