import { dbAll, dbFirst, dbRun, fromJson, toJson } from "../db/sql";
import { addDaysIso, createId } from "../utils/id";
import { writeAuditLog } from "./audit";
import { ModelRouter } from "./model-router";

export interface BrandRow extends Record<string, unknown> {
	id: string;
	workspace_id: string;
	name: string;
	slug: string;
	website_url: string | null;
	industry: string | null;
	status: "active" | "paused" | "archived";
	onboarding_status: "not_started" | "running" | "complete" | "failed";
	autonomy_level: number;
	brand_rules_json: string;
	created_at: string;
	updated_at: string;
}

export interface ContentPostRow extends Record<string, unknown> {
	id: string;
	brand_id: string;
	platform: string;
	status: string;
	caption: string;
	scheduled_at: string | null;
	risk_level: "low" | "medium" | "high";
	hashtags_json: string;
	evidence_json: string;
	why_json: string;
}

export interface GeneratedCreativeInsert {
	creativeId: string;
	brandId: string;
	postId?: string | null | undefined;
	prompt: string;
	provider: string;
	model: string;
	r2Key?: string | null | undefined;
	status: "pending" | "complete" | "failed";
	usageEventId?: string | null | undefined;
	metadata: Record<string, unknown>;
}

export type BrandProfileFieldRegenerationResult =
	| {
			ok: true;
			profileId: string;
			version: number;
			fieldPath: string;
			value: unknown;
		}
	| {
			ok: false;
			code: "INVALID_FIELD_PATH" | "FIELD_LOCKED";
			message: string;
		};

export interface GeneratedPostResult {
	postId: string;
	status: "pending_approval";
	platform: string;
	campaignId: string | null;
}

export type OpportunityCampaignResult =
	| {
			ok: true;
			campaignId: string;
			postIds: string[];
			opportunityId: string;
			status: "converted";
		}
	| {
			ok: false;
			code: "OPPORTUNITY_NOT_FOUND";
			message: string;
		};

export async function getBrand(db: D1Database, brandId: string): Promise<BrandRow | null> {
	return dbFirst<BrandRow>(
		db,
		`SELECT id, workspace_id, name, slug, website_url, industry, status, onboarding_status,
			autonomy_level, brand_rules_json, created_at, updated_at
		FROM brands
		WHERE id = ? AND deleted_at IS NULL
		LIMIT 1`,
		[brandId],
	);
}

export async function buildCommandCenter(db: D1Database, brandId: string): Promise<Record<string, unknown>> {
	const brand = await getBrand(db, brandId);
	const score = await dbFirst<{ overall_score: number; scores_json: string; evidence_json: string }>(
		db,
		`SELECT overall_score, scores_json, evidence_json
		FROM marketing_scores
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 1`,
		[brandId],
	);
	const pending = await dbFirst<{ count: number }>(
		db,
		"SELECT COUNT(*) AS count FROM content_posts WHERE brand_id = ? AND status = 'pending_approval'",
		[brandId],
	);
	const scheduled = await dbFirst<{ count: number }>(
		db,
		`SELECT COUNT(*) AS count
		FROM scheduled_posts
		WHERE brand_id = ? AND status IN ('scheduled', 'manual_export')`,
		[brandId],
	);
	const recentRuns = await dbAll(
		db,
		`SELECT id, workflow_name, status, progress, created_at, updated_at
		FROM workflow_runs
		WHERE brand_id = ?
		ORDER BY created_at DESC
		LIMIT 6`,
		[brandId],
	);

	return {
		brand,
		score: score
			? {
					overall: score.overall_score,
					breakdown: fromJson(score.scores_json, {}),
					evidence: fromJson(score.evidence_json, []),
				}
			: null,
		metrics: {
			pendingApprovals: pending?.count ?? 0,
			scheduledPosts: scheduled?.count ?? 0,
		},
		nextActions: buildNextActions(brand, pending?.count ?? 0, score?.overall_score ?? null),
		recentRuns,
	};
}

