begin;

select plan(1);

select has_schema('app_private', 'app_private schema exists');

select * from finish();

rollback;
