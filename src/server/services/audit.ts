import { dbRun, toJson } from "../db/sql";
import { createId } from "../utils/id";

export interface AuditLogInput {
	workspaceId?: string | null;
	brandId?: string | null;
	userId?: string | null;
	action: string;
	entityType: string;
	entityId?: string | null;
	before?: unknown;
	after?: unknown;
	metadata?: Record<string, unknown>;
}

export async function writeAuditLog(db: D1Database, input: AuditLogInput): Promise<void> {
	await dbRun(
		db,
		`INSERT INTO audit_logs (
			id, workspace_id, brand_id, user_id, action, entity_type, entity_id,
			before_json, after_json, metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			createId("audit"),
			input.workspaceId ?? null,
			input.brandId ?? null,
			input.userId ?? null,
			input.action,
			input.entityType,
			input.entityId ?? null,
			input.before === undefined ? null : toJson(input.before),
			input.after === undefined ? null : toJson(input.after),
			toJson(input.metadata ?? {}),
		],
	);
}
