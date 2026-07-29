begin;

-- Makes price catalog rotation possible at all.
--
-- app_private.reject_immutable_mutation() raises unconditionally on UPDATE and DELETE, and
-- price_catalog_versions_one_active_idx permits exactly one row with status='active'. Together
-- those made a second catalog version impossible to activate: the incumbent could never be
-- retired, so a successor could only ever sit in 'draft'. Prices were not merely immutable, they
-- were unchangeable for the life of the database.
--
-- The schema already anticipated retirement - price_catalog_versions_check requires retired_at
-- whenever status='retired' - but no code path could ever satisfy it, so that constraint was
-- unreachable. This narrows the guard to permit exactly that one documented transition and
-- nothing else.
--
-- What stays forbidden: DELETE, any transition other than active -> retired, and any change to
-- pricing identity (version, currency, source_hash, source_ref, effective_at, created_at,
-- provider_registration_id, id) even while retiring. model_route_prices remains fully immutable,
-- so the amounts a quote was built from can still never be rewritten.

create or replace function app_private.reject_price_catalog_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'price_catalog_versions_IMMUTABLE';
  end if;

  -- Retirement is the only permitted transition, and only away from the active version.
  if old.status is distinct from 'active'
    or new.status is distinct from 'retired'
    or new.retired_at is null
  then
    raise exception using errcode = '55000', message = 'price_catalog_versions_IMMUTABLE';
  end if;

  -- Retiring must not become a back door for editing what a quote was priced from.
  if new.id is distinct from old.id
    or new.provider_registration_id is distinct from old.provider_registration_id
    or new.version is distinct from old.version
    or new.currency is distinct from old.currency
    or new.source_hash is distinct from old.source_hash
    or new.source_ref is distinct from old.source_ref
    or new.effective_at is distinct from old.effective_at
    or new.created_at is distinct from old.created_at
  then
    raise exception using errcode = '55000', message = 'price_catalog_versions_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function app_private.reject_price_catalog_version_mutation() from public;

drop trigger price_catalog_versions_immutable on public.price_catalog_versions;

create trigger price_catalog_versions_retire_only
  before delete or update on public.price_catalog_versions
  for each row
  execute function app_private.reject_price_catalog_version_mutation();

commit;