export async function createMockOnboardingArtifacts(
	db: D1Database,
	input: { brand: BrandRow; requestedBy?: string | undefined },
): Promise<Record<string, unknown>> {
	const existingRun = await dbFirst<{ id: string; output_json: string }>(
		db,
		`SELECT id, output_json
		FROM workflow_runs
		WHERE brand_id = ? AND workflow_name = 'BrandOnboardingWorkflow' AND status = 'complete'
		ORDER BY created_at DESC
		LIMIT 1`,
		[input.brand.id],
	);
	if (existingRun) {
		await dbRun(db, "UPDATE brands SET onboarding_status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
			input.brand.id,
		]);
		return {
			...fromJson(existingRun.output_json, {}),
			workflowRunId: existingRun.id,
			idempotent: true,
		};
	}

	const scanId = createId("scan");
	const scoreId = createId("score");
	const targetId = createId("target");
	const profileId = createId("profile");
	const workflowRunId = createId("workflow");
	const agentRunId = createId("agentrun");
	const website = input.brand.website_url ?? "https://example.com";
	const evidence = [
		{
			type: "provided_brand_input",
			source: website,
			claim: "Brand website and profile inputs are treated as untrusted evidence until verified.",
		},
	];
	const scores = {
		positioning: 72,
		conversionReadiness: 68,
		contentVelocity: 61,
		localTrust: 70,
		approvalRisk: 18,
	};
	const profile = {
		name: input.brand.name,
		industry: input.brand.industry ?? "Local services",
		voice: "clear, helpful, proof-backed",
		offers: ["Introductory consultation", "Seasonal promotion"],
		doNotSay: ["Unsupported guarantees", "Platform policy bypass claims"],
	};
	const target = {
		segments: [
			{
				name: "High-intent local buyers",
				pain: "Needs a trustworthy provider quickly.",
				channels: ["Google Business Profile", "Instagram", "Facebook"],
			},
			{
				name: "Referral-ready customers",
				pain: "Needs reminders, proof, and simple next steps.",
				channels: ["Email", "SMS handoff", "organic social"],
			},
		],
		researchConfidence: "mock-first",
	};

	await dbRun(db, "UPDATE brands SET onboarding_status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
		input.brand.id,
	]);
	await dbRun(
		db,
		`INSERT INTO website_scans (id, brand_id, url, status, findings_json, evidence_json)
		VALUES (?, ?, ?, 'complete', ?, ?)`,
		[
			scanId,
			input.brand.id,
			website,
			toJson({ title: input.brand.name, promptInjectionRisk: "low", trust: "untrusted_scan_content" }),
			toJson(evidence),
		],
	);
	await dbRun(
		db,
		`INSERT INTO marketing_scores (id, brand_id, scan_id, overall_score, scores_json, evidence_json)
		VALUES (?, ?, ?, ?, ?, ?)`,
		[scoreId, input.brand.id, scanId, 70, toJson(scores), toJson(evidence)],
	);
	await dbRun(
		db,
		`INSERT INTO target_market_reports (id, brand_id, report_json, evidence_json)
		VALUES (?, ?, ?, ?)`,
		[targetId, input.brand.id, toJson(target), toJson(evidence)],
	);
	await dbRun(
		db,
		`INSERT INTO brand_profile_versions (id, brand_id, version, profile_json, locked_fields_json, created_by)
		VALUES (?, ?, 1, ?, ?, ?)`,
		[profileId, input.brand.id, toJson(profile), toJson(["doNotSay"]), input.requestedBy ?? null],
	);
	await dbRun(
		db,
		`INSERT INTO workflow_runs (
			id, brand_id, workspace_id, workflow_name, status, progress, input_json, output_json
		) VALUES (?, ?, ?, 'BrandOnboardingWorkflow', 'complete', 100, ?, ?)`,
		[
			workflowRunId,
			input.brand.id,
			input.brand.workspace_id,
			toJson({ mock: true }),
			toJson({ scanId, scoreId, targetId, profileId }),
		],
	);
	await dbRun(
		db,
		`INSERT INTO agent_runs (
			id, brand_id, workspace_id, agent_name, action, status, input_json, output_json, completed_at
		) VALUES (?, ?, ?, 'MarketingAgent', 'startOnboardingScan', 'complete', ?, ?, CURRENT_TIMESTAMP)`,
		[
			agentRunId,
			input.brand.id,
			input.brand.workspace_id,
			toJson({ mock: true }),
			toJson({ workflowRunId }),
		],
	);
	await dbRun(db, "UPDATE brands SET onboarding_status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
		input.brand.id,
	]);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "brand.onboarding.completed",
		entityType: "brand",
		entityId: input.brand.id,
		after: { scanId, scoreId, targetId },
	});

	return { scanId, scoreId, targetId, profileId, workflowRunId };
}

