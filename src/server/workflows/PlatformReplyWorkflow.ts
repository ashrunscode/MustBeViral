import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import type { Env } from "../env";
import { writeAuditLog } from "../services/audit";
import { isPlatformEnabled } from "../services/platforms/feature-flags";
import { getAdapter } from "../services/platforms/registry";
import { readToken } from "../services/platforms/token-storage";
import type { AccessToken, PlatformId } from "../services/platforms/types";
import { createId } from "../utils/id";
import { type BrandWorkflowInput } from "./base";

export interface PlatformReplyWorkflowInput extends BrandWorkflowInput {
	dmEventId?: string;
	platform?: PlatformId;
	externalCommentId?: string;
	replyBody?: string;
	socialAccountTokenId?: string;
}

// Indexable shapes for dbFirst<T> (which constrains T extends Record<string, unknown>)
interface DmEventQueryRow extends Record<string, unknown> {
	id: string;
	brand_id: string;
	rule_id: string | null;
	platform: string;
	status: string;
	event_json: string;
}

interface SocialAccountTokenQueryRow extends Record<string, unknown> {
	id: string;
	brand_id: string;
	platform: string;
	external_account_id: string;
	scope_csv: string;
	token_kv_key: string;
	access_token_expires_at: string;
	refresh_token_expires_at: string | null;
	status: string;
}

interface ValidationOk {
	ok: true;
	workflowRunId: string;
	brandId: string;
	workspaceId: string;
	platform: PlatformId;
	dmEventId: string;
	tokenRowId: string;
	tokenKvKey: string;
	externalAccountId: string;
	scopeCsv: string;
	accessTokenExpiresAt: string;
	replyBody: string;
	externalCommentId: string;
	approvedBy: string;
}

interface ValidationSkipped {
	ok: false;
	reason:
		| "missing_dmEventId"
		| "missing_platform"
		| "feature_disabled"
		| "dm_event_not_found"
		| "wrong_brand"
		| "dm_event_not_approved"
		| "no_active_token"
		| "no_adapter";
	workflowRunId: string;
	detail: string | null;
}

interface ReplyStepResult {
	status: "sent" | "failed" | "waiting_manual";
	externalReplyId: string | null;
	errorCode: string | null;
	errorMessage: string | null;
	elapsedMs: number;
}

/**
 * PlatformReplyWorkflow — sends an approved reply to a platform comment.
 *
 * Trigger: cron-driven (`src/server/index.ts::scheduled`) scans for
 * `dm_events.status = 'approved'` rows and queues this workflow per row.
 *
 * Safety:
 *  - Approval-before-reply gate: only runs when `dm_events.status === 'approved'`.
 *  - Feature-flag gate: only runs when `ENABLE_<PLATFORM>_INGEST = "true"`.
 *  - Adapter-missing gate: if the platform's adapter isn't registered (e.g.
 *    Phase A before Phase B-E land), the workflow records `waiting_manual`
 *    without calling any external API.
 *  - Audit log every outbound platform call.
 */
