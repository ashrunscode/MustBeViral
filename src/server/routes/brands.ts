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
	createCampaignFromOpportunity,
	createMockOnboardingArtifacts,
	generateSinglePost,
	generateGrowthOpportunities,
	generateMockContentCalendar,
	generateMockImage,
	generateWeeklyReport,
	getBrand,
	regenerateBrandProfileField,
	type BrandRow,
	type ContentPostRow,
} from "../services/brand-operations";
import { checkAiRequestCap, checkPostCap, type CapResult } from "../services/entitlements";
import { ModelRouter } from "../services/model-router";
import { getSchedulerProvider } from "../services/scheduler";
import { createWebsiteScan } from "../services/website-scan";
import { createId } from "../utils/id";
import type { ImageGenerationWorkflowInput } from "../workflows/ImageGenerationWorkflow";
import { buildBrandWorkflowParams, type BrandWorkflowInput } from "../workflows/params";

export const brandRoutes = new Hono<AppHonoContext>();

const profileUpdateSchema = z.object({
	profile: z.record(z.string(), z.unknown()),
	lockedFields: z.array(z.string()).max(60).optional(),
});

const profileFieldRegenerationSchema = z.object({
	fieldPath: z.string().min(1).max(120),
});

const websiteScanSchema = z.object({
	url: z.string().min(1).max(500),
});

const generatePostSchema = z.object({
	platform: z.enum(["instagram", "facebook", "linkedin", "google_business"]).optional(),
	topic: z.string().min(1).max(240).optional(),
	campaignId: z.string().min(1).max(120).optional(),
});

const approvalSchema = z.object({
	action: z.enum(["approve", "reject", "regenerate", "edit"]),
	note: z.string().max(500).optional(),
});