export async function generateMockContentCalendar(
	db: D1Database,
	input: { brand: BrandRow; requestedBy?: string | undefined },
): Promise<Record<string, unknown>> {
	const calendarId = createId("calendar");
	const campaignId = createId("campaign");
	const workflowRunId = createId("workflow");
	const platforms = ["instagram", "facebook", "linkedin", "google_business"] as const;
	const topics = [
		"customer proof",
		"service explainer",
		"behind the scenes",
		"seasonal offer",
		"local trust",
		"FAQ answer",
	];
	const today = new Date();
	const posts: string[] = [];

	await dbRun(
		db,
		`INSERT INTO campaigns (id, brand_id, name, objective, status, metadata_json)
		VALUES (?, ?, ?, '30-day organic growth', 'draft', ?)`,
		[campaignId, input.brand.id, `${input.brand.name} Growth Sprint`, toJson({ source: "mock_calendar" })],
	);
	await dbRun(
		db,
		`INSERT INTO content_calendars (id, brand_id, campaign_id, start_date, end_date, status, strategy_json)
		VALUES (?, ?, ?, ?, ?, 'active', ?)`,
		[
			calendarId,
			input.brand.id,
			campaignId,
			today.toISOString().slice(0, 10),
			addDaysIso(30).slice(0, 10),
			toJson({ cadence: "daily", approvalRequired: true, directPublishing: false }),
		],
	);

	for (let day = 1; day <= 30; day += 1) {
		const postId = createId("post");
		const platform = platforms[(day - 1) % platforms.length] ?? "instagram";
		const topic = topics[(day - 1) % topics.length] ?? "customer proof";
		const scheduled = new Date(today);
		scheduled.setUTCDate(today.getUTCDate() + day);
		const caption = `${input.brand.name}: ${topic} post for local buyers. Evidence and final wording require approval before export.`;
		await dbRun(
			db,
			`INSERT INTO content_posts (
				id, brand_id, calendar_id, campaign_id, platform, status, risk_level, caption,
				hashtags_json, why_json, evidence_json, scheduled_at
			) VALUES (?, ?, ?, ?, ?, 'pending_approval', 'low', ?, ?, ?, ?, ?)`,
			[
				postId,
				input.brand.id,
				calendarId,
				campaignId,
				platform,
				caption,
				toJson(["#localbusiness", "#mustbeviral", `#${input.brand.slug}`]),
				toJson({ objective: topic, approvalGuardrail: "Manual approval required." }),
				toJson([{ type: "strategy", claim: "Mock calendar item generated from brand profile." }]),
				scheduled.toISOString(),
			],
		);
		await dbRun(
			db,
			`INSERT INTO post_variants (id, post_id, platform, caption, metadata_json)
			VALUES (?, ?, ?, ?, ?)`,
			[
				createId("variant"),
				postId,
				platform,
				caption,
				toJson({ format: platform === "instagram" ? "caption" : "feed_post" }),
			],
		);
		posts.push(postId);
	}

	await dbRun(
		db,
		`INSERT INTO workflow_runs (
			id, brand_id, workspace_id, workflow_name, status, progress, input_json, output_json
		) VALUES (?, ?, ?, 'ContentCalendarWorkflow', 'complete', 100, ?, ?)`,
		[
			workflowRunId,
			input.brand.id,
			input.brand.workspace_id,
			toJson({ mock: true }),
			toJson({ calendarId, postCount: posts.length }),
		],
	);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "content_calendar.generated",
		entityType: "content_calendar",
		entityId: calendarId,
		after: { postCount: posts.length },
	});

	return { calendarId, campaignId, postCount: posts.length, workflowRunId };
}

