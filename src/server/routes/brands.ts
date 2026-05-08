import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbAll, dbFirst, dbRun, fromJson, toJson } from "../db/sql";
import { errorEnvelope, successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { parseJsonBody } from "../http/validation";
import { requireAuth } from "../middleware/auth";
import { requireBrandAccess } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit";
import {
	buildCommandCenter,
	createMockOnboardingArtifacts,
	generateGrowthOpportunities,
	generateMockContentCalendar,
	generateMockImage,
	generateWeeklyReport,
	getBrand,
	type BrandRow,
	type ContentPostRow,
} from "../services/brand-operations";
import { ModelRouter } from "../services/model-router";
import { getSchedulerProvider } from "../services/scheduler";
import { createWebsiteScan } from "../services/website-scan";
import { createId } from "../utils/id";

export const brandRoutes = new Hono<AppHonoContext>();

const profileUpdateSchema = z.object({
	profile: z.record(z.string(), z.unknown()),
	lockedFields: z.array(z.string()).max(60).optional(),
});

const websiteScanSchema = z.object({
	url: z.string().min(1).max(500),
});

const approvalSchema = z.object({
	action: z.enum(["approve", "reject", "regenerate", "edit"]),
	note: z.string().max(500).optional(),
});

const imageSchema = z.object({
	prompt: z.string().min(4).max(1500),
	postId: z.string().optional(),
});

const manualExportSchema = z.object({
	postIds: z.array(z.string()).min(1).max(50),
	scheduledAt: z.string().optional(),
	provider: z.enum(["manual", "vista_social", "buffer"]).optional(),
});

const dmRuleSchema = z.object({
	platform: z.string().min(1).max(60),
	triggerType: z.string().min(1).max(80),
	triggerValue: z.string().min(1).max(200),
	responseTemplate: z.string().min(1).max(1000),
});

brandRoutes.use("/:brandId/*", requireAuth(), requireBrandAccess());
brandRoutes.use("/:brandId", requireAuth(), requireBrandAccess());

brandRoutes.get("/:brandId", async (c) => {
	const requestId = c.get("requestId");
	const brand = await getRequiredBrand(c);
	return c.json(successEnvelope({ brand }, requestId));
});

brandRoutes.get("/:brandId/command-center", async (c) => {
	const requestId = c.get("requestId");
	const commandCenter = await buildCommandCenter(getDb(c.env), c.get("brandId") ?? "");
	return c.json(successEnvelope(commandCenter, requestId));
});

brandRoutes.post("/:brandId/onboarding/start", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const output = await createMockOnboardingArtifacts(db, {
		brand,
		requestedBy: auth?.userId,
	});
	await startAgentIfAvailable(c, brand, "onboarding/start");
	return c.json(successEnvelope({ onboarding: output }, requestId), 202);
});

brandRoutes.get("/:brandId/intelligence", async (c) => {
	const requestId = c.get("requestId");
	const db = getDb(c.env);
	const brandId = c.get("brandId") ?? "";
	const score = await dbFirst(
		db,
		`SELECT id, overall_score, scores_json, evidence_json, created_at
		FROM marketing_scores
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 1`,
		[brandId],
	);
	const scans = await dbAll(
		db,
		`SELECT id, url, status, findings_json, evidence_json, error_message, created_at
		FROM website_scans
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 5`,
		[brandId],
	);
	return c.json(successEnvelope({ score, scans }, requestId));
});

brandRoutes.get("/:brandId/profile", async (c) => {
	const requestId = c.get("requestId");
	const profile = await dbFirst(
		getDb(c.env),
		`SELECT id, version, profile_json, locked_fields_json, created_by, created_at
		FROM brand_profile_versions
		WHERE brand_id = ?
		ORDER BY version DESC
		LIMIT 1`,
		[c.get("brandId") ?? ""],
	);
	return c.json(
		successEnvelope(
			{
				profile: profile
					? {
							...profile,
							profile_json: fromJson(String(profile.profile_json), {}),
							locked_fields_json: fromJson(String(profile.locked_fields_json), []),
						}
					: null,
			},
			requestId,
		),
	);
});

