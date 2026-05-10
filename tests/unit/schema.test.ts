import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	join(process.cwd(), "src/server/db/migrations/0001_initial.sql"),
	"utf8",
);

const indexMigration = readFileSync(
	join(process.cwd(), "src/server/db/migrations/0002_indexes_and_phase2.sql"),
	"utf8",
);

const requiredTables = [
	"users",
	"password_credentials",
	"sessions",
	"oauth_accounts",
	"workspaces",
	"workspace_members",
	"invitations",
	"brands",
	"brand_social_profiles",
	"brand_profile_versions",
	"brand_assets",
	"website_scans",
	"social_scans",
	"competitor_scans",
	"marketing_scores",
	"target_market_reports",
	"campaigns",
	"content_calendars",
	"content_posts",
	"post_variants",
	"generated_creatives",
	"approvals",
	"scheduled_posts",
	"dm_rules",
	"dm_events",
	"analytics_snapshots",
	"weekly_reports",
	"growth_opportunities",
	"agent_runs",
	"workflow_runs",
	"usage_events",
	"subscriptions",
	"webhooks_inbox",
	"idempotency_keys",
	"audit_logs",
	"creator_profiles",
	"marketplace_matches",
] as const;

describe("D1 schema", () => {
	it("creates every required product table", () => {
		for (const table of requiredTables) {
			expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
		}
	});

	it("includes the auth, webhook, idempotency, and invitation additions", () => {
		expect(requiredTables).toContain("sessions");
		expect(requiredTables).toContain("oauth_accounts");
		expect(requiredTables).toContain("password_credentials");
		expect(requiredTables).toContain("invitations");
		expect(requiredTables).toContain("webhooks_inbox");
		expect(requiredTables).toContain("idempotency_keys");
	});

	it("locks important status sets to explicit values", () => {
		expect(migration).toContain("'pending_approval'");
		expect(migration).toContain("'manual_export'");
		expect(migration).toContain("'past_due'");
		expect(migration).toContain("CHECK (status IN");
	});

	it("adds the phase 1.1 follow-on indexes", () => {
		expect(indexMigration).toContain("idx_competitor_scans_brand");
		expect(indexMigration).toContain("idx_workflow_runs_workspace_status");
		expect(indexMigration).toContain("idx_audit_logs_user_date");
	});
});