export async function generateWeeklyReport(
	db: D1Database,
	input: { brand: BrandRow; requestedBy?: string | undefined },
): Promise<Record<string, unknown>> {
	const reportId = createId("report");
	const workflowRunId = createId("workflow");
	const report = {
		summary: "Mock weekly report generated from current MustBeViral activity.",
		highlights: ["Approval queue is active", "Manual export remains the only publishing path"],
		risks: ["Real analytics providers are not connected yet"],
		nextActions: ["Approve ready posts", "Connect scheduler provider when policy-approved"],
	};
	await dbRun(
		db,
		`INSERT OR REPLACE INTO weekly_reports (id, brand_id, week_start, week_end, report_json)
		VALUES (?, ?, date('now', '-6 days'), date('now'), ?)`,
		[reportId, input.brand.id, toJson(report)],
	);
	await dbRun(
		db,
		`INSERT INTO workflow_runs (
			id, brand_id, workspace_id, workflow_name, status, progress, input_json, output_json
		) VALUES (?, ?, ?, 'WeeklyReportWorkflow', 'complete', 100, ?, ?)`,
		[
			workflowRunId,
			input.brand.id,
			input.brand.workspace_id,
			toJson({ mock: true }),
			toJson({ reportId }),
		],
	);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "weekly_report.generated",
		entityType: "weekly_report",
		entityId: reportId,
	});
	return { reportId, workflowRunId };
}

export async function generateGrowthOpportunities(
	db: D1Database,
	input: { brand: BrandRow; requestedBy?: string | undefined },
): Promise<Record<string, unknown>> {
	const opportunities = [
		{ title: "Turn top FAQ into a 5-post trust campaign", type: "content_campaign", impact: 78 },
		{ title: "Create review-request handoff after completed jobs", type: "retention", impact: 74 },
		{ title: "Package a seasonal local offer", type: "offer", impact: 70 },
	];
	const ids: string[] = [];

	for (const opportunity of opportunities) {
		const id = createId("opp");
		await dbRun(
			db,
			`INSERT INTO growth_opportunities (
				id, brand_id, title, opportunity_type, status, evidence_json, impact_score
			) VALUES (?, ?, ?, ?, 'new', ?, ?)`,
			[
				id,
				input.brand.id,
				opportunity.title,
				opportunity.type,
				toJson([{ type: "mock_research", claim: "Opportunity generated from brand profile and activity." }]),
				opportunity.impact,
			],
		);
		ids.push(id);
	}
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "growth_opportunities.generated",
		entityType: "growth_opportunity",
		after: { count: ids.length },
	});
	return { opportunityIds: ids };
}