brandRoutes.patch("/:brandId/profile", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, profileUpdateSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const latest = await dbFirst<{ version: number }>(
		db,
		"SELECT COALESCE(MAX(version), 0) AS version FROM brand_profile_versions WHERE brand_id = ?",
		[brand.id],
	);
	const version = (latest?.version ?? 0) + 1;
	const profileId = createId("profile");
	await dbRun(
		db,
		`INSERT INTO brand_profile_versions (id, brand_id, version, profile_json, locked_fields_json, created_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		[
			profileId,
			brand.id,
			version,
			toJson(parsed.data.profile),
			toJson(parsed.data.lockedFields ?? []),
			auth?.userId ?? null,
		],
	);
	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "brand_profile.updated",
		entityType: "brand_profile_version",
		entityId: profileId,
		after: { version },
	});
	return c.json(successEnvelope({ profileId, version }, requestId));
});

brandRoutes.get("/:brandId/target-market", async (c) => {
	const requestId = c.get("requestId");
	const report = await dbFirst(
		getDb(c.env),
		`SELECT id, report_json, evidence_json, created_at
		FROM target_market_reports
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 1`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ report }, requestId));
});

brandRoutes.post("/:brandId/website-scans", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, websiteScanSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const scan = await createWebsiteScan(getDb(c.env), {
		brandId: c.get("brandId") ?? "",
		url: parsed.data.url,
	});
	return c.json(successEnvelope({ scan }, requestId), scan.status === "failed" ? 400 : 201);
});

brandRoutes.post("/:brandId/content-calendar/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const brand = await getRequiredBrand(c);
	const output = await generateMockContentCalendar(getDb(c.env), {
		brand,
		requestedBy: auth?.userId,
	});
	return c.json(successEnvelope(output, requestId), 202);
});

brandRoutes.get("/:brandId/content-calendar", async (c) => {
	const requestId = c.get("requestId");
	const db = getDb(c.env);
	const brandId = c.get("brandId") ?? "";
	const calendars = await dbAll(
		db,
		`SELECT id, campaign_id, start_date, end_date, status, strategy_json, created_at
		FROM content_calendars
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 5`,
		[brandId],
	);
	const posts = await dbAll<ContentPostRow>(
		db,
		`SELECT id, brand_id, platform, status, caption, scheduled_at, risk_level,
			hashtags_json, why_json, evidence_json
		FROM content_posts
		WHERE brand_id = ?
		ORDER BY scheduled_at ASC, created_at ASC
		LIMIT 60`,
		[brandId],
	);
	return c.json(successEnvelope({ calendars, posts: posts.map(readablePost) }, requestId));
});

brandRoutes.get("/:brandId/approvals", async (c) => {
	const requestId = c.get("requestId");
	const posts = await dbAll<ContentPostRow>(
		getDb(c.env),
		`SELECT id, brand_id, platform, status, caption, scheduled_at, risk_level,
			hashtags_json, why_json, evidence_json
		FROM content_posts
		WHERE brand_id = ? AND status = 'pending_approval'
		ORDER BY scheduled_at ASC, created_at ASC`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ approvals: posts.map(readablePost) }, requestId));
});

brandRoutes.post("/:brandId/approvals/:postId", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, approvalSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const post = await getPost(db, brand.id, c.req.param("postId"));
	if (!post) {
		return c.json(errorEnvelope("POST_NOT_FOUND", "Content post was not found.", requestId), 404);
	}

	const nextStatus = parsed.data.action === "approve" ? "approved" : parsed.data.action === "reject" ? "rejected" : "draft";
	await dbRun(db, "UPDATE content_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
		nextStatus,
		post.id,
	]);
	await dbRun(
		db,
		`INSERT INTO approvals (id, brand_id, post_id, user_id, action, note)
		VALUES (?, ?, ?, ?, ?, ?)`,
		[createId("approval"), brand.id, post.id, auth?.userId ?? null, parsed.data.action, parsed.data.note ?? null],
	);
	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: `content_post.${parsed.data.action}`,
		entityType: "content_post",
		entityId: post.id,
		after: { status: nextStatus },
	});
	return c.json(successEnvelope({ postId: post.id, status: nextStatus }, requestId));
});

brandRoutes.get("/:brandId/media", async (c) => {
	const requestId = c.get("requestId");
	const assets = await dbAll(
		getDb(c.env),
		`SELECT id, asset_type, r2_key, file_name, mime_type, byte_size, width, height, metadata_json, created_at
		FROM brand_assets
		WHERE brand_id = ?
		ORDER BY created_at DESC`,
		[c.get("brandId") ?? ""],
	);
	const creatives = await dbAll(
		getDb(c.env),
		`SELECT id, post_id, prompt, provider, model, r2_key, status, metadata_json, created_at
		FROM generated_creatives
		WHERE brand_id = ?
		ORDER BY created_at DESC`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ assets, creatives }, requestId));
});

brandRoutes.post("/:brandId/images/generate", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, imageSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const output = await generateMockImage(db, {
		brand,
		prompt: parsed.data.prompt,
		postId: parsed.data.postId,
		router: new ModelRouter(c.env, db),
	});
	return c.json(successEnvelope(output, requestId), 202);
});

brandRoutes.post("/:brandId/scheduler/manual-export", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, manualExportSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const providerId = parsed.data.provider ?? "manual";
	const provider = getSchedulerProvider(providerId);
	const exported: Array<Record<string, unknown>> = [];

	for (const postId of parsed.data.postIds) {
		const post = await getPost(db, brand.id, postId);
		if (!post || post.status !== "approved") {
			return c.json(
				errorEnvelope("POST_NOT_APPROVED", "Only approved posts can be scheduled or exported.", requestId, {
					postId,
				}),
				409,
			);
		}
		const scheduledAt = parsed.data.scheduledAt ?? post.scheduled_at ?? new Date().toISOString();
		const result = await provider.schedule({
			postId: post.id,
			brandId: brand.id,
			platform: post.platform,
			caption: post.caption,
			scheduledAt,
		});
		const scheduledId = createId("sched");
		await dbRun(
			db,
			`INSERT INTO scheduled_posts (
				id, brand_id, post_id, scheduler_provider, external_id, status, scheduled_at, failure_reason, metadata_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				scheduledId,
				brand.id,
				post.id,
				result.provider,
				result.externalId ?? null,
				result.status,
				scheduledAt,
				result.message ?? null,
				toJson(result.exportPayload ?? {}),
			],
		);
		await dbRun(db, "UPDATE content_posts SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
			post.id,
		]);
		exported.push({ postId: post.id, scheduledId, result });
	}

	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "scheduler.manual_export.created",
		entityType: "scheduled_post",
		after: { count: exported.length },
	});
	return c.json(successEnvelope({ exported }, requestId));
});

