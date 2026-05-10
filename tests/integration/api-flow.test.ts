/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Hono } from "hono";
import { Miniflare } from "miniflare";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: { code: string; message: string } };
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
type TestEnv = Record<string, unknown> & { STRIPE_WEBHOOK_SECRET: string };

const password = "TestPassword123";

let mf: Miniflare;
let env: TestEnv;
let testApp: Hono;

beforeAll(async () => {
	testApp = await createApiApp();
});

beforeEach(async () => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	({ mf, env } = await createEnv());
});

afterEach(async () => {
	await mf.dispose();
});

describe("HTTP API integration flow", () => {
	it("supports signup, login, me, and logout", async () => {
		const client = new ApiClient(env);

		const signup = await client.post<{ user: { email: string } }>("/api/auth/signup", {
			email: "flow@example.com",
			password,
			name: "Flow User",
		});
		expect(signup.status).toBe(201);
		expect(signup.body.success && signup.body.data.user.email).toBe("flow@example.com");

		const me = await client.get<{ user: { email: string } }>("/api/auth/me");
		expect(me.status).toBe(200);
		expect(me.body.success && me.body.data.user.email).toBe("flow@example.com");

		const logout = await client.post<{ loggedOut: boolean }>("/api/auth/logout", {});
		expect(logout.status).toBe(200);

		const denied = await client.get("/api/auth/me");
		expect(denied.status).toBe(401);

		const login = await client.post<{ user: { email: string } }>("/api/auth/login", {
			email: "flow@example.com",
			password,
		});
		expect(login.status).toBe(200);
		expect(login.body.success && login.body.data.user.email).toBe("flow@example.com");
	}, 30_000);

	it("enforces workspace isolation, brand isolation, SSRF blocking, plan caps, admin denial, and MCP denial", async () => {
		const userA = new ApiClient(env);
		const userB = new ApiClient(env);

		await signup(userA, "tenant-a@example.com");
		await signup(userB, "tenant-b@example.com");

		const unsafeWorkspace = await createWorkspace(userA, "Unsafe Check");
		const unsafeBrand = await userA.post("/api/workspaces/" + unsafeWorkspace + "/brands", {
			name: "Unsafe Brand",
			websiteUrl: "http://127.0.0.1/internal",
			startOnboarding: false,
		});
		expect(unsafeBrand.status).toBe(400);
		expect(!unsafeBrand.body.success && unsafeBrand.body.error.code).toBe("UNSAFE_WEBSITE_URL");

		const workspaceId = await createWorkspace(userA, "Tenant A");
		const brandId = await createBrand(userA, workspaceId, "Tenant A Brand");

		expect((await userB.get("/api/workspaces/" + workspaceId)).status).toBe(403);
		expect((await userB.get("/api/brands/" + brandId)).status).toBe(403);
		expect((await userB.get("/api/admin/overview")).status).toBe(403);
		expect((await userB.get("/api/mcp/tools")).status).toBe(403);

		const capped = await userA.post("/api/workspaces/" + workspaceId + "/brands", {
			name: "Second Starter Brand",
			startOnboarding: false,
		});
		expect(capped.status).toBe(402);
		expect(!capped.body.success && capped.body.error.code).toBe("PLAN_LIMIT_REACHED");
	}, 30_000);

	it("keeps exports behind approval and supports safe DM rule lifecycle", async () => {
		const client = new ApiClient(env);
		await signup(client, "approval@example.com");
		const workspaceId = await createWorkspace(client, "Approval Workspace");
		const brandId = await createBrand(client, workspaceId, "Approval Brand");

		await expectOk(client.post("/api/brands/" + brandId + "/content-calendar/generate", {}));
		const calendar = await client.get<{ posts: Array<{ id: string; status: string }> }>(
			"/api/brands/" + brandId + "/content-calendar",
		);
		expect(calendar.status).toBe(200);
		const postId = calendar.body.success ? calendar.body.data.posts[0]?.id : undefined;
		expect(postId).toBeTruthy();

		const blockedExport = await client.post("/api/brands/" + brandId + "/scheduler/manual-export", {
			postIds: [postId],
		});
		expect(blockedExport.status).toBe(409);

		await expectOk(
			client.post("/api/brands/" + brandId + "/approvals/" + postId, { action: "approve" }),
		);
		const exported = await client.post("/api/brands/" + brandId + "/scheduler/manual-export", {
			postIds: [postId],
		});
		expect(exported.status).toBe(200);

		const draftRule = await client.post<{ ruleId: string; status: string }>(
			"/api/brands/" + brandId + "/dm-rules",
			{
				platform: "instagram",
				triggerType: "keyword",
				triggerValue: "price",
				responseTemplate: "Thanks. A human will follow up before anything is sent.",
			},
		);
		expect(draftRule.status).toBe(201);
		const ruleId = draftRule.body.success ? draftRule.body.data.ruleId : "";
		expect(draftRule.body.success && draftRule.body.data.status).toBe("pending_approval");

		const approved = await client.patch<{ status: string }>("/api/brands/" + brandId + "/dm-rules/" + ruleId, {
			action: "approve",
		});
		expect(approved.body.success && approved.body.data.status).toBe("approved");
		const active = await client.patch<{ status: string }>("/api/brands/" + brandId + "/dm-rules/" + ruleId, {
			action: "activate",
		});
		expect(active.body.success && active.body.data.status).toBe("active");
	}, 30_000);

	it("blocks cross-site cookie-backed mutations", async () => {
		const attacker = new ApiClient(env, { Origin: "https://evil.example" });
		await signup(attacker, "csrf@example.com");

		const blocked = await attacker.post("/api/workspaces", { name: "Cross Site Workspace" });
		expect(blocked.status).toBe(403);
		expect(!blocked.body.success && blocked.body.error.code).toBe("CSRF_BLOCKED");

		const firstParty = new ApiClient(env);
		await signup(firstParty, "csrf-first-party@example.com");
		const allowed = await firstParty.post("/api/workspaces", { name: "First Party Workspace" });
		expect(allowed.status).toBe(201);
	}, 30_000);

	it("exposes all spec H-1 MarketingAgent API methods with tenant-scoped results", async () => {
		const owner = new ApiClient(env);
		const outsider = new ApiClient(env);
		await signup(owner, "agent-owner@example.com");
		await signup(outsider, "agent-outsider@example.com");
		const workspaceId = await createWorkspace(owner, "Agent Workspace");
		const brandId = await createBrand(owner, workspaceId, "Agent Brand");

		const regenerated = await owner.post<{ profile: { fieldPath: string; version: number } }>(
			"/api/brands/" + brandId + "/profile/regenerate-field",
			{ fieldPath: "voice.summary" },
		);
		expect(regenerated.status).toBe(201);
		expect(regenerated.body.success && regenerated.body.data.profile.fieldPath).toBe("voice.summary");

		const generatedPost = await owner.post<{ post: { postId: string; status: string } }>(
			"/api/brands/" + brandId + "/posts/generate",
			{ platform: "linkedin", topic: "trust proof" },
		);
		expect(generatedPost.status).toBe(201);
		expect(generatedPost.body.success && generatedPost.body.data.post.status).toBe("pending_approval");

		await expectOk(owner.post("/api/brands/" + brandId + "/growth/generate", {}));
		const growth = await owner.get<{ opportunities: Array<{ id: string }> }>(
			"/api/brands/" + brandId + "/growth",
		);
		const opportunityId = growth.body.success ? growth.body.data.opportunities[0]?.id : undefined;
		expect(opportunityId).toBeTruthy();

		const campaign = await owner.post<{ campaign: { campaignId: string; postIds: string[]; status: string } }>(
			"/api/brands/" + brandId + "/growth/" + opportunityId + "/campaign",
			{},
		);
		expect(campaign.status).toBe(201);
		expect(campaign.body.success && campaign.body.data.campaign.status).toBe("converted");
		expect(campaign.body.success && campaign.body.data.campaign.postIds).toHaveLength(3);

		const report = await owner.post<{ workflowRunId: string }>(
			"/api/brands/" + brandId + "/reports/weekly/generate",
			{},
		);
		expect(report.status).toBe(202);
		const workflowRunId = report.body.success ? report.body.data.workflowRunId : "";
		const workflow = await owner.get<{ workflow: { id: string; output: { reportId?: string } } }>(
			"/api/brands/" + brandId + "/workflows/" + workflowRunId,
		);
		expect(workflow.status).toBe(200);
		expect(workflow.body.success && workflow.body.data.workflow.id).toBe(workflowRunId);
		expect(workflow.body.success && workflow.body.data.workflow.output.reportId).toBeTruthy();

		expect((await outsider.get("/api/brands/" + brandId + "/workflows/" + workflowRunId)).status).toBe(403);
	}, 30_000);

	it("rejects Stripe webhook tampering and handles replay idempotently", async () => {
		const payload = JSON.stringify({
			id: "evt_replay_test",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_missing" } },
		});
		const tampered = await rawRequest(env, "/api/webhooks/stripe", {
			body: payload,
			headers: { "stripe-signature": "t=1,v1=bad" },
		});
		expect(tampered.status).toBe(400);

		const signature = await stripeSignature(payload, env.STRIPE_WEBHOOK_SECRET);
		const first = await rawRequest(env, "/api/webhooks/stripe", {
			body: payload,
			headers: { "stripe-signature": signature },
		});
		expect(first.status).toBe(200);

		const replay = await rawRequest(env, "/api/webhooks/stripe", {
			body: payload,
			headers: { "stripe-signature": signature },
		});
		expect(replay.status).toBe(200);
		const replayBody = (await replay.json()) as ApiResponse<{ replay?: boolean }>;
		expect(replayBody.success && replayBody.data.replay).toBe(true);
	});

	it("applies Stripe subscription events to plan caps without external Stripe calls", async () => {
		const client = new ApiClient(env);
		await signup(client, "stripe-plan@example.com");
		const workspaceId = await createWorkspace(client, "Stripe Plan Workspace");
		await createBrand(client, workspaceId, "Starter Brand");

		const starterBlocked = await client.post("/api/workspaces/" + workspaceId + "/brands", {
			name: "Blocked Starter Brand",
			startOnboarding: false,
		});
		expect(starterBlocked.status).toBe(402);
		expect(!starterBlocked.body.success && starterBlocked.body.error.code).toBe("PLAN_LIMIT_REACHED");

		const subscriptionId = "sub_plan_caps";
		const checkoutPayload = JSON.stringify({
			id: "evt_checkout_plan_caps",
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_test_plan_caps",
					customer: "cus_plan_caps",
					subscription: subscriptionId,
					client_reference_id: workspaceId,
					metadata: { workspace_id: workspaceId, plan: "growth" },
				},
			},
		});
		const checkoutSignature = await stripeSignature(checkoutPayload, env.STRIPE_WEBHOOK_SECRET);
		const checkout = await rawRequest(env, "/api/webhooks/stripe", {
			body: checkoutPayload,
			headers: { "stripe-signature": checkoutSignature },
		});
		expect(checkout.status).toBe(200);

		const billing = await client.get<{
			subscription: { plan: string; status: string; stripe_subscription_id: string };
		}>("/api/billing/" + workspaceId);
		expect(billing.status).toBe(200);
		expect(billing.body.success && billing.body.data.subscription.plan).toBe("growth");
		expect(billing.body.success && billing.body.data.subscription.status).toBe("active");

		const growthAllowed = await client.post("/api/workspaces/" + workspaceId + "/brands", {
			name: "Growth Brand",
			startOnboarding: false,
		});
		expect(growthAllowed.status).toBe(201);

		const deletedPayload = JSON.stringify({
			id: "evt_delete_plan_caps",
			type: "customer.subscription.deleted",
			data: { object: { id: subscriptionId } },
		});
		const deletedSignature = await stripeSignature(deletedPayload, env.STRIPE_WEBHOOK_SECRET);
		const deleted = await rawRequest(env, "/api/webhooks/stripe", {
			body: deletedPayload,
			headers: { "stripe-signature": deletedSignature },
		});
		expect(deleted.status).toBe(200);

		const canceledBilling = await client.get<{
			subscription: { plan: string; status: string; stripe_subscription_id: string };
		}>("/api/billing/" + workspaceId);
		expect(canceledBilling.body.success && canceledBilling.body.data.subscription.status).toBe("canceled");

		const starterAgainBlocked = await client.post("/api/workspaces/" + workspaceId + "/brands", {
			name: "Blocked After Cancel",
			startOnboarding: false,
		});
		expect(starterAgainBlocked.status).toBe(402);
		expect(!starterAgainBlocked.body.success && starterAgainBlocked.body.error.code).toBe("PLAN_LIMIT_REACHED");
	});

	it("rate limits repeated auth attempts by IP", async () => {
		const client = new ApiClient(env, { "CF-Connecting-IP": "203.0.113.77" });
		let latest = 0;
		for (let attempt = 0; attempt < 31; attempt += 1) {
			const response = await client.post("/api/auth/login", {
				email: "missing@example.com",
				password,
			});
			latest = response.status;
		}
		expect(latest).toBe(429);
	});
});