export async function regenerateBrandProfileField(
	db: D1Database,
	input: { brand: BrandRow; fieldPath: string; requestedBy?: string | undefined },
): Promise<BrandProfileFieldRegenerationResult> {
	const fieldPath = normaliseFieldPath(input.fieldPath);
	if (!fieldPath) {
		return {
			ok: false,
			code: "INVALID_FIELD_PATH",
			message: "Brand profile field path is required.",
		};
	}

	const latest = await dbFirst<{
		version: number;
		profile_json: string;
		locked_fields_json: string;
	}>(
		db,
		`SELECT version, profile_json, locked_fields_json
		FROM brand_profile_versions
		WHERE brand_id = ?
		ORDER BY version DESC
		LIMIT 1`,
		[input.brand.id],
	);
	const lockedFields = latest ? fromJson<string[]>(latest.locked_fields_json, []) : [];
	if (lockedFields.includes(fieldPath)) {
		return {
			ok: false,
			code: "FIELD_LOCKED",
			message: "This brand profile field is locked and cannot be regenerated.",
		};
	}

	const profile = latest ? fromJson<Record<string, unknown>>(latest.profile_json, {}) : {};
	const value = `Regenerated ${fieldPath} for ${input.brand.name}. Review before using in customer-facing content.`;
	setNestedValue(profile, fieldPath, value);

	const profileId = createId("profile");
	const version = (latest?.version ?? 0) + 1;
	await dbRun(
		db,
		`INSERT INTO brand_profile_versions (id, brand_id, version, profile_json, locked_fields_json, created_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		[profileId, input.brand.id, version, toJson(profile), toJson(lockedFields), input.requestedBy ?? null],
	);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "brand_profile.field_regenerated",
		entityType: "brand_profile_version",
		entityId: profileId,
		after: { version, fieldPath },
	});

	return { ok: true, profileId, version, fieldPath, value };
}

export async function generateSinglePost(
	db: D1Database,
	input: {
		brand: BrandRow;
		platform?: string | undefined;
		topic?: string | undefined;
		campaignId?: string | null | undefined;
		requestedBy?: string | undefined;
	},
): Promise<GeneratedPostResult> {
	const postId = createId("post");
	const platform = normalisePlatform(input.platform);
	const topic = input.topic?.trim() || "customer proof";
	const caption = `${input.brand.name}: ${topic}. This draft is pending approval before any export or scheduling.`;
	await dbRun(
		db,
		`INSERT INTO content_posts (
			id, brand_id, campaign_id, platform, status, risk_level, caption,
			hashtags_json, why_json, evidence_json, scheduled_at
		) VALUES (?, ?, ?, ?, 'pending_approval', 'low', ?, ?, ?, ?, ?)`,
		[
			postId,
			input.brand.id,
			input.campaignId ?? null,
			platform,
			caption,
			toJson(["#localbusiness", "#mustbeviral", `#${input.brand.slug}`]),
			toJson({ objective: topic, approvalGuardrail: "Approval required before manual export." }),
			toJson([{ type: "agent_draft", claim: "Generated by MarketingAgent mock-safe fallback." }]),
			addDaysIso(1),
		],
	);
	await dbRun(
		db,
		`INSERT INTO post_variants (id, post_id, platform, caption, metadata_json)
		VALUES (?, ?, ?, ?, ?)`,
		[createId("variant"), postId, platform, caption, toJson({ source: "generatePost" })],
	);
	await dbRun(
		db,
		`INSERT INTO usage_events (
			id, workspace_id, brand_id, event_type, provider, model, quantity, cost_estimate_cents, metadata_json
		) VALUES (?, ?, ?, 'ai.post_generated', 'mock', 'mock-single-post', 1, 0, ?)`,
		[
			createId("usage"),
			input.brand.workspace_id,
			input.brand.id,
			toJson({ topic, platform, campaignId: input.campaignId ?? null }),
		],
	);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "content_post.generated",
		entityType: "content_post",
		entityId: postId,
		after: { platform, status: "pending_approval", campaignId: input.campaignId ?? null },
	});

	return { postId, status: "pending_approval", platform, campaignId: input.campaignId ?? null };
}

