import { createMiddleware } from "hono/factory";

import { getDb } from "../db/client";
import { errorEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { getBrandAccess, getWorkspaceMembership } from "../services/access";

export function requireAdmin() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = c.get("requestId");
		const auth = c.get("auth");

		if (!auth || auth.role !== "admin") {
			return c.json(errorEnvelope("FORBIDDEN", "Admin access is required.", requestId), 403);
		}

		await next();
	});
}

export function requireWorkspaceMember() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = c.get("requestId");
		const auth = c.get("auth");
		const workspaceId = c.req.param("workspaceId") || c.req.header("X-Workspace-Id");

		if (!auth) {
			return c.json(errorEnvelope("UNAUTHORIZED", "Authentication is required.", requestId), 401);
		}
		if (!workspaceId) {
			return c.json(errorEnvelope("MISSING_WORKSPACE", "Workspace scope is required.", requestId), 400);
		}

		const membership = await getWorkspaceMembership(getDb(c.env), workspaceId, auth.userId);
		if (!membership) {
			return c.json(errorEnvelope("FORBIDDEN", "Workspace access is required.", requestId), 403);
		}

		c.set("workspaceId", workspaceId);
		c.set("workspaceRole", membership.role);
		await next();
	});
}

export function requireBrandAccess() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = c.get("requestId");
		const auth = c.get("auth");
		const brandId = c.req.param("brandId") || c.req.header("X-Brand-Id");

		if (!auth) {
			return c.json(errorEnvelope("UNAUTHORIZED", "Authentication is required.", requestId), 401);
		}
		if (!brandId) {
			return c.json(errorEnvelope("MISSING_BRAND", "Brand scope is required.", requestId), 400);
		}

		const access = await getBrandAccess(getDb(c.env), brandId, auth.userId);
		if (!access) {
			return c.json(errorEnvelope("FORBIDDEN", "Brand access is required.", requestId), 403);
		}

		c.set("brandId", brandId);
		c.set("workspaceId", access.workspace_id);
		c.set("workspaceRole", access.role);
		await next();
	});
}
