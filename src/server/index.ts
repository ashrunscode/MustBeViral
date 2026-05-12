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
// Side-effect import: LinkedIn adapter self-registers with the platform
// registry. Other platforms self-register the same way as they land in
// Phase C-E.
import "./services/platforms/linkedin";
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
