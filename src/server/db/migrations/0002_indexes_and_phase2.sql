-- Phase 1.1 follow-on: small index gap noted in audit (gap L-1) plus a
-- composite workflow_runs lookup that the admin overview will benefit from.
-- All statements are additive and IF NOT EXISTS-safe so reapplication is OK.

CREATE INDEX IF NOT EXISTS idx_competitor_scans_brand
	ON competitor_scans(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workspace_status
	ON workflow_runs(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date
	ON audit_logs(user_id, created_at DESC);