const imageSchema = z.object({
	prompt: z.string().min(4).max(1500),
	postId: z.string().optional(),
	category: z.enum(["image_fast", "image_default", "image_premium"]).optional(),
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

const dmRuleActionSchema = z.object({
	action: z.enum(["approve", "reject", "pause", "activate"]),
	note: z.string().max(500).optional(),
});

interface GeneratedCreativeMediaRow extends Record<string, unknown> {
	id: string;
	r2_key: string | null;
	status: string;
}

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
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	if (c.env.BRAND_ONBOARDING_WORKFLOW) {
		const queued = await queueBrandWorkflow(
			c.env.BRAND_ONBOARDING_WORKFLOW,
			"BrandOnboardingWorkflow",
			brand,
			auth?.userId,
		);
		c.executionCtx.waitUntil(startAgentIfAvailable(c, brand, "onboarding/start"));
		return c.json(successEnvelope({ onboarding: queued }, requestId), 202);
	}
	const output = await createMockOnboardingArtifacts(db, {
		brand,
		requestedBy: auth?.userId,
	});
	// Notify the MarketingAgent DO without holding up the response. waitUntil
	// keeps the Worker alive long enough for the DO write to flush even after
	// the HTTP response has been returned.
	c.executionCtx.waitUntil(startAgentIfAvailable(c, brand, "onboarding/start"));
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

brandRoutes.post("/:brandId/profile/regenerate-field", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, profileFieldRegenerationSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const result = await regenerateBrandProfileField(db, {
		brand,
		fieldPath: parsed.data.fieldPath,
		requestedBy: auth?.userId,
	});
	if (!result.ok) {
		return c.json(
			errorEnvelope(result.code, result.message, requestId),
			result.code === "FIELD_LOCKED" ? 409 : 400,
		);
	}
	return c.json(successEnvelope({ profile: result }, requestId), 201);
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
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, websiteScanSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const scan = await createWebsiteScan(getDb(c.env), {
		brandId: c.get("brandId") ?? "",
		url: parsed.data.url,
		workspaceId: c.get("workspaceId"),
		userId: auth?.userId ?? null,
	});
	return c.json(successEnvelope({ scan }, requestId), scan.status === "failed" ? 400 : 201);
});

brandRoutes.post("/:brandId/content-calendar/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const brand = await getRequiredBrand(c);
	if (c.env.CONTENT_CALENDAR_WORKFLOW) {
		const queued = await queueBrandWorkflow(
			c.env.CONTENT_CALENDAR_WORKFLOW,
			"ContentCalendarWorkflow",
			brand,
			auth?.userId,
		);
		return c.json(successEnvelope({ calendar: queued }, requestId), 202);
	}
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

brandRoutes.post("/:brandId/posts/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, generatePostSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const aiCapError = await enforceAiCap(c);
	if (aiCapError) {
		return aiCapError;
	}
	const postCapError = await enforcePostCap(c);
	if (postCapError) {
		return postCapError;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const post = await generateSinglePost(db, {
		brand,
		platform: parsed.data.platform,
		topic: parsed.data.topic,
		campaignId: parsed.data.campaignId ?? null,
		requestedBy: auth?.userId,
	});
	return c.json(successEnvelope({ post }, requestId), 201);
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

	const nextStatus =
		parsed.data.action === "approve"
			? "approved"
			: parsed.data.action === "reject"
				? "rejected"
				: "draft";
	await dbRun(
		db,
		"UPDATE content_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		[nextStatus, post.id],
	);
	await dbRun(
		db,
		`INSERT INTO approvals (id, brand_id, post_id, user_id, action, note)
		VALUES (?, ?, ?, ?, ?, ?)`,
		[
			createId("approval"),
			brand.id,
			post.id,
			auth?.userId ?? null,
			parsed.data.action,
			parsed.data.note ?? null,
		],
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

brandRoutes.get("/:brandId/media/:creativeId", async (c) => {
	const requestId = c.get("requestId");
	const brandId = c.get("brandId") ?? "";
	const creativeId = c.req.param("creativeId");
	const creative = await dbFirst<GeneratedCreativeMediaRow>(
		getDb(c.env),
		`SELECT id, r2_key, status
		FROM generated_creatives
		WHERE id = ? AND brand_id = ?
		LIMIT 1`,
		[creativeId, brandId],
	);
	if (!creative || creative.status !== "complete" || !creative.r2_key) {
		return c.json(
			errorEnvelope("CREATIVE_NOT_FOUND", "Generated creative was not found.", requestId),
			404,
		);
	}

	const object = await c.env.MEDIA_BUCKET.get(creative.r2_key);
	if (!object) {
		return c.json(
			errorEnvelope("CREATIVE_NOT_FOUND", "Generated creative object was not found.", requestId),
			404,
		);
	}
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "image/png");
	}
	headers.set("Cache-Control", "private, max-age=300");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("ETag", object.httpEtag);
	return new Response(object.body, { headers });
});

brandRoutes.post("/:brandId/images/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, imageSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	if (c.env.IMAGE_GENERATION_WORKFLOW) {
		const creativeId = createId("creative");
		const params: ImageGenerationWorkflowInput = {
			brandId: brand.id,
			workspaceId: brand.workspace_id,
			prompt: parsed.data.prompt,
			category: parsed.data.category ?? "image_default",
			creativeId,
		};
		if (auth?.userId) {
			params.requestedBy = auth.userId;
		}
		if (parsed.data.postId) {
			params.postId = parsed.data.postId;
		}
		const instance = await c.env.IMAGE_GENERATION_WORKFLOW.create({
			params,
		});
		return c.json(
			successEnvelope(
				{
					workflowInstanceId: instance.id,
					creativeId,
					status: "queued",
					mode: "workflow",
				},
				requestId,
			),
			202,
		);
	}
	const output = await generateMockImage(db, {
		brand,
		prompt: parsed.data.prompt,
		postId: parsed.data.postId,
		router: new ModelRouter(c.env, db),
	});
	return c.json(successEnvelope({ ...output, mode: "sync_fallback" }, requestId), 202);
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

	// Phase 1: validate every post is approved BEFORE any writes. Previously we
	// bailed mid-loop, leaving earlier posts already scheduled. (audit gap M-14)
	const prepared: Array<{
		postId: string;
		scheduledId: string;
		scheduledAt: string;
		platform: string;
		caption: string;
		providerResult: Awaited<ReturnType<typeof provider.schedule>>;
	}> = [];
	for (const postId of parsed.data.postIds) {
		const post = await getPost(db, brand.id, postId);
		if (!post || post.status !== "approved") {
			return c.json(
				errorEnvelope(
					"POST_NOT_APPROVED",
					"Only approved posts can be scheduled or exported.",
					requestId,
					{ postId },
				),
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
		prepared.push({
			postId: post.id,
			scheduledId: createId("sched"),
			scheduledAt,
			platform: post.platform,
			caption: post.caption,
			providerResult: result,
		});
	}

	// Phase 2: write all rows in a single D1 batch so partial failures roll back.
	const batchStatements: D1PreparedStatement[] = [];
	for (const row of prepared) {
		batchStatements.push(
			db
				.prepare(
					`INSERT INTO scheduled_posts (
						id, brand_id, post_id, scheduler_provider, external_id, status, scheduled_at, failure_reason, metadata_json
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					row.scheduledId,
					brand.id,
					row.postId,
					row.providerResult.provider,
					row.providerResult.externalId ?? null,
					row.providerResult.status,
					row.scheduledAt,
					row.providerResult.message ?? null,
					toJson(row.providerResult.exportPayload ?? {}),
				),
			db
				.prepare(
					"UPDATE content_posts SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
				)
				.bind(row.postId),
		);
	}
	if (batchStatements.length > 0) {
		await db.batch(batchStatements);
	}

	const exported = prepared.map((row) => ({
		postId: row.postId,
		scheduledId: row.scheduledId,
		result: row.providerResult,
	}));

	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "scheduler.manual_export.created",
		entityType: "scheduled_post",
		after: { count: exported.length, providerId },
	});
	return c.json(successEnvelope({ exported }, requestId));
});

brandRoutes.get("/:brandId/scheduler/exports", async (c) => {
	const requestId = c.get("requestId");
	const brandId = c.get("brandId") ?? "";
	const status = c.req.query("status");
	const since = c.req.query("since");
	const limit = clampLimit(c.req.query("limit"));
	const where: string[] = ["sp.brand_id = ?"];
	const bindings: Array<string | number> = [brandId];
	if (status) {
		where.push("sp.status = ?");
		bindings.push(status);
	}
	if (since) {
		where.push("sp.created_at >= ?");
		bindings.push(since);
	}
	bindings.push(limit);
	const exports = await dbAll(
		getDb(c.env),
		`SELECT
			sp.id AS scheduled_id,
			sp.post_id,
			sp.scheduler_provider,
			sp.external_id,
			sp.status,
			sp.scheduled_at,
			sp.failure_reason,
			sp.metadata_json,
			sp.created_at,
			cp.platform,
			cp.caption,
			cp.status AS post_status
		FROM scheduled_posts sp
		LEFT JOIN content_posts cp ON cp.id = sp.post_id
		WHERE ${where.join(" AND ")}
		ORDER BY sp.created_at DESC
		LIMIT ?`,
		bindings,
	);
	return c.json(successEnvelope({ exports }, requestId));
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

brandRoutes.patch("/:brandId/dm-rules/:ruleId", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, dmRuleActionSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const ruleId = c.req.param("ruleId");
	const rule = await dbFirst<{ id: string; status: string }>(
		db,
		"SELECT id, status FROM dm_rules WHERE id = ? AND brand_id = ?",
		[ruleId, brand.id],
	);
	if (!rule) {
		return c.json(errorEnvelope("DM_RULE_NOT_FOUND", "DM rule was not found.", requestId), 404);
	}

	const nextStatus = mapDmRuleAction(parsed.data.action);
	if (!nextStatus) {
		return c.json(
			errorEnvelope("INVALID_DM_RULE_ACTION", "Action is not allowed for DM rules.", requestId),
			400,
		);
	}

	await dbRun(db, "UPDATE dm_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
		nextStatus,
		rule.id,
	]);
	await writeAuditLog(db, {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: `dm_rule.${parsed.data.action}`,
		entityType: "dm_rule",
		entityId: rule.id,
		before: { status: rule.status },
		after: { status: nextStatus, note: parsed.data.note ?? null },
	});

	return c.json(successEnvelope({ ruleId: rule.id, status: nextStatus }, requestId));
});

brandRoutes.post("/:brandId/reports/weekly/generate", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const brand = await getRequiredBrand(c);
	if (c.env.WEEKLY_REPORT_WORKFLOW) {
		const queued = await queueBrandWorkflow(
			c.env.WEEKLY_REPORT_WORKFLOW,
			"WeeklyReportWorkflow",
			brand,
			auth?.userId,
		);
		return c.json(successEnvelope({ report: queued }, requestId), 202);
	}
	const output = await generateWeeklyReport(getDb(c.env), {
		brand,
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
	const capError = await enforceAiCap(c);
	if (capError) {
		return capError;
	}
	const brand = await getRequiredBrand(c);
	if (c.env.GROWTH_OPPORTUNITY_WORKFLOW) {
		const queued = await queueBrandWorkflow(
			c.env.GROWTH_OPPORTUNITY_WORKFLOW,
			"GrowthOpportunityWorkflow",
			brand,
			auth?.userId,
		);
		return c.json(successEnvelope({ growth: queued }, requestId), 202);
	}
	const output = await generateGrowthOpportunities(getDb(c.env), {
		brand,
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

brandRoutes.post("/:brandId/growth/:opportunityId/campaign", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const aiCapError = await enforceAiCap(c);
	if (aiCapError) {
		return aiCapError;
	}
	const postCapError = await enforcePostCap(c);
	if (postCapError) {
		return postCapError;
	}
	const db = getDb(c.env);
	const brand = await getRequiredBrand(c);
	const campaign = await createCampaignFromOpportunity(db, {
		brand,
		opportunityId: c.req.param("opportunityId"),
		requestedBy: auth?.userId,
	});
	if (!campaign.ok) {
		return c.json(errorEnvelope(campaign.code, campaign.message, requestId), 404);
	}
	return c.json(successEnvelope({ campaign }, requestId), 201);
});

brandRoutes.get("/:brandId/workflows/:workflowId", async (c) => {
	const requestId = c.get("requestId");
	const brandId = c.get("brandId") ?? "";
	const workflowId = c.req.param("workflowId");
	const workflow = await dbFirst<{
		id: string;
		external_workflow_id: string | null;
		brand_id: string | null;
		workspace_id: string | null;
		workflow_name: string;
		status: string;
		progress: number;
		input_json: string;
		output_json: string;
		error_message: string | null;
		created_at: string;
		updated_at: string;
	}>(
		getDb(c.env),
		`SELECT id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
			input_json, output_json, error_message, created_at, updated_at
		FROM workflow_runs
		WHERE brand_id = ? AND (id = ? OR external_workflow_id = ?)
		LIMIT 1`,
		[brandId, workflowId, workflowId],
	);
	if (!workflow) {
		return c.json(errorEnvelope("WORKFLOW_NOT_FOUND", "Workflow was not found for this brand.", requestId), 404);
	}
	return c.json(
		successEnvelope(
			{
				workflow: {
					...workflow,
					input: fromJson(workflow.input_json, {}),
					output: fromJson(workflow.output_json, {}),
				},
			},
			requestId,
		),
	);
});

// MarketingAgent (Durable Object) lifecycle surface. The DO is reachable via
// idFromName("brand:<brandId>") and exposes /state, /command-center, /pause,
// /resume, /activity, /onboarding/start. These outer API routes forward to
// those endpoints so clients never need to talk to the DO directly. Auth/
// RBAC is already enforced by the wildcard brandRoutes.use() registration.
brandRoutes.get("/:brandId/agent/state", async (c) => {
	const requestId = c.get("requestId");
	const data = await callAgent(c, "GET", "state");
	return c.json(successEnvelope({ agent: data }, requestId));
});

brandRoutes.get("/:brandId/agent/activity", async (c) => {
	const requestId = c.get("requestId");
	const data = await callAgent(c, "GET", "activity");
	return c.json(successEnvelope({ activity: data }, requestId));
});

brandRoutes.post("/:brandId/agent/pause", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const data = await callAgent(c, "POST", "pause");
	const brand = await getRequiredBrand(c);
	await writeAuditLog(getDb(c.env), {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "agent.pause",
		entityType: "marketing_agent",
		entityId: brand.id,
	});
	return c.json(successEnvelope({ agent: data }, requestId));
});

brandRoutes.post("/:brandId/agent/resume", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const data = await callAgent(c, "POST", "resume");
	const brand = await getRequiredBrand(c);
	await writeAuditLog(getDb(c.env), {
		workspaceId: brand.workspace_id,
		brandId: brand.id,
		userId: auth?.userId ?? null,
		action: "agent.resume",
		entityType: "marketing_agent",
		entityId: brand.id,
	});
	return c.json(successEnvelope({ agent: data }, requestId));
});

// ── Option D social-account management + OAuth start ─────────────────────────

interface SocialAccountTokenRow extends Record<string, unknown> {
	id: string;
	platform: string;
	account_label: string;
	external_account_id: string;
	scope_csv: string;
	access_token_expires_at: string;
	refresh_token_expires_at: string | null;
	status: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
	token_kv_key: string;
}

brandRoutes.get("/:brandId/social-accounts", async (c) => {
	const requestId = c.get("requestId");
	const brandId = c.get("brandId") ?? "";
	const rows = await dbAll<SocialAccountTokenRow>(
		getDb(c.env),
		`SELECT id, platform, account_label, external_account_id, scope_csv,
			access_token_expires_at, refresh_token_expires_at, status,
			last_used_at, created_at, updated_at, token_kv_key
		FROM social_account_tokens
		WHERE brand_id = ?
		ORDER BY created_at DESC`,
		[brandId],
	);
	// Strip token_kv_key from the public response — it's an implementation
	// detail of the encrypted-KV storage and not for client consumption.
	const accounts = rows.map((row) => ({
		id: row.id,
		platform: row.platform,
		accountLabel: row.account_label,
		externalAccountId: row.external_account_id,
		scopes: row.scope_csv.split(",").filter(Boolean),
		accessTokenExpiresAt: row.access_token_expires_at,
		refreshTokenExpiresAt: row.refresh_token_expires_at,
		status: row.status,
		lastUsedAt: row.last_used_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
	return c.json(successEnvelope({ accounts }, requestId));
});

brandRoutes.delete("/:brandId/social-accounts/:accountId", async (c) => {
	const requestId = c.get("requestId");
	const brandId = c.get("brandId") ?? "";
	const auth = c.get("auth");
	const accountId = c.req.param("accountId");
	const db = getDb(c.env);
	const row = await dbFirst<SocialAccountTokenRow>(
		db,
		`SELECT id, platform, account_label, external_account_id, scope_csv,
			access_token_expires_at, refresh_token_expires_at, status,
			last_used_at, created_at, updated_at, token_kv_key
		FROM social_account_tokens
		WHERE id = ? AND brand_id = ?
		LIMIT 1`,
		[accountId, brandId],
	);
	if (!row) {
		return c.json(
			errorEnvelope("SOCIAL_ACCOUNT_NOT_FOUND", "Connected social account not found.", requestId),
			404,
		);
	}
	// Delete the KV ciphertext and flip D1 status to 'revoked'. We don't hard-
	// delete the row because published_posts may FK-reference it; status='revoked'
	// makes it inert for adapter dispatch.
	try {
		const { revokeToken } = await import("../services/platforms/token-storage");
		await revokeToken(c.env, row.token_kv_key);
	} catch {
		// Continue even if KV delete fails — the D1 status flip is what stops
		// the adapter from using this row.
	}
	await dbRun(
		db,
		`UPDATE social_account_tokens SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		[row.id],
	);
	await dbRun(
		db,
		`UPDATE brand_social_profiles SET connected_status = 'disconnected', updated_at = CURRENT_TIMESTAMP
		WHERE brand_id = ? AND platform = ? AND handle = ?`,
		[brandId, row.platform, row.external_account_id],
	);
	await writeAuditLog(db, {
		workspaceId: null,
		brandId,
		userId: auth?.userId ?? null,
		action: `platform.${row.platform}.disconnect`,
		entityType: "social_account_token",
		entityId: row.id,
		before: { status: row.status },
		after: { status: "revoked" },
	});
	return c.json(successEnvelope({ disconnected: true, accountId: row.id }, requestId));
});

// OAuth start for LinkedIn. Flag-gated; returns 503 FEATURE_DISABLED if the
// platform's publish flag is OFF (which is the post-build default).
brandRoutes.get("/:brandId/oauth/linkedin/start", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabledForBrand(c.env, "linkedin", "publish")) {
		return c.json(
			errorEnvelope("FEATURE_DISABLED", "LinkedIn publish flag is off.", requestId, {
				platform: "linkedin",
			}),
			503,
		);
	}
	const brandId = c.get("brandId") ?? "";
	const clientId = c.env.LINKEDIN_CLIENT_ID;
	if (!clientId) {
		return c.json(
			errorEnvelope(
				"OAUTH_APP_NOT_CONFIGURED",
				"LinkedIn client id not configured. Set LINKEDIN_CLIENT_ID via wrangler secret put.",
				requestId,
			),
			501,
		);
	}
	const redirectUri =
		c.env.LINKEDIN_REDIRECT_URI ?? `${c.env.PUBLIC_APP_URL ?? ""}/api/oauth/linkedin/callback`;
	if (!c.env.TOKEN_ENCRYPTION_KEY) {
		return c.json(
			errorEnvelope(
				"TOKEN_ENCRYPTION_KEY_MISSING",
				"Worker secret TOKEN_ENCRYPTION_KEY is required before any OAuth flow.",
				requestId,
			),
			501,
		);
	}
	const { signState } = await import("../services/platforms/oauth-state");
	const { buildLinkedInAuthorizeUrl } = await import("../services/platforms/linkedin-oauth");
	const state = await signState(c.env, {
		brandId,
		platform: "linkedin",
		redirectAfter: `/app/brands/${brandId}/connections?connected=linkedin`,
	});
	const url = buildLinkedInAuthorizeUrl({
		state,
		clientId,
		redirectUri,
	});
	return c.redirect(url, 302);
});

// OAuth start for Meta (Facebook + Instagram Business). One auth flow yields
// up to two surfaces per page (FB Page + IG Business). The callback in
// routes/oauth.ts splits them into separate social_account_tokens rows.
brandRoutes.get("/:brandId/oauth/meta/start", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabledForBrand(c.env, "meta", "publish")) {
		return c.json(
			errorEnvelope("FEATURE_DISABLED", "Meta publish flag is off.", requestId, {
				platform: "meta",
			}),
			503,
		);
	}
	const brandId = c.get("brandId") ?? "";
	const clientId = c.env.META_APP_ID;
	if (!clientId) {
		return c.json(
			errorEnvelope(
				"OAUTH_APP_NOT_CONFIGURED",
				"Meta app id not configured. Set META_APP_ID via wrangler secret put.",
				requestId,
			),
			501,
		);
	}
	const redirectUri =
		c.env.META_REDIRECT_URI ?? `${c.env.PUBLIC_APP_URL ?? ""}/api/oauth/meta/callback`;
	if (!c.env.TOKEN_ENCRYPTION_KEY) {
		return c.json(
			errorEnvelope(
				"TOKEN_ENCRYPTION_KEY_MISSING",
				"Worker secret TOKEN_ENCRYPTION_KEY is required before any OAuth flow.",
				requestId,
			),
			501,
		);
	}
	const { signState } = await import("../services/platforms/oauth-state");
	const { buildMetaAuthorizeUrl } = await import("../services/platforms/meta-oauth");
	const state = await signState(c.env, {
		brandId,
		platform: "meta",
		redirectAfter: `/app/brands/${brandId}/connections?connected=meta`,
	});
	const url = buildMetaAuthorizeUrl({
		state,
		clientId,
		redirectUri,
	});
	return c.redirect(url, 302);
});

// OAuth start for TikTok for Business.
brandRoutes.get("/:brandId/oauth/tiktok/start", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabledForBrand(c.env, "tiktok", "publish")) {
		return c.json(
			errorEnvelope("FEATURE_DISABLED", "TikTok publish flag is off.", requestId, {
				platform: "tiktok",
			}),
			503,
		);
	}
	const brandId = c.get("brandId") ?? "";
	const clientKey = c.env.TIKTOK_CLIENT_KEY;
	if (!clientKey) {
		return c.json(
			errorEnvelope(
				"OAUTH_APP_NOT_CONFIGURED",
				"TikTok client key not configured. Set TIKTOK_CLIENT_KEY via wrangler secret put.",
				requestId,
			),
			501,
		);
	}
	const redirectUri =
		c.env.TIKTOK_REDIRECT_URI ?? `${c.env.PUBLIC_APP_URL ?? ""}/api/oauth/tiktok/callback`;
	if (!c.env.TOKEN_ENCRYPTION_KEY) {
		return c.json(
			errorEnvelope(
				"TOKEN_ENCRYPTION_KEY_MISSING",
				"Worker secret TOKEN_ENCRYPTION_KEY is required before any OAuth flow.",
				requestId,
			),
			501,
		);
	}
	const { signState } = await import("../services/platforms/oauth-state");
	const { buildTikTokAuthorizeUrl } = await import(
		"../services/platforms/tiktok-oauth"
	);
	const state = await signState(c.env, {
		brandId,
		platform: "tiktok",
		redirectAfter: `/app/brands/${brandId}/connections?connected=tiktok`,
	});
	const url = buildTikTokAuthorizeUrl({
		state,
		clientKey,
		redirectUri,
	});
	return c.redirect(url, 302);
});

