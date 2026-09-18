begin;
-- Cover the nine knowledge-table foreign keys that 00036 requires an index prefix for.
create index brand_source_jobs_created_by_fk
  on public.brand_source_jobs (created_by);
create index brand_source_jobs_source_fk
  on public.brand_source_jobs (workspace_id, source_id);
create index brand_sources_created_by_fk
  on public.brand_sources (created_by);
create index brand_sources_workspace_job_fk
  on public.brand_sources (workspace_id, job_id);
create index brand_knowledge_drafts_created_by_fk
  on public.brand_knowledge_drafts (created_by);
create index brand_knowledge_drafts_updated_by_fk
  on public.brand_knowledge_drafts (updated_by);
create index brand_knowledge_candidates_created_by_fk
  on public.brand_knowledge_candidates (created_by);
create index brand_knowledge_candidates_workspace_job_fk
  on public.brand_knowledge_candidates (workspace_id, job_id);
create index brand_knowledge_candidates_workspace_source_fk
  on public.brand_knowledge_candidates (workspace_id, source_id);
commit;
