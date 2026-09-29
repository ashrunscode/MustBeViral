begin;
-- Multiple authorized commands may execute within one SQL statement/transaction.
-- Preserve their creation order instead of assigning every new question the statement start.
-- Existing history is immutable and is not rewritten; UUID remains the deterministic tie-break.
alter table public.brand_knowledge_questions alter column created_at set default clock_timestamp();
commit;