// OAuth start for X (Twitter) with PKCE. Code verifier is embedded in the
// signed state so the callback can complete the token exchange without any
// server-side session storage.
brandRoutes.get("/:brandId/oauth/x/start", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabledForBrand(c.env, "x", "publish")) {
		return c.json(
			errorEnvelope("FEATURE_DISABLED", "X publish flag is off.", requestId, {
				platform: "x",
			}),
			503,
		);
	}
	const brandId = c.get("brandId") ?? "";
	const clientId = c.env.X_CLIENT_ID;
	if (!clientId) {
		return c.json(
			errorEnvelope(
				"OAUTH_APP_NOT_CONFIGURED",
				"X client id not configured. Set X_CLIENT_ID via wrangler secret put.",
				requestId,
			),
			501,
		);
	}
	const redirectUri =
		c.env.X_REDIRECT_URI ?? `${c.env.PUBLIC_APP_URL ?? ""}/api/oauth/x/callback`;
	if (!c.env.TOKEN_ENCRYPTION_KEY) {
		return c.json(
			errorEnvelope(
				"TOKEN_ENCRYPTION_KEY_MISSING",
				"Worker secret TOKEN_ENCRYPTION_KEY is required before any OAuth flow.",
				requestId,
			),
			501,
		);
	}
	const { signState } = await import("../services/platforms/oauth-state");
	const { buildXAuthorizeUrl, generatePkcePair } = await import("../services/platforms/x-oauth");
	const pkce = await generatePkcePair();
	const state = await signState(c.env, {
		brandId,
		platform: "x",
		codeVerifier: pkce.verifier,
		redirectAfter: `/app/brands/${brandId}/connections?connected=x`,
	});
	const url = buildXAuthorizeUrl({
		state,
		codeChallenge: pkce.challenge,
		clientId,
		redirectUri,
	});
	return c.redirect(url, 302);
});

