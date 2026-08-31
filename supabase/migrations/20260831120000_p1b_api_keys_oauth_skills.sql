-- P1b: scoped API keys, OAuth client credentials, and immutable user-authored Skills
begin;

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  name text not null check (char_length(name) between 1 and 120),
  prefix text not null,
  secret_hash text not null,
  scopes text[] not null check (array_length(scopes, 1) >= 1),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint api_keys_prefix_key unique (prefix)
);

create index api_keys_workspace_id_idx on public.api_keys (workspace_id, created_at desc);

comment on table public.api_keys is
  'Workspace-scoped API keys; only secret hashes are stored. Revocation is immediate.';

create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  client_id text not null,
  client_secret_hash text not null,
  name text not null check (char_length(name) between 1 and 120),
  scopes text[] not null check (array_length(scopes, 1) >= 1),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint oauth_clients_client_id_key unique (client_id)
);

create index oauth_clients_workspace_id_idx on public.oauth_clients (workspace_id, created_at desc);

comment on table public.oauth_clients is
  'OAuth client credentials for machine-to-machine access; secrets are stored hashed only.';

create table public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  actor_id uuid not null references auth.users (id),
  token_hash text not null,
  scopes text[] not null check (array_length(scopes, 1) >= 1),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint oauth_access_tokens_token_hash_key unique (token_hash)
);

create index oauth_access_tokens_client_id_idx
  on public.oauth_access_tokens (client_id, expires_at desc);

comment on table public.oauth_access_tokens is
  'Short-lived OAuth access tokens issued from client credentials; revocation is immediate.';

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default statement_timestamp(),
  constraint skills_workspace_name_key unique (workspace_id, name)
);

create table public.skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(title) between 1 and 200),
  instructions text not null check (char_length(instructions) between 1 and 32000),
  published_at timestamptz not null default statement_timestamp(),
  published_by uuid not null references auth.users (id),
  constraint skill_versions_skill_version_key unique (skill_id, version_number)
);

create index skill_versions_skill_id_idx on public.skill_versions (skill_id, version_number desc);

comment on table public.skill_versions is
  'Immutable published Skill snapshots; edits create a new version and never mutate published rows.';

alter table public.api_keys enable row level security;
alter table public.oauth_clients enable row level security;
alter table public.oauth_access_tokens enable row level security;
alter table public.skills enable row level security;
alter table public.skill_versions enable row level security;

create policy api_keys_owner_select on public.api_keys
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = api_keys.workspace_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    )
  );

create policy oauth_clients_owner_select on public.oauth_clients
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = oauth_clients.workspace_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    )
  );

create policy oauth_access_tokens_owner_select on public.oauth_access_tokens
  for select to authenticated
  using (
    exists (
      select 1
      from public.oauth_clients as client
      join public.workspace_memberships as membership
        on membership.workspace_id = client.workspace_id
      where client.id = oauth_access_tokens.client_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    )
  );

create policy skills_member_select on public.skills
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = skills.workspace_id
        and membership.user_id = auth.uid()
    )
  );

create policy skill_versions_member_select on public.skill_versions
  for select to authenticated
  using (
    exists (
      select 1
      from public.skills as skill
      join public.workspace_memberships as membership
        on membership.workspace_id = skill.workspace_id
      where skill.id = skill_versions.skill_id
        and membership.user_id = auth.uid()
    )
  );

revoke all on public.api_keys from anon;
revoke all on public.oauth_clients from anon;
revoke all on public.oauth_access_tokens from anon;
grant select on public.api_keys to authenticated;
grant select on public.oauth_clients to authenticated;
grant select on public.oauth_access_tokens to authenticated;
grant select on public.skills to authenticated;
grant select on public.skill_versions to authenticated;

create or replace function public.verify_api_key(p_secret_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_row public.api_keys%rowtype;
begin
  if p_secret_hash is null or char_length(p_secret_hash) < 32 then
    return jsonb_build_object('ok', false);
  end if;

  select *
  into v_row
  from public.api_keys
  where secret_hash = p_secret_hash
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.api_keys
  set last_used_at = statement_timestamp()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'key_id', v_row.id,
    'workspace_id', v_row.workspace_id,
    'actor_id', v_row.created_by,
    'scopes', to_jsonb(v_row.scopes)
  );
end;
$$;

create or replace function public.verify_oauth_access_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_row public.oauth_access_tokens%rowtype;
  v_client public.oauth_clients%rowtype;
begin
  if p_token_hash is null or char_length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false);
  end if;

  select *
  into v_row
  from public.oauth_access_tokens
  where token_hash = p_token_hash
    and revoked_at is null
    and expires_at > statement_timestamp()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select *
  into v_client
  from public.oauth_clients
  where id = v_row.client_id
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'token_id', v_row.id,
    'client_id', v_client.client_id,
    'workspace_id', v_client.workspace_id,
    'actor_id', v_row.actor_id,
    'scopes', to_jsonb(v_row.scopes)
  );
end;
$$;

revoke all on function public.verify_api_key(text) from public;
revoke all on function public.verify_oauth_access_token(text) from public;
grant execute on function public.verify_api_key(text) to service_role;
grant execute on function public.verify_oauth_access_token(text) to service_role;

commit;