async function createApiApp(): Promise<Hono> {
	const modules = {
		error: "../../src/server/middleware/error",
		requestLogging: "../../src/server/middleware/request-logging",
		securityHeaders: "../../src/server/middleware/security-headers",
		csrf: "../../src/server/middleware/csrf",
		admin: "../../src/server/routes/admin",
		auth: "../../src/server/routes/auth",
		billing: "../../src/server/routes/billing",
		brands: "../../src/server/routes/brands",
		health: "../../src/server/routes/health",
		mcp: "../../src/server/routes/mcp",
		webhooks: "../../src/server/routes/webhooks",
		workspaces: "../../src/server/routes/workspaces",
	};
	const [
		{ handleError, handleNotFound },
		{ requestLogging },
		{ securityHeaders },
		{ csrfProtection },
		{ adminRoutes },
		{ authRoutes },
		{ billingRoutes },
		{ brandRoutes },
		{ healthRoutes },
		{ mcpRoutes },
		{ webhookRoutes },
		{ workspaceRoutes },
	] = await Promise.all([
		import(modules.error),
		import(modules.requestLogging),
		import(modules.securityHeaders),
		import(modules.csrf),
		import(modules.admin),
		import(modules.auth),
		import(modules.billing),
		import(modules.brands),
		import(modules.health),
		import(modules.mcp),
		import(modules.webhooks),
		import(modules.workspaces),
	]);
	const app = new Hono();
	const api = new Hono();

	app.use("*", requestLogging());
	app.use("*", securityHeaders());
	app.use("*", csrfProtection());
	app.onError(handleError);

	api.route("/", healthRoutes);
	api.route("/auth", authRoutes);
	api.route("/billing", billingRoutes);
	api.route("/workspaces", workspaceRoutes);
	api.route("/brands", brandRoutes);
	api.route("/admin", adminRoutes);
	api.route("/mcp", mcpRoutes);
	api.route("/webhooks", webhookRoutes);
	api.notFound(handleNotFound);
	app.route("/api", api);

	return app;
}