/**
 * Flag-check helper. Lazily imports the feature-flags module to avoid a
 * circular import path with services/platforms/* during dev-server warmup.
 */
function isPlatformEnabledForBrand(
	env: AppHonoContext["Bindings"],
	platform: "linkedin" | "x" | "meta" | "tiktok",
	capability: "publish" | "ingest",
): boolean {
	const key = `ENABLE_${platform.toUpperCase()}_${capability.toUpperCase()}` as keyof typeof env;
	return env[key] === "true";
}

// ─────────────────────────────────────────────────────────────────────────────

async function callAgent(
	c: Context<AppHonoContext>,
	method: "GET" | "POST",
	action: "state" | "activity" | "pause" | "resume",
): Promise<unknown> {
	const brandId = c.get("brandId") ?? "";
	const namespace = c.env.MARKETING_AGENT;
	if (!namespace) {
		return { unavailable: true, reason: "marketing_agent_unbound" };
	}
	const stub = namespace.get(namespace.idFromName(`brand:${brandId}`));
	const url = new URL(c.req.url);
	url.pathname = `/agent/${brandId}/${action}`;
	const response = await stub.fetch(
		new Request(url, {
			method,
			...(method === "POST" ? { body: JSON.stringify({ brandId }) } : {}),
			headers: { "Content-Type": "application/json" },
		}),
	);
	const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	return payload.data ?? payload;
}

