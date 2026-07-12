begin;

create schema if not exists app_private;

revoke all on schema app_private from public, anon, authenticated;

alter default privileges in schema app_private
  revoke all on tables from public, anon, authenticated;

alter default privileges in schema app_private
  revoke all on sequences from public, anon, authenticated;

alter default privileges in schema app_private
  revoke all on functions from public, anon, authenticated;

comment on schema app_private is
  'Private implementation objects; access is granted only by reviewed migrations.';

commit;