brandRoutes.get("/:brandId/dm-rules", async (c) => {
	const requestId = c.get("requestId");
	const rules = await dbAll(
		getDb(c.env),
		`SELECT id, platform, trigger_type, trigger_value, response_template,
			requires_approval, status, metadata_json, created_at, updated_at
		FROM dm_rules
		WHERE brand_id = ?
		ORDER BY created_at DESC`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ rules }, requestId));
});

brandRoutes.post("/:brandId/dm-rules", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, dmRuleSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const ruleId = createId("dmrule");
	await dbRun(
		db,
		`INSERT INTO dm_rules (
			id, brand_id, platform, trigger_type, trigger_value, response_template,
			requires_approval, status, metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, 1, 'pending_approval', ?)`,
		[
			ruleId,
			brand.id,
			parsed.data.platform,
			parsed.data.triggerType,
			parsed.data.triggerValue,
			parsed.data.responseTemplate,
			toJson({ browserBot: false, providerRequired: true }),
		],
	);
	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "dm_rule.drafted",
		entityType: "dm_rule",
		entityId: ruleId,
	});
	return c.json(successEnvelope({ ruleId, status: "pending_approval" }, requestId), 201);
});

brandRoutes.post("/:brandId/reports/weekly/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const output = await generateWeeklyReport(getDb(c.env), {
		brand: await getRequiredBrand(c),
		requestedBy: auth?.userId,
	});
	return c.json(successEnvelope(output, requestId), 202);
});

brandRoutes.get("/:brandId/reports/weekly", async (c) => {
	const requestId = c.get("requestId");
	const reports = await dbAll(
		getDb(c.env),
		`SELECT id, week_start, week_end, report_json, pdf_r2_key, created_at
		FROM weekly_reports
		WHERE brand_id = ?
		ORDER BY week_start DESC
		LIMIT 12`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ reports }, requestId));
});

brandRoutes.post("/:brandId/growth/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const output = await generateGrowthOpportunities(getDb(c.env), {
		brand: await getRequiredBrand(c),
		requestedBy: auth?.userId,
	});
	return c.json(successEnvelope(output, requestId), 202);
});

brandRoutes.get("/:brandId/growth", async (c) => {
	const requestId = c.get("requestId");
	const opportunities = await dbAll(
		getDb(c.env),
		`SELECT id, title, opportunity_type, status, evidence_json, impact_score, created_at
		FROM growth_opportunities
		WHERE brand_id = ?
		ORDER BY impact_score DESC, created_at DESC`,
		[c.get("brandId") ?? ""],
	);
	return c.json(successEnvelope({ opportunities }, requestId));
});

async function getRequiredBrand(c: Context<AppHonoContext>): Promise<BrandRow> {
	const brand = await getBrand(getDb(c.env), c.get("brandId") ?? "");
	if (!brand) {
		throw new Error("Brand not found after RBAC check.");
	}
	return brand;
}

async function getPost(db: D1Database, brandId: string, postId: string): Promise<ContentPostRow | null> {
	return dbFirst<ContentPostRow>(
		db,
		`SELECT id, brand_id, platform, status, caption, scheduled_at, risk_level,
			hashtags_json, why_json, evidence_json
		FROM content_posts
		WHERE id = ? AND brand_id = ?
		LIMIT 1`,
		[postId, brandId],
	);
}

function readablePost(post: ContentPostRow): Record<string, unknown> {
	return {
		...post,
		hashtags: fromJson(post.hashtags_json, []),
		why: fromJson(post.why_json, {}),
		evidence: fromJson(post.evidence_json, []),
	};
}

async function startAgentIfAvailable(
	c: Context<AppHonoContext>,
	brand: BrandRow,
	action: string,
): Promise<void> {
	if (!c.env.MARKETING_AGENT) {
		return;
	}
	const id = c.env.MARKETING_AGENT.idFromName(`brand:${brand.id}`);
	const stub = c.env.MARKETING_AGENT.get(id);
	const url = new URL(c.req.url);
	url.pathname = `/agent/${brand.id}/${action}`;
	await stub.fetch(
		new Request(url, {
			method: "POST",
			body: JSON.stringify({ brandId: brand.id, workspaceId: brand.workspace_id }),
			headers: { "Content-Type": "application/json" },
		}),
	);
}
