import type { Env } from "../env";

export function getDb(env: Env): D1Database {
	if (!env.DB) {
		throw new Error("D1 binding DB is not configured.");
	}

	return env.DB;
}

export function requireWorkspaceScope(workspaceId: string): string {
	if (!workspaceId) {
		throw new Error("workspaceId is required for tenant-scoped queries.");
	}

	return workspaceId;
}

export function requireBrandScope(brandId: string): string {
	if (!brandId) {
		throw new Error("brandId is required for brand-scoped queries.");
	}

	return brandId;
}
