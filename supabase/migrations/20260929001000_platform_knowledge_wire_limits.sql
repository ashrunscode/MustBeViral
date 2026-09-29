begin;

-- Keep direct RPC string bounds equal to the browser/REST Zod contract.
create or replace function app_private.platform_knowledge_validate(p_input jsonb, p_required text[], p_optional text[] default '{}')
returns void language plpgsql set search_path = pg_catalog as $$
declare k text; v jsonb;
  allowed text[] := p_required || p_optional;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 65536
    or not p_input ?& p_required then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  for k, v in select * from jsonb_each(p_input) loop
    if not k = any(allowed) then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
    if k in ('value_text','ends_at') and v = 'null'::jsonb then continue; end if;
    if v = 'null'::jsonb then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
    if k like '%\_id' escape '\' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'expected_version' then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or (v::text)::numeric not between 1 and 2147483647 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('limit') then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or (v::text)::numeric not between 1 and 100 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'cursor' then
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 2048
        or (p_input->>k) !~ '^[A-Za-z0-9_-]+$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'url' then
      if jsonb_typeof(v) <> 'string' or not app_private.public_https_destination(p_input->>k) then
        raise exception using errcode = '22023', message = 'SOURCE_UNSAFE';
      end if;
    elsif k = 'filename' then
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 200 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'media_type' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) not in ('text/plain','text/markdown','text/html') then
        raise exception using errcode = '22023', message = 'SOURCE_UNSUPPORTED';
      end if;
    elsif k = 'text_content' then
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 32768 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('excerpt','locator','value_text','answer_text','pin_key','draft_hash') then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      if k = 'excerpt' and app_private.knowledge_utf16_length(p_input->>k) not between 1 and 2000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'locator' and app_private.knowledge_utf16_length(p_input->>k) > 500 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'value_text' and app_private.knowledge_utf16_length(p_input->>k) > 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'answer_text' and app_private.knowledge_utf16_length(p_input->>k) not between 1 and 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'pin_key' and (app_private.knowledge_utf16_length(p_input->>k) not between 1 and 120
        or (p_input->>k) !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'draft_hash' and (p_input->>k) !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'ends_at' then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      begin
        perform (p_input->>'ends_at')::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    end if;
  end loop;
end;
$$;

commit;