export class PlatformReplyWorkflow extends WorkflowEntrypoint<Env, PlatformReplyWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<PlatformReplyWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const validation: ValidationOk | ValidationSkipped = await step.do(
			"validate-event-and-token",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<ValidationOk | ValidationSkipped> => {
				const workflowRunId = createId("workflow");
				const dmEventId = event.payload.dmEventId;
				const platform = event.payload.platform;

				if (!dmEventId) {
					return { ok: false, reason: "missing_dmEventId", workflowRunId, detail: null };
				}
				if (!platform) {
					return { ok: false, reason: "missing_platform", workflowRunId, detail: null };
				}
				if (!isPlatformEnabled(this.env, platform, "ingest")) {
					return { ok: false, reason: "feature_disabled", workflowRunId, detail: null };
				}

				const db = getDb(this.env);
				const dmEvent = await dbFirst<DmEventQueryRow>(
					db,
					`SELECT id, brand_id, rule_id, platform, status, event_json
					FROM dm_events
					WHERE id = ?
					LIMIT 1`,
					[dmEventId],
				);
				if (!dmEvent) {
					return { ok: false, reason: "dm_event_not_found", workflowRunId, detail: null };
				}
				if (event.payload.brandId && event.payload.brandId !== dmEvent.brand_id) {
					return { ok: false, reason: "wrong_brand", workflowRunId, detail: null };
				}
				if (dmEvent.status !== "approved") {
					return {
						ok: false,
						reason: "dm_event_not_approved",
						workflowRunId,
						detail: `dm_events.status=${dmEvent.status}`,
					};
				}

				const tokenRow = event.payload.socialAccountTokenId
					? await dbFirst<SocialAccountTokenQueryRow>(
							db,
							`SELECT id, brand_id, platform, external_account_id, scope_csv,
								token_kv_key, access_token_expires_at, refresh_token_expires_at, status
							FROM social_account_tokens
							WHERE id = ? AND brand_id = ? AND status = 'active'
							LIMIT 1`,
							[event.payload.socialAccountTokenId, dmEvent.brand_id],
						)
					: await dbFirst<SocialAccountTokenQueryRow>(
							db,
							`SELECT id, brand_id, platform, external_account_id, scope_csv,
								token_kv_key, access_token_expires_at, refresh_token_expires_at, status
							FROM social_account_tokens
							WHERE brand_id = ? AND platform = ? AND status = 'active'
							ORDER BY last_used_at DESC, created_at DESC
							LIMIT 1`,
							[dmEvent.brand_id, platform],
						);
				if (!tokenRow) {
					return { ok: false, reason: "no_active_token", workflowRunId, detail: null };
				}

				if (!getAdapter(platform)) {
					return { ok: false, reason: "no_adapter", workflowRunId, detail: null };
				}

				const workspaceRow = await dbFirst<{ workspace_id: string }>(
					db,
					`SELECT workspace_id FROM brands WHERE id = ? LIMIT 1`,
					[dmEvent.brand_id],
				);
				const workspaceId = workspaceRow?.workspace_id ?? "";

				const replyBody = event.payload.replyBody ?? extractReplyFromEventJson(dmEvent.event_json);
				const externalCommentId =
					event.payload.externalCommentId ?? extractCommentIdFromEventJson(dmEvent.event_json);

				return {
					ok: true,
					workflowRunId,
					brandId: dmEvent.brand_id,
					workspaceId,
					platform,
					dmEventId: dmEvent.id,
					tokenRowId: tokenRow.id,
					tokenKvKey: tokenRow.token_kv_key,
					externalAccountId: tokenRow.external_account_id,
					scopeCsv: tokenRow.scope_csv,
					accessTokenExpiresAt: tokenRow.access_token_expires_at,
					replyBody,
					externalCommentId,
					approvedBy: event.payload.requestedBy ?? "",
				};
			},
		);

		if (validation.ok === false) {
			const db = getDb(this.env);
			await dbRun(
				db,
				`INSERT OR REPLACE INTO workflow_runs (
					id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
					input_json, output_json
				) VALUES (?, ?, NULL, NULL, 'PlatformReplyWorkflow', 'waiting_manual', 100, ?, ?)`,
				[
					validation.workflowRunId,
					event.instanceId,
					toJson({
						dmEventId: event.payload.dmEventId,
						platform: event.payload.platform,
					}),
					toJson({
						skipped: true,
						reason: validation.reason,
						detail: validation.detail,
					}),
				],
			);
			return {
				workflow: "PlatformReplyWorkflow",
				status: "waiting_manual",
				instanceId: event.instanceId,
				workflowRunId: validation.workflowRunId,
				skipped: true,
				reason: validation.reason,
			};
		}

		// Capture into a const so TS narrows correctly inside the step closures.
		const v: ValidationOk = validation;

		const result: ReplyStepResult = await step.do(
			"load-adapter-and-reply",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<ReplyStepResult> => {
				const adapter = getAdapter(v.platform);
				if (!adapter) {
					return {
						status: "waiting_manual",
						externalReplyId: null,
						errorCode: "no_adapter",
						errorMessage: "Platform adapter not registered",
						elapsedMs: 0,
					};
				}
				const payload = await readToken(this.env, {
					brandId: v.brandId,
					tokenKvKey: v.tokenKvKey,
				});
				if (!payload) {
					return {
						status: "failed",
						externalReplyId: null,
						errorCode: "token_missing",
						errorMessage: "KV ciphertext absent for active token",
						elapsedMs: 0,
					};
				}
				const accessToken: AccessToken = {
					accessToken: payload.access_token,
					...(payload.refresh_token === undefined ? {} : { refreshToken: payload.refresh_token }),
					tokenType: payload.token_type ?? "Bearer",
					expiresAt: v.accessTokenExpiresAt,
					scopes: v.scopeCsv.split(",").filter(Boolean),
					externalAccountId: v.externalAccountId,
					socialAccountTokenId: v.tokenRowId,
					...(payload.platform_metadata === undefined ? {} : { platformMetadata: payload.platform_metadata }),
				};
				const startedAt = Date.now();
				const replyResult = await adapter.reply(
					{
						brandId: v.brandId,
						workspaceId: v.workspaceId,
						inboundEventId: v.dmEventId,
						externalCommentId: v.externalCommentId,
						replyBody: v.replyBody,
						approvedBy: v.approvedBy,
					},
					accessToken,
				);
				const elapsedMs = Date.now() - startedAt;
				if (replyResult.status === "sent") {
					return {
						status: "sent",
						externalReplyId: replyResult.externalReplyId ?? null,
						errorCode: null,
						errorMessage: null,
						elapsedMs,
					};
				}
				return {
					status: "failed",
					externalReplyId: replyResult.externalReplyId ?? null,
					errorCode: replyResult.errorCode ?? "unknown_error",
					errorMessage: replyResult.errorMessage ?? null,
					elapsedMs,
				};
			},
		);

		await step.do(
			"record-result",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<{ ok: true }> => {
				const db = getDb(this.env);
				if (result.status === "sent") {
					await dbRun(db, `UPDATE dm_events SET status = 'sent' WHERE id = ?`, [v.dmEventId]);
				}
				await writeAuditLog(db, {
					workspaceId: v.workspaceId,
					brandId: v.brandId,
					userId: v.approvedBy || null,
					action: `platform.${v.platform}.reply.${result.status}`,
					entityType: "dm_event",
					entityId: v.dmEventId,
					after: {
						externalReplyId: result.externalReplyId,
						errorCode: result.errorCode,
						elapsedMs: result.elapsedMs,
						socialAccountTokenId: v.tokenRowId,
					},
				});
				await dbRun(
					db,
					`INSERT OR REPLACE INTO workflow_runs (
						id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
						input_json, output_json
					) VALUES (?, ?, ?, ?, 'PlatformReplyWorkflow', ?, 100, ?, ?)`,
					[
						v.workflowRunId,
						event.instanceId,
						v.brandId,
						v.workspaceId,
						result.status === "sent" ? "complete" : "failed",
						toJson({
							dmEventId: v.dmEventId,
							platform: v.platform,
							externalCommentId: v.externalCommentId,
							replyBodyLength: v.replyBody.length,
						}),
						toJson({
							status: result.status,
							externalReplyId: result.externalReplyId,
							errorCode: result.errorCode,
							errorMessage: result.errorMessage,
							elapsedMs: result.elapsedMs,
						}),
					],
				);
				await dbRun(
					db,
					`UPDATE social_account_tokens SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
					[v.tokenRowId],
				);
				return { ok: true };
			},
		);

		return {
			workflow: "PlatformReplyWorkflow",
			status: result.status,
			instanceId: event.instanceId,
			workflowRunId: v.workflowRunId,
			platform: v.platform,
			externalReplyId: result.externalReplyId,
			errorCode: result.errorCode,
			elapsedMs: result.elapsedMs,
		};
	}
}

function extractReplyFromEventJson(eventJson: string): string {
	try {
		const parsed = JSON.parse(eventJson) as Record<string, unknown>;
		const reply = parsed.reply_body ?? parsed.replyBody ?? "";
		return typeof reply === "string" ? reply : "";
	} catch {
		return "";
	}
}

function extractCommentIdFromEventJson(eventJson: string): string {
	try {
		const parsed = JSON.parse(eventJson) as Record<string, unknown>;
		const commentId = parsed.external_comment_id ?? parsed.externalCommentId ?? parsed.comment_id ?? "";
		return typeof commentId === "string" ? commentId : "";
	} catch {
		return "";
	}
}