async function getRequiredBrand(c: Context<AppHonoContext>): Promise<BrandRow> {
	const brand = await getBrand(getDb(c.env), c.get("brandId") ?? "");
	if (!brand) {
		throw new Error("Brand not found after RBAC check.");
	}
	return brand;
}

async function getPost(
	db: D1Database,
	brandId: string,
	postId: string,
): Promise<ContentPostRow | null> {
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

async function queueBrandWorkflow(
	workflow: Workflow<BrandWorkflowInput>,
	workflowName: string,
	brand: BrandRow,
	requestedBy?: string,
) {
	const instance = await workflow.create({
		params: buildBrandWorkflowParams({
			brandId: brand.id,
			workspaceId: brand.workspace_id,
			requestedBy,
		}),
	});

	return {
		workflow: workflowName,
		workflowInstanceId: instance.id,
		status: "queued" as const,
		mode: "workflow" as const,
	};
}

function clampLimit(raw: string | undefined, fallback = 50, max = 200): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(Math.floor(parsed), max);
}

async function enforceAiCap(c: Context<AppHonoContext>): Promise<Response | null> {
	const requestId = c.get("requestId");
	const workspaceId = c.get("workspaceId");
	if (!workspaceId) {
		return null;
	}
	const cap = await checkAiRequestCap(getDb(c.env), workspaceId);
	if (cap.allowed) {
		return null;
	}
	return c.json(
		errorEnvelope(
			"PLAN_LIMIT_REACHED",
			`Plan '${cap.plan}' allows ${String(cap.limit)} AI requests this month.`,
			requestId,
			{ ...capDetails(cap), cap: "ai_requests_per_month" },
		),
		402,
	);
}

async function enforcePostCap(c: Context<AppHonoContext>): Promise<Response | null> {
	const requestId = c.get("requestId");
	const workspaceId = c.get("workspaceId");
	if (!workspaceId) {
		return null;
	}
	const cap = await checkPostCap(getDb(c.env), workspaceId);
	if (cap.allowed) {
		return null;
	}
	return c.json(
		errorEnvelope(
			"PLAN_LIMIT_REACHED",
			`Plan '${cap.plan}' allows ${String(cap.limit)} content posts this month.`,
			requestId,
			{ ...capDetails(cap), cap: "content_posts_per_month" },
		),
		402,
	);
}

function capDetails(cap: CapResult): Record<string, unknown> {
	return { plan: cap.plan, used: cap.used, limit: cap.limit };
}

function mapDmRuleAction(
	action: "approve" | "reject" | "pause" | "activate",
): "approved" | "rejected" | "paused" | "active" | null {
	switch (action) {
		case "approve":
			return "approved";
		case "reject":
			return "rejected";
		case "pause":
			return "paused";
		case "activate":
			return "active";
		default:
			return null;
	}
}