export async function createCampaignFromOpportunity(
	db: D1Database,
	input: { brand: BrandRow; opportunityId: string; requestedBy?: string | undefined },
): Promise<OpportunityCampaignResult> {
	const opportunity = await dbFirst<{
		id: string;
		title: string;
		opportunity_type: string;
		evidence_json: string;
		impact_score: number;
	}>(
		db,
		`SELECT id, title, opportunity_type, evidence_json, impact_score
		FROM growth_opportunities
		WHERE id = ? AND brand_id = ?
		LIMIT 1`,
		[input.opportunityId, input.brand.id],
	);
	if (!opportunity) {
		return {
			ok: false,
			code: "OPPORTUNITY_NOT_FOUND",
			message: "Growth opportunity was not found for this brand.",
		};
	}

	const campaignId = createId("campaign");
	await dbRun(
		db,
		`INSERT INTO campaigns (id, brand_id, name, objective, status, metadata_json)
		VALUES (?, ?, ?, ?, 'draft', ?)`,
		[
			campaignId,
			input.brand.id,
			`${input.brand.name}: ${opportunity.title}`,
			opportunity.opportunity_type,
			toJson({
				source: "growth_opportunity",
				opportunityId: opportunity.id,
				impactScore: opportunity.impact_score,
				evidence: fromJson(opportunity.evidence_json, []),
			}),
		],
	);

	const postInputs = [
		{ platform: "instagram", topic: `${opportunity.title} proof point` },
		{ platform: "facebook", topic: `${opportunity.title} customer story` },
		{ platform: "linkedin", topic: `${opportunity.title} market insight` },
	];
	const postIds: string[] = [];
	for (const postInput of postInputs) {
		const post = await generateSinglePost(db, {
			brand: input.brand,
			platform: postInput.platform,
			topic: postInput.topic,
			campaignId,
			requestedBy: input.requestedBy,
		});
		postIds.push(post.postId);
	}

	await dbRun(
		db,
		"UPDATE growth_opportunities SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		[opportunity.id],
	);
	await writeAuditLog(db, {
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		userId: input.requestedBy ?? null,
		action: "growth_opportunity.converted",
		entityType: "growth_opportunity",
		entityId: opportunity.id,
		after: { campaignId, postCount: postIds.length },
	});

	return { ok: true, campaignId, postIds, opportunityId: opportunity.id, status: "converted" };
}

export async function generateMockImage(
	db: D1Database,
	input: { brand: BrandRow; prompt: string; postId?: string | undefined; router: ModelRouter },
): Promise<Record<string, unknown>> {
	const model = await input.router.generateImage({
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		category: "image_default",
		prompt: input.prompt,
		untrusted: true,
	});
	const creativeId = createId("creative");
	await insertGeneratedCreative(db, {
		creativeId,
		brandId: input.brand.id,
		postId: input.postId ?? null,
		prompt: input.prompt,
		provider: model.provider,
		model: model.model,
		r2Key: null,
		status: "complete",
		usageEventId: model.usageEventId ?? null,
		metadata: {
			mockImage: model.mockImage,
			syncFallback: true,
			r2Backed: false,
			failureReason: model.failureReason ?? null,
		},
	});
	return {
		creativeId,
		provider: model.provider,
		model: model.model,
		mockImage: model.mockImage,
		r2Backed: false,
	};
}

export async function insertGeneratedCreative(
	db: D1Database,
	input: GeneratedCreativeInsert,
): Promise<void> {
	await dbRun(
		db,
		`INSERT OR REPLACE INTO generated_creatives (
			id, brand_id, post_id, prompt, provider, model, r2_key, status, usage_event_id, metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			input.creativeId,
			input.brandId,
			input.postId ?? null,
			input.prompt,
			input.provider,
			input.model,
			input.r2Key ?? null,
			input.status,
			input.usageEventId ?? null,
			toJson(input.metadata),
		],
	);
}

function buildNextActions(brand: BrandRow | null, pendingCount: number, score: number | null): string[] {
	if (!brand) {
		return ["Create a brand before running campaigns."];
	}
	if (brand.onboarding_status !== "complete") {
		return ["Run onboarding scan."];
	}
	if (score === null) {
		return ["Generate brand intelligence."];
	}
	if (pendingCount > 0) {
		return ["Review pending approvals."];
	}
	return ["Generate a 30-day content calendar."];
}

function normaliseFieldPath(raw: string): string {
	return raw
		.trim()
		.split(".")
		.map((part) => part.trim())
		.filter(Boolean)
		.join(".");
}

function normalisePlatform(raw: string | undefined): string {
	const platform = raw?.trim().toLowerCase();
	if (platform === "facebook" || platform === "linkedin" || platform === "google_business") {
		return platform;
	}
	return "instagram";
}

function setNestedValue(target: Record<string, unknown>, fieldPath: string, value: unknown): void {
	const parts = fieldPath.split(".");
	let cursor = target;
	for (const part of parts.slice(0, -1)) {
		const next = cursor[part];
		if (!next || typeof next !== "object" || Array.isArray(next)) {
			cursor[part] = {};
		}
		cursor = cursor[part] as Record<string, unknown>;
	}
	cursor[parts[parts.length - 1] ?? fieldPath] = value;
}
