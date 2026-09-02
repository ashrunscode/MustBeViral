-- Production hardening: every application table is RLS-enabled and forced.
begin;

alter table public.provider_registrations enable row level security;
alter table public.price_catalog_versions enable row level security;
alter table public.model_routes enable row level security;
alter table public.model_route_prices enable row level security;

create policy provider_registrations_authenticated_select
on public.provider_registrations for select to authenticated using (true);

create policy price_catalog_versions_authenticated_select
on public.price_catalog_versions for select to authenticated using (true);

create policy model_routes_authenticated_select
on public.model_routes for select to authenticated using (true);

create policy model_route_prices_authenticated_select
on public.model_route_prices for select to authenticated using (true);

alter table public.provider_registrations force row level security;
alter table public.price_catalog_versions force row level security;
alter table public.model_routes force row level security;
alter table public.model_route_prices force row level security;
alter table public.api_keys force row level security;
alter table public.oauth_clients force row level security;
alter table public.oauth_access_tokens force row level security;
alter table public.skills force row level security;
alter table public.skill_versions force row level security;
alter table public.stripe_webhook_events force row level security;
alter table public.workspace_billing_profiles force row level security;

commit;
