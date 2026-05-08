import { dbFirst } from "../db/sql";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMembership extends Record<string, unknown> {
	workspace_id: string;
	role: WorkspaceRole;
}

export interface BrandAccess extends Record<string, unknown> {
	brand_id: string;
	workspace_id: string;
	role: WorkspaceRole;
}

export async function getWorkspaceMembership(
	db: D1Database,
	workspaceId: string,
	userId: string,
): Promise<WorkspaceMembership | null> {
	return dbFirst<WorkspaceMembership>(
		db,
		`SELECT workspace_id, role
		FROM workspace_members
		WHERE workspace_id = ? AND user_id = ?
		LIMIT 1`,
		[workspaceId, userId],
	);
}

export async function getBrandAccess(
	db: D1Database,
	brandId: string,
	userId: string,
): Promise<BrandAccess | null> {
	return dbFirst<BrandAccess>(
		db,
		`SELECT b.id AS brand_id, b.workspace_id, wm.role
		FROM brands b
		INNER JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
		WHERE b.id = ? AND wm.user_id = ? AND b.deleted_at IS NULL
		LIMIT 1`,
		[brandId, userId],
	);
}
