import { Hono } from "hono";
import { createRequestHandler, type ServerBuild } from "react-router";

import { MarketingAgent } from "./agents/MarketingAgent";
import { getDb } from "./db/client";
import { dbAll } from "./db/sql";
import type { Env } from "./env";
import type { AppHonoContext } from "./http/types";
import { csrfProtection } from "./middleware/csrf";
import { handleError, handleNotFound } from "./middleware/error";
import { requestLogging } from "./middleware/request-logging";
import { securityHeaders } from "./middleware/security-headers";
import { MustBeViralMCP } from "./mcp/MustBeViralMCP";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { billingRoutes } from "./routes/billing";
import { brandRoutes } from "./routes/brands";
import { healthRoutes } from "./routes/health";
import { mcpRoutes } from "./routes/mcp";
import { oauthRoutes } from "./routes/oauth";
import { webhookRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspaces";
// Side-effect imports: each platform adapter self-registers with the
// platform registry on module load. Order doesn't matter; importing them
// here ensures the registry is populated before the first request.
import "./services/platforms/linkedin";
import "./services/platforms/x";
import {
	allPlatformsDisabled,
	isPlatformEnabled,
} from "./services/platforms/feature-flags";
import { PLATFORM_IDS, type PlatformId } from "./services/platforms/types";
import { ApprovalSchedulingWorkflow } from "./workflows/ApprovalSchedulingWorkflow";
import { BrandOnboardingWorkflow } from "./workflows/BrandOnboardingWorkflow";
import { ContentCalendarWorkflow } from "./workflows/ContentCalendarWorkflow";
import { DMAutomationSetupWorkflow } from "./workflows/DMAutomationSetupWorkflow";
import { GrowthOpportunityWorkflow } from "./workflows/GrowthOpportunityWorkflow";
import { ImageGenerationWorkflow } from "./workflows/ImageGenerationWorkflow";
import { PlatformReplyWorkflow } from "./workflows/PlatformReplyWorkflow";
import { WeeklyReportWorkflow } from "./workflows/WeeklyReportWorkflow";

export {
	ApprovalSchedulingWorkflow,
	BrandOnboardingWorkflow,
	ContentCalendarWorkflow,
	DMAutomationSetupWorkflow,
	GrowthOpportunityWorkflow,
	ImageGenerationWorkflow,
	MarketingAgent,
	MustBeViralMCP,
	PlatformReplyWorkflow,
	WeeklyReportWorkflow,
};

const app = new Hono<AppHonoContext>();
const api = new Hono<AppHonoContext>();

async function loadServerBuild(): Promise<ServerBuild> {
	const build = await import("virtual:react-router/server-build");

	return {
		assets: build.assets,
		assetsBuildDirectory: build.assetsBuildDirectory,
		entry: build.entry,
		future: build.future,
		isSpaMode: build.isSpaMode,
		prerender: build.prerender,
		publicPath: build.publicPath,
		routeDiscovery: build.routeDiscovery,
		routes: build.routes,
		ssr: build.ssr,
		...(build.basename === undefined ? {} : { basename: build.basename }),
		...(build.unstable_getCriticalCss === undefined
			? {}
			: { unstable_getCriticalCss: build.unstable_getCriticalCss }),
	};
}

app.use("*", requestLogging());
app.use("*", securityHeaders());
app.use("*", csrfProtection());
app.onError(handleError);

api.route("/", healthRoutes);
api.route("/auth", authRoutes);
api.route("/workspaces", workspaceRoutes);
api.route("/brands", brandRoutes);
api.route("/billing", billingRoutes);
api.route("/admin", adminRoutes);
api.route("/mcp", mcpRoutes);
api.route("/webhooks", webhookRoutes);
api.route("/oauth", oauthRoutes);
api.notFound(handleNotFound);

app.route("/api", api);

app.get("*", (c) => {
	const requestHandler = createRequestHandler(loadServerBuild, import.meta.env.MODE);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

/**
 * Cloudflare cron handler. Triggered every 5 minutes per wrangler.jsonc
 * `triggers.crons`. Drives:
 *   1. Inbound comment polling per platform (when its INGEST flag is ON).
 *   2. Outbound reply dispatch for `dm_events.status = 'approved'` rows
 *      whose platform has its INGEST flag ON and an adapter registered.
 *
 * Post-build state: every flag is "false" in production, so this handler
 * exits within milliseconds without making any external calls or queueing
 * any workflows. The cron is wired into the deployed worker so per-platform
 * launches can be done via a single `wrangler secret put` flip — no redeploy
 * required.
 */
function scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
	if (allPlatformsDisabled(env)) {
		console.log("[cron] all platform flags disabled — exiting early");
		return;
	}
	for (const platform of PLATFORM_IDS) {
		if (!isPlatformEnabled(env, platform, "ingest")) {
			continue;
		}
		ctx.waitUntil(dispatchPendingReplies(env, platform));
		if (platform === "x") {
			ctx.waitUntil(pollXMentionsForAllAccounts(env));
		}
	}
}

/**
 * X (Twitter) cron poll: fetch new mentions for every active X social_account_tokens
 * row using a since_id cursor stored in KV `cursor:x:<accountId>`. Each new mention
 * is persisted as a platform_comments + dm_events(status='received') row so the
 * operator can approve a reply in the UI.
 */
async function pollXMentionsForAllAccounts(env: Env): Promise<void> {
	const db = getDb(env);
	type TokenRow = {
		id: string;
		brand_id: string;
		external_account_id: string;
		token_kv_key: string;
	};
	const rows = await dbAll<TokenRow>(
		db,
		`SELECT id, brand_id, external_account_id, token_kv_key
		FROM social_account_tokens
		WHERE platform = 'x' AND status = 'active'
		ORDER BY last_used_at DESC, created_at DESC
		LIMIT 25`,
		[],
	);
	if (rows.length === 0) {
		return;
	}
	const { readToken } = await import("./services/platforms/token-storage");
	const { pollXMentions } = await import("./services/platforms/x");
	const { dbRun, toJson } = await import("./db/sql");
	const { createId } = await import("./utils/id");
	for (const row of rows) {
		try {
			const payload = await readToken(env, {
				brandId: row.brand_id,
				tokenKvKey: row.token_kv_key,
			});
			if (!payload) continue;
			const cursorKey = `cursor:x:${row.external_account_id}`;
			const sinceIdRaw = env.CACHE ? await env.CACHE.get(cursorKey, { type: "text" }) : null;
			const sinceId = typeof sinceIdRaw === "string" ? sinceIdRaw : undefined;
			const poll = await pollXMentions({
				accountId: row.external_account_id,
				accessToken: payload.access_token,
				...(sinceId === undefined ? {} : { sinceId }),
			});
			if (!poll.ok) {
				console.warn(
					`[cron] pollXMentions failed for account=${row.external_account_id} reason=${poll.errorCode ?? "unknown"}`,
				);
				continue;
			}
			for (const ev of poll.events) {
				const commentId = createId("pcom");
				await dbRun(
					db,
					`INSERT OR IGNORE INTO platform_comments (
						id, brand_id, published_post_id, platform, external_comment_id,
						parent_external_comment_id, author_external_id, author_handle, body, metadata_json
					) VALUES (?, ?, NULL, 'x', ?, NULL, ?, ?, ?, ?)`,
					[
						commentId,
						row.brand_id,
						ev.externalCommentId,
						ev.authorExternalId ?? null,
						ev.authorHandle ?? null,
						ev.body,
						toJson({ referenced_tweet_id: ev.referencedTweetId ?? null, source: "cron_poll" }),
					],
				);
				const dmEventId = createId("dme");
				await dbRun(
					db,
					`INSERT INTO dm_events (id, brand_id, rule_id, platform, status, event_json)
					VALUES (?, ?, NULL, 'x', 'received', ?)`,
					[
						dmEventId,
						row.brand_id,
						toJson({
							platform_comment_id: commentId,
							external_comment_id: ev.externalCommentId,
							author_external_id: ev.authorExternalId ?? null,
							body: ev.body,
						}),
					],
				);
			}
			if (poll.newestId && env.CACHE) {
				await env.CACHE.put(cursorKey, poll.newestId, { expirationTtl: 30 * 86400 });
			}
		} catch (err) {
			console.error(`[cron] pollXMentions threw for account=${row.external_account_id}:`, err);
		}
	}
}

async function dispatchPendingReplies(env: Env, platform: PlatformId): Promise<void> {
	const db = getDb(env);
	type PendingRow = {
		id: string;
		brand_id: string;
	};
	const pending = await dbAll<PendingRow>(
		db,
		`SELECT id, brand_id
		FROM dm_events
		WHERE platform = ?
		  AND status = 'approved'
		ORDER BY created_at ASC
		LIMIT 25`,
		[platform],
	);
	for (const row of pending) {
		try {
			await env.PLATFORM_REPLY_WORKFLOW.create({
				params: {
					brandId: row.brand_id,
					platform,
					dmEventId: row.id,
				},
			});
		} catch (err) {
			console.error(
				`[cron] PLATFORM_REPLY_WORKFLOW.create failed for dm_event=${row.id} platform=${platform}`,
				err,
			);
		}
	}
}

export { scheduled };

export default {
	fetch: app.fetch.bind(app),
	scheduled,
};
