begin;

-- Fal FAILED webhooks settled the attempt without writing provider_error_code. Live GB-02
-- master failures then audited as provider_error_code null / reconciled_state running, so the
-- operator could not tell content-policy from an infrastructure miss. This RPC only merges a
-- short machine code onto the job evidence. It does not move money or attempt status.
create or replace function public.record_provider_job_error_code(
  p_provider_request_id text,
  p_provider_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_job public.provider_jobs%rowtype;
  v_existing text;
begin
  if p_provider_request_id is null
    or char_length(p_provider_request_id) not between 1 and 300
    or p_provider_error_code is null
    or p_provider_error_code !~ '^[A-Za-z0-9_.-]{1,80}$' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_job
  from public.provider_jobs
  where provider_request_id = p_provider_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  v_existing := v_job.normalized_evidence ->> 'provider_error_code';
  if v_existing is not null and v_existing <> p_provider_error_code then
    return jsonb_build_object(
      'status', v_job.status,
      'provider_error_code', v_existing,
      'replayed', true
    );
  end if;

  update public.provider_jobs
  set normalized_evidence = normalized_evidence || jsonb_build_object(
    'provider_error_code', p_provider_error_code
  )
  where id = v_job.id;

  return jsonb_build_object(
    'status', v_job.status,
    'provider_error_code', p_provider_error_code,
    'replayed', v_existing is not null
  );
end;
$fn$;

revoke all on function public.record_provider_job_error_code(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_provider_job_error_code(text, text)
  to service_role;

comment on function public.record_provider_job_error_code(text, text) is
  'Machine-only merge of a short provider error code onto provider_jobs.normalized_evidence. First write wins. Does not change job or attempt status.';

commit;