async function createEnv(): Promise<{ mf: Miniflare; env: TestEnv }> {
	const mf = new Miniflare({
		modules: true,
		script: "export default { fetch() { return new Response('ok'); } }",
		d1Databases: { DB: "mustbeviral-test" },
		kvNamespaces: ["CACHE"],
		r2Buckets: ["MEDIA_BUCKET"],
		compatibilityDate: "2026-05-08",
		compatibilityFlags: ["nodejs_compat"],
	} as ConstructorParameters<typeof Miniflare>[0]);
	const db = await mf.getD1Database("DB");
	await applyMigration(db, "0001_initial.sql");
	await applyMigration(db, "0002_indexes_and_phase2.sql");

	return {
		mf,
		env: {
			DB: db,
			CACHE: await mf.getKVNamespace("CACHE"),
			MEDIA_BUCKET: await mf.getR2Bucket("MEDIA_BUCKET"),
			APP_ENV: "development",
			PUBLIC_APP_URL: "http://127.0.0.1:8787",
			DEFAULT_SCHEDULER_PROVIDER: "manual",
			DEFAULT_TEXT_MODEL: "mock",
			DEFAULT_IMAGE_MODEL: "mock-image",
			PREMIUM_IMAGE_MODEL: "mock-premium-image",
			FAST_IMAGE_MODEL: "mock-fast-image",
			USE_MOCK_AI: "true",
			USE_BROWSER_RUN: "false",
			STRIPE_SECRET_KEY: "",
			STRIPE_WEBHOOK_SECRET: "whsec_test",
		},
	};
}

