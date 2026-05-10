import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbAll, dbFirst, dbRun, toJson } from "../db/sql";
import { errorEnvelope, successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { parseJsonBody } from "../http/validation";
import { requireAuth } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/rbac";
import { getWorkspaceMembership } from "../services/access";
import { writeAuditLog } from "../services/audit";
import { createMockOnboardingArtifacts, getBrand } from "../services/brand-operations";
import { checkBrandCap } from "../services/entitlements";
import { normalizeScanUrl } from "../services/security/ssrf";
import { createId } from "../utils/id";
import { slugify } from "../utils/slug";
import { buildBrandWorkflowParams } from "../workflows/params";

export const workspaceRoutes = new Hono<AppHonoContext>();

const createWorkspaceSchema = z.object({
	name: z.string().min(1).max(120),
	slug: z.string().min(2).max(80).optional(),
});

const createBrandSchema = z.object({
	name: z.string().min(1).max(120),
	slug: z.string().min(2).max(80).optional(),
	websiteUrl: z.string().min(1).max(500).optional(),
	industry: z.string().max(120).optional(),
	socialLinks: z
		.array(
			z.object({
				platform: z.string().min(1).max(60),
				handle: z.string().max(120).optional(),
				profileUrl: z.string().max(500).optional(),
			}),
		)
		.max(12)
		.optional(),
	startOnboarding: z.boolean().optional(),
});

workspaceRoutes.use("*", requireAuth());

workspaceRoutes.get("/", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const workspaces = await dbAll(
		getDb(c.env),
		`SELECT w.id, w.name, w.slug, w.plan, w.created_at, wm.role
		FROM workspaces w
		INNER JOIN workspace_members wm ON wm.workspace_id = w.id
		WHERE wm.user_id = ? AND w.deleted_at IS NULL
		ORDER BY w.created_at DESC`,
		[auth?.userId ?? ""],
	);
	return c.json(successEnvelope({ workspaces }, requestId));
});

workspaceRoutes.post("/", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const parsed = await parseJsonBody(c, createWorkspaceSchema);
	if (!parsed.ok) {
		return parsed.response;
	}

	const db = getDb(c.env);
	const slug = slugify(parsed.data.slug ?? parsed.data.name, "workspace");
	const existing = await dbFirst(
		db,
		"SELECT id FROM workspaces WHERE slug = ? AND deleted_at IS NULL",
		[slug],
	);
	if (existing) {
		return c.json(
			errorEnvelope("WORKSPACE_SLUG_EXISTS", "Workspace slug already exists.", requestId),
			409,
		);
	}

	const workspaceId = createId("ws");
	await dbRun(db, "INSERT INTO workspaces (id, name, slug, settings_json) VALUES (?, ?, ?, ?)", [
		workspaceId,
		parsed.data.name,
		slug,
		toJson({ onboarding: "new" }),
	]);
	await dbRun(
		db,
		"INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
		[createId("wm"), workspaceId, auth?.userId ?? ""],
	);
	await dbRun(
		db,
		`INSERT INTO subscriptions (id, workspace_id, plan, status, metadata_json)
		VALUES (?, ?, 'starter', 'incomplete', ?)`,
		[createId("sub"), workspaceId, toJson({ source: "workspace_create" })],
	);
	await writeAuditLog(db, {
		workspaceId,
		userId: auth?.userId ?? null,
		action: "workspace.created",
		entityType: "workspace",
		entityId: workspaceId,
		after: { name: parsed.data.name, slug },
	});

	return c.json(
		successEnvelope({ workspace: { id: workspaceId, name: parsed.data.name, slug } }, requestId),
		201,
	);
});

workspaceRoutes.get("/:workspaceId", requireWorkspaceMember(), async (c) => {
	const requestId = c.get("requestId");
	const workspaceId = c.get("workspaceId");
	const db = getDb(c.env);
	const workspace = await dbFirst(
		db,
		`SELECT id, name, slug, plan, settings_json, created_at, updated_at
		FROM workspaces
		WHERE id = ? AND deleted_at IS NULL`,
		[workspaceId ?? ""],
	);
	const brands = await dbAll(
		db,
		`SELECT id, name, slug, website_url, industry, status, onboarding_status, created_at
		FROM brands
		WHERE workspace_id = ? AND deleted_at IS NULL
		ORDER BY created_at DESC`,
		[workspaceId ?? ""],
	);
	return c.json(successEnvelope({ workspace, brands }, requestId));
});

