begin;

select plan(11);

-- The immutability guard on price_catalog_versions was narrowed so a catalog version can finally
-- be retired and a successor activated. Everything it forbade before must still be forbidden;
-- only the active -> retired transition is newly permitted. Each throws_ok below is a rule that
-- protects what an already-issued quote was priced from.

select throws_ok(
  $$delete from public.price_catalog_versions where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'a catalog version can never be deleted'
);

select throws_ok(
  $$update public.price_catalog_versions set source_hash = repeat('b', 64) where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'the evidence hash behind a catalog version can never be rewritten'
);

select throws_ok(
  $$update public.price_catalog_versions set source_ref = 'other.md' where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'the evidence reference behind a catalog version can never be rewritten'
);

select throws_ok(
  $$update public.price_catalog_versions set version = 'renamed' where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'a catalog version can never be renamed'
);

select throws_ok(
  $$update public.price_catalog_versions set effective_at = '2020-01-01T00:00:00+00' where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'a catalog version can never be back-dated'
);

select throws_ok(
  $$update public.price_catalog_versions set status = 'draft' where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'the active version can never be un-activated'
);

-- Retiring must not become a back door for editing priced facts.
select throws_ok(
  $$update public.price_catalog_versions
      set status = 'retired', retired_at = now(), source_hash = repeat('c', 64)
    where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'retiring cannot smuggle an edit to the evidence hash'
);

select throws_ok(
  $$update public.price_catalog_versions set status = 'retired' where status = 'active'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'retiring without recording retired_at is refused'
);

-- A version that is already retired is terminal: no further transitions.
select throws_ok(
  $$update public.price_catalog_versions set status = 'active', retired_at = null where status = 'retired'$$,
  '55000',
  'price_catalog_versions_IMMUTABLE',
  'a retired version can never be reactivated'
);

-- The amounts a quote was built from stay fully immutable; only the version lifecycle moved.
select throws_ok(
  $$update public.model_route_prices set unit_price_micros = 1$$,
  '55000',
  'model_route_prices_IMMUTABLE',
  'a published unit price can never be rewritten'
);

-- The one transition the product actually needs.
select lives_ok(
  $$update public.price_catalog_versions
      set status = 'retired', retired_at = now()
    where status = 'active'$$,
  'the active version can be retired so a successor can take over'
);

select * from finish();

rollback;
