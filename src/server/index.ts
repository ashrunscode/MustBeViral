import { Hono } from "hono";
import { createRequestHandler, type ServerBuild } from "react-router";

import { MarketingAgent } from "./agents/MarketingAgent";
import type { AppHonoContext } from "./http/types";
import { handleError, handleNotFound } from "./middleware/error";
import { requestLogging } from "./middleware/request-logging";
import { MustBeViralMCP } from "./mcp/MustBeViralMCP";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { billingRoutes } from "./routes/billing";
import { brandRoutes } from "./routes/brands";
import { healthRoutes } from "./routes/health";
import { mcpRoutes } from "./routes/mcp";
import { webhookRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspaces";
import { ApprovalSchedulingWorkflow } from "./workflows/ApprovalSchedulingWorkflow";
import { BrandOnboardingWorkflow } from "./workflows/BrandOnboardingWorkflow";
import { ContentCalendarWorkflow } from "./workflows/ContentCalendarWorkflow";
import { DMAutomationSetupWorkflow } from "./workflows/DMAutomationSetupWorkflow";
import { GrowthOpportunityWorkflow } from "./workflows/GrowthOpportunityWorkflow";
import { ImageGenerationWorkflow } from "./workflows/ImageGenerationWorkflow";
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
app.onError(handleError);

api.route("/", healthRoutes);
api.route("/auth", authRoutes);
api.route("/workspaces", workspaceRoutes);
api.route("/brands", brandRoutes);
api.route("/billing", billingRoutes);
api.route("/admin", adminRoutes);
api.route("/mcp", mcpRoutes);
api.route("/webhooks", webhookRoutes);
api.notFound(handleNotFound);

app.route("/api", api);

app.get("*", (c) => {
	const requestHandler = createRequestHandler(loadServerBuild, import.meta.env.MODE);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default app;
