-- P1b: security-definer RPCs for API keys, OAuth client credentials, and immutable Skills
begin;

create or replace function app_private.valid_api_key_scopes(p_scopes text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_scopes is not null
    and coalesce(array_length(p_scopes, 1), 0) >= 1
    and p_scopes <@ array[
      'workspace:read',
      'workspace:write',
      'canvas:read',
      'canvas:write',
      'run:read',
      'run:write',
      'artifact:read',
      'artifact:write',
      'export:write',
      'model:read',
      'receipt:read'
    ]::text[];
$$;

revoke all on function app_private.valid_api_key_scopes(text[])
from public, anon, authenticated, service_role;

create or replace function public.create_api_key(
  p_workspace_id uuid,
  p_name text,
  p_scopes text[],
  p_prefix text,
  p_secret_hash text,
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_key_id uuid := gen_random_uuid();
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_workspace_id is null
    or p_name is null or char_length(p_name) not between 1 and 120
    or p_prefix is null or char_length(p_prefix) not between 8 and 32
    or p_secret_hash is null or char_length(p_secret_hash) < 32
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200
    or not app_private.valid_api_key_scopes(p_scopes) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = v_actor_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'name', p_name,
    'scopes', to_jsonb(p_scopes),
    'prefix', p_prefix
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':create_api_key:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'create_api_key'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  insert into public.api_keys (
    id,
    workspace_id,
    created_by,
    name,
    prefix,
    secret_hash,
    scopes
  ) values (
    v_key_id,
    p_workspace_id,
    v_actor_id,
    p_name,
    p_prefix,
    p_secret_hash,
    p_scopes
  );

  v_response := jsonb_build_object(
    'key_id', v_key_id,
    'workspace_id', p_workspace_id,
    'name', p_name,
    'prefix', p_prefix,
    'scopes', to_jsonb(p_scopes),
    'created_at', statement_timestamp()
  );

  insert into public.idempotency_records (
    workspace_id,
    actor_id,
    operation,
    idempotency_key,
    request_hash,
    response_payload
  ) values (
    p_workspace_id,
    v_actor_id,
    'create_api_key',
    p_idempotency_key,
    v_request_hash,
    v_response
  );

  insert into public.audit_events (
    workspace_id,
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'api_key.created',
    'api_key',
    v_key_id,
    p_request_id,
    jsonb_build_object('prefix', p_prefix, 'scopes', to_jsonb(p_scopes))
  );

  return v_response;
end;
$$;

create or replace function public.revoke_api_key(
  p_key_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_row public.api_keys%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_key_id is null
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_row
  from public.api_keys
  where id = p_key_id
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = v_row.workspace_id
      and membership.user_id = v_actor_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if v_row.revoked_at is null then
    update public.api_keys
    set revoked_at = statement_timestamp()
    where id = p_key_id;

    insert into public.audit_events (
      workspace_id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      request_id,
      details
    ) values (
      v_row.workspace_id,
      'user',
      v_actor_id,
      'api_key.revoked',
      'api_key',
      p_key_id,
      p_request_id,
      jsonb_build_object('prefix', v_row.prefix)
    );
  end if;

  return jsonb_build_object(
    'key_id', p_key_id,
    'revoked_at', coalesce(
      (select revoked_at from public.api_keys where id = p_key_id),
      statement_timestamp()
    )
  );
end;
$$;

create or replace function public.create_oauth_client(
  p_workspace_id uuid,
  p_name text,
  p_client_id text,
  p_client_secret_hash text,
  p_scopes text[],
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_client_uuid uuid := gen_random_uuid();
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_workspace_id is null
    or p_name is null or char_length(p_name) not between 1 and 120
    or p_client_id is null or char_length(p_client_id) not between 8 and 120
    or p_client_secret_hash is null or char_length(p_client_secret_hash) < 32
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200
    or not app_private.valid_api_key_scopes(p_scopes) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = v_actor_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'name', p_name,
    'client_id', p_client_id,
    'scopes', to_jsonb(p_scopes)
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':create_oauth_client:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'create_oauth_client'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  insert into public.oauth_clients (
    id,
    workspace_id,
    created_by,
    client_id,
    client_secret_hash,
    name,
    scopes
  ) values (
    v_client_uuid,
    p_workspace_id,
    v_actor_id,
    p_client_id,
    p_client_secret_hash,
    p_name,
    p_scopes
  );

  v_response := jsonb_build_object(
    'client_uuid', v_client_uuid,
    'workspace_id', p_workspace_id,
    'client_id', p_client_id,
    'name', p_name,
    'scopes', to_jsonb(p_scopes),
    'created_at', statement_timestamp()
  );

  insert into public.idempotency_records (
    workspace_id,
    actor_id,
    operation,
    idempotency_key,
    request_hash,
    response_payload
  ) values (
    p_workspace_id,
    v_actor_id,
    'create_oauth_client',
    p_idempotency_key,
    v_request_hash,
    v_response
  );

  insert into public.audit_events (
    workspace_id,
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'oauth_client.created',
    'oauth_client',
    v_client_uuid,
    p_request_id,
    jsonb_build_object('client_id', p_client_id, 'scopes', to_jsonb(p_scopes))
  );

  return v_response;
end;
$$;

create or replace function public.revoke_oauth_client(
  p_client_uuid uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_row public.oauth_clients%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_client_uuid is null
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_row
  from public.oauth_clients
  where id = p_client_uuid
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = v_row.workspace_id
      and membership.user_id = v_actor_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if v_row.revoked_at is null then
    update public.oauth_clients
    set revoked_at = statement_timestamp()
    where id = p_client_uuid;

    update public.oauth_access_tokens
    set revoked_at = statement_timestamp()
    where client_id = p_client_uuid
      and revoked_at is null;

    insert into public.audit_events (
      workspace_id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      request_id,
      details
    ) values (
      v_row.workspace_id,
      'user',
      v_actor_id,
      'oauth_client.revoked',
      'oauth_client',
      p_client_uuid,
      p_request_id,
      jsonb_build_object('client_id', v_row.client_id)
    );
  end if;

  return jsonb_build_object(
    'client_uuid', p_client_uuid,
    'revoked_at', coalesce(
      (select revoked_at from public.oauth_clients where id = p_client_uuid),
      statement_timestamp()
    )
  );
end;
$$;

create or replace function public.issue_oauth_access_token(
  p_client_id text,
  p_client_secret_hash text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_client public.oauth_clients%rowtype;
  v_token_id uuid := gen_random_uuid();
begin
  if p_client_id is null or char_length(p_client_id) < 8
    or p_client_secret_hash is null or char_length(p_client_secret_hash) < 32
    or p_token_hash is null or char_length(p_token_hash) < 32
    or p_expires_at is null or p_expires_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_client
  from public.oauth_clients
  where client_id = p_client_id
    and client_secret_hash = p_client_secret_hash
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  insert into public.oauth_access_tokens (
    id,
    client_id,
    actor_id,
    token_hash,
    scopes,
    expires_at
  ) values (
    v_token_id,
    v_client.id,
    v_client.created_by,
    p_token_hash,
    v_client.scopes,
    p_expires_at
  );

  return jsonb_build_object(
    'ok', true,
    'token_id', v_token_id,
    'workspace_id', v_client.workspace_id,
    'actor_id', v_client.created_by,
    'scopes', to_jsonb(v_client.scopes),
    'expires_at', p_expires_at
  );
end;
$$;

create or replace function public.revoke_oauth_access_token(
  p_token_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_row public.oauth_access_tokens%rowtype;
  v_client public.oauth_clients%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_token_id is null
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_row
  from public.oauth_access_tokens
  where id = p_token_id
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_client
  from public.oauth_clients
  where id = v_row.client_id
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = v_client.workspace_id
      and membership.user_id = v_actor_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if v_row.revoked_at is null then
    update public.oauth_access_tokens
    set revoked_at = statement_timestamp()
    where id = p_token_id;

    insert into public.audit_events (
      workspace_id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      request_id,
      details
    ) values (
      v_client.workspace_id,
      'user',
      v_actor_id,
      'oauth_access_token.revoked',
      'oauth_access_token',
      p_token_id,
      p_request_id,
      jsonb_build_object('client_id', v_client.client_id)
    );
  end if;

  return jsonb_build_object(
    'token_id', p_token_id,
    'revoked_at', coalesce(
      (select revoked_at from public.oauth_access_tokens where id = p_token_id),
      statement_timestamp()
    )
  );
end;
$$;

create or replace function public.publish_skill(
  p_workspace_id uuid,
  p_name text,
  p_title text,
  p_instructions text,
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_skill_id uuid;
  v_version_number integer;
  v_version_id uuid := gen_random_uuid();
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_workspace_id is null
    or p_name is null or char_length(p_name) not between 1 and 120
    or p_title is null or char_length(p_title) not between 1 and 200
    or p_instructions is null or char_length(p_instructions) not between 1 and 32000
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = v_actor_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'name', p_name,
    'title', p_title,
    'instructions', p_instructions
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':publish_skill:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'publish_skill'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  select id into v_skill_id
  from public.skills
  where workspace_id = p_workspace_id
    and name = p_name
  limit 1;

  if not found then
    v_skill_id := gen_random_uuid();
    insert into public.skills (id, workspace_id, created_by, name)
    values (v_skill_id, p_workspace_id, v_actor_id, p_name);
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.skill_versions
  where skill_id = v_skill_id;

  insert into public.skill_versions (
    id,
    skill_id,
    version_number,
    title,
    instructions,
    published_by
  ) values (
    v_version_id,
    v_skill_id,
    v_version_number,
    p_title,
    p_instructions,
    v_actor_id
  );

  v_response := jsonb_build_object(
    'skill_id', v_skill_id,
    'skill_version_id', v_version_id,
    'workspace_id', p_workspace_id,
    'name', p_name,
    'version_number', v_version_number,
    'title', p_title,
    'published_at', statement_timestamp()
  );

  insert into public.idempotency_records (
    workspace_id,
    actor_id,
    operation,
    idempotency_key,
    request_hash,
    response_payload
  ) values (
    p_workspace_id,
    v_actor_id,
    'publish_skill',
    p_idempotency_key,
    v_request_hash,
    v_response
  );

  insert into public.audit_events (
    workspace_id,
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'skill.published',
    'skill_version',
    v_version_id,
    p_request_id,
    jsonb_build_object('skill_id', v_skill_id, 'version_number', v_version_number)
  );

  return v_response;
end;
$$;

revoke all on function public.create_api_key(uuid, text, text[], text, text, text, text) from public;
revoke all on function public.revoke_api_key(uuid, text) from public;
revoke all on function public.create_oauth_client(uuid, text, text, text, text[], text, text) from public;
revoke all on function public.revoke_oauth_client(uuid, text) from public;
revoke all on function public.issue_oauth_access_token(text, text, text, timestamptz) from public;
revoke all on function public.revoke_oauth_access_token(uuid, text) from public;
revoke all on function public.publish_skill(uuid, text, text, text, text, text) from public;

grant execute on function public.create_api_key(uuid, text, text[], text, text, text, text) to authenticated;
grant execute on function public.revoke_api_key(uuid, text) to authenticated;
grant execute on function public.create_oauth_client(uuid, text, text, text, text[], text, text) to authenticated;
grant execute on function public.revoke_oauth_client(uuid, text) to authenticated;
grant execute on function public.revoke_oauth_access_token(uuid, text) to authenticated;
grant execute on function public.publish_skill(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.issue_oauth_access_token(text, text, text, timestamptz) to service_role;

commit;