workspaceRoutes.get("/:workspaceId/brands", requireWorkspaceMember(), async (c) => {
	const requestId = c.get("requestId");
	const brands = await dbAll(
		getDb(c.env),
		`SELECT id, name, slug, website_url, industry, status, onboarding_status, created_at
		FROM brands
		WHERE workspace_id = ? AND deleted_at IS NULL
		ORDER BY created_at DESC`,
		[c.get("workspaceId") ?? ""],
	);
	return c.json(successEnvelope({ brands }, requestId));
});

workspaceRoutes.post("/:workspaceId/brands", requireWorkspaceMember(), async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
	const workspaceId = c.get("workspaceId");
	const parsed = await parseJsonBody(c, createBrandSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	if (!workspaceId) {
		return c.json(
			errorEnvelope("MISSING_WORKSPACE", "Workspace scope is required.", requestId),
			400,
		);
	}

	let websiteUrl: string | null = null;
	if (parsed.data.websiteUrl) {
		const safe = normalizeScanUrl(parsed.data.websiteUrl);
		if (!safe.ok) {
			return c.json(
				errorEnvelope("UNSAFE_WEBSITE_URL", safe.message, requestId, { reason: safe.code }),
				400,
			);
		}
		websiteUrl = safe.url;
	}

	const db = getDb(c.env);
	const membership = await getWorkspaceMembership(db, workspaceId, auth?.userId ?? "");
	if (!membership) {
		return c.json(errorEnvelope("FORBIDDEN", "Workspace access is required.", requestId), 403);
	}

	const brandCap = await checkBrandCap(db, workspaceId);
	if (!brandCap.allowed) {
		return c.json(
			errorEnvelope(
				"PLAN_LIMIT_REACHED",
				`Plan '${brandCap.plan}' allows up to ${String(brandCap.limit)} brand${brandCap.limit === 1 ? "" : "s"}.`,
				requestId,
				{ plan: brandCap.plan, used: brandCap.used, limit: brandCap.limit, cap: "brands" },
			),
			402,
		);
	}

	const brandId = createId("brand");
	const slug = slugify(parsed.data.slug ?? parsed.data.name, "brand");
	await dbRun(
		db,
		`INSERT INTO brands (id, workspace_id, name, slug, website_url, industry, onboarding_status)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			brandId,
			workspaceId,
			parsed.data.name,
			slug,
			websiteUrl,
			parsed.data.industry ?? null,
			parsed.data.startOnboarding === false ? "not_started" : "running",
		],
	);

	for (const link of parsed.data.socialLinks ?? []) {
		await dbRun(
			db,
			`INSERT INTO brand_social_profiles (id, brand_id, platform, handle, profile_url, connected_status)
			VALUES (?, ?, ?, ?, ?, 'not_connected')`,
			[createId("social"), brandId, link.platform, link.handle ?? null, link.profileUrl ?? null],
		);
	}

	await writeAuditLog(db, {
		workspaceId,
		brandId,
		userId: auth?.userId ?? null,
		action: "brand.created",
		entityType: "brand",
		entityId: brandId,
		after: { name: parsed.data.name, slug, websiteUrl },
	});

	const brand = await getBrand(db, brandId);
	let onboarding: Record<string, unknown> | null = null;
	if (brand && parsed.data.startOnboarding !== false) {
		if (c.env.BRAND_ONBOARDING_WORKFLOW) {
			const instance = await c.env.BRAND_ONBOARDING_WORKFLOW.create({
				params: buildBrandWorkflowParams({
					brandId: brand.id,
					workspaceId: brand.workspace_id,
					requestedBy: auth?.userId,
				}),
			});
			onboarding = {
				workflow: "BrandOnboardingWorkflow",
				workflowInstanceId: instance.id,
				status: "queued",
				mode: "workflow",
			};
		} else {
			onboarding = await createMockOnboardingArtifacts(db, {
				brand,
				requestedBy: auth?.userId,
			});
		}
	}

	return c.json(
		successEnvelope({ brand: await getBrand(db, brandId), onboarding }, requestId),
		201,
	);
});