class ApiClient {
	private cookie = "";

	constructor(
		private readonly bindings: TestEnv,
		private readonly defaultHeaders: Record<string, string> = {},
	) {}

	get<T>(path: string) {
		return this.request<T>("GET", path);
	}

	post<T>(path: string, body: unknown) {
		return this.request<T>("POST", path, body);
	}

	patch<T>(path: string, body: unknown) {
		return this.request<T>("PATCH", path, body);
	}

	private async request<T>(
		method: "GET" | "PATCH" | "POST",
		path: string,
		body?: unknown,
	): Promise<{ status: number; body: ApiResponse<T> }> {
		const headers = new Headers({
			...(method === "GET" ? {} : { Origin: "http://test.local" }),
			...this.defaultHeaders,
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...(this.cookie ? { Cookie: this.cookie } : {}),
		});
		const response = await (testApp as { request: Hono["request"] }).request(
			"http://test.local" + path,
			{
				method,
				headers,
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			},
			this.bindings,
		);
		this.storeCookie(response);
		return { status: response.status, body: (await response.json()) as ApiResponse<T> };
	}

	private storeCookie(response: Response): void {
		const setCookie = response.headers.get("set-cookie");
		if (!setCookie) {
			return;
		}
		const pair = setCookie.split(";")[0] ?? "";
		if (!pair || pair.endsWith("=")) {
			this.cookie = "";
			return;
		}
		this.cookie = pair;
	}
}

