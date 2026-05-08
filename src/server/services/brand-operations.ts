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

export async function generateMockImage(
	db: D1Database,
	input: { brand: BrandRow; prompt: string; postId?: string | undefined; router: ModelRouter },
): Promise<Record<string, unknown>> {
	const model = await input.router.generateText({
		workspaceId: input.brand.workspace_id,
		brandId: input.brand.id,
		category: "image_default",
		prompt: input.prompt,
	});
	const creativeId = createId("creative");
	await dbRun(
		db,
		`INSERT INTO generated_creatives (
			id, brand_id, post_id, prompt, provider, model, r2_key, status, usage_event_id, metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)`,
		[
			creativeId,
			input.brand.id,
			input.postId ?? null,
			input.prompt,
			model.provider,
			model.model,
			`mock/${input.brand.id}/${creativeId}.png`,
			model.usageEventId ?? null,
			toJson({ mockImage: true, description: model.text }),
		],
	);
	return { creativeId, provider: model.provider, model: model.model };
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