async function signup(client: ApiClient, email: string): Promise<void> {
	const response = await client.post("/api/auth/signup", { email, password, name: email });
	expect(response.status).toBe(201);
}

async function createWorkspace(client: ApiClient, name: string): Promise<string> {
	const response = await client.post<{ workspace: { id: string } }>("/api/workspaces", { name });
	expect(response.status).toBe(201);
	return response.body.success ? response.body.data.workspace.id : "";
}

async function createBrand(client: ApiClient, workspaceId: string, name: string): Promise<string> {
	const response = await client.post<{ brand: { id: string } }>("/api/workspaces/" + workspaceId + "/brands", {
		name,
		websiteUrl: "https://example.com/" + encodeURIComponent(name.toLowerCase()),
	});
	expect(response.status).toBe(201);
	return response.body.success ? response.body.data.brand.id : "";
}

async function expectOk<T>(promise: Promise<{ status: number; body: ApiResponse<T> }>): Promise<void> {
	const response = await promise;
	expect(response.status).toBeGreaterThanOrEqual(200);
	expect(response.status).toBeLessThan(300);
	expect(response.body.success).toBe(true);
}

async function rawRequest(
	bindings: TestEnv,
	path: string,
	input: { body: string; headers: Record<string, string> },
): Promise<Response> {
	return (testApp as { request: Hono["request"] }).request(
		"http://test.local" + path,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...input.headers },
			body: input.body,
		},
		bindings,
	);
}

async function applyMigration(db: Awaited<ReturnType<Miniflare["getD1Database"]>>, fileName: string): Promise<void> {
	const sql = readFileSync(join(process.cwd(), "src/server/db/migrations", fileName), "utf8");
	const statements = sql
		.split(/\r?\n/)
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement && !statement.startsWith("PRAGMA "));
	for (const statement of statements) {
		await db.prepare(statement).run();
	}
}

async function stripeSignature(payload: string, secret: string): Promise<string> {
	const timestamp = Math.floor(Date.now() / 1000);
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${timestamp}.${payload}`),
	);
	const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `t=${timestamp},v1=${hex}`;
}
