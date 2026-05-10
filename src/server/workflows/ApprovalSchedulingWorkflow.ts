import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import type { Env } from "../env";
import { writeAuditLog } from "../services/audit";
import { getBrand } from "../services/brand-operations";
import { getSchedulerProvider, type SchedulerProviderId } from "../services/scheduler";
import { createId } from "../utils/id";
import { type BrandWorkflowInput } from "./base";
import {
	buildScheduledPostWritePlan,
	evaluateApprovedPostsForScheduling,
	resolveSchedulingProviderDecision,
	type ScheduledPostWritePlan,
	type SchedulingPostEvaluation,
	type WorkflowSchedulablePost,
} from "./workflow-policy";

export interface ApprovalSchedulingWorkflowInput extends BrandWorkflowInput {
	postIds?: string[];
	scheduledAt?: string;
	provider?: SchedulerProviderId;
}

interface ValidationResult {
	brandId: string;
	workspaceId: string;
	provider: SchedulerProviderId;
	postIds: string[];
	scheduledAt: string | null;
	defaultScheduledAt: string;
	workflowRunId: string;
	requestedBy: string | null;
}

interface ProviderDeferredResult {
	status: "deferred";
	provider: SchedulerProviderId;
	reason: string;
	workflowRunId: string;
}

interface PersistResult {
	status: "complete";
	workflowRunId: string;
	exportedCount: number;
}

interface WorkflowSchedulablePostRow extends Record<string, unknown> {
	id: string;
	brand_id: string;
	platform: string;
	status: string;
	caption: string;
	scheduled_at: string | null;
}

export class ApprovalSchedulingWorkflow extends WorkflowEntrypoint<
	Env,
	ApprovalSchedulingWorkflowInput
> {
	override async run(
		event: Readonly<WorkflowEvent<ApprovalSchedulingWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId } = event.payload;
		const postIds = event.payload.postIds ?? [];
		if (!brandId) {
			return {
				workflow: "ApprovalSchedulingWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}
		if (postIds.length === 0) {
			return {
				workflow: "ApprovalSchedulingWorkflow",
				status: "skipped",
				reason: "missing_postIds",
				instanceId: event.instanceId,
			};
		}

		const validation: ValidationResult = await step.do(
			"validate-brand-and-provider",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<ValidationResult> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				return {
					brandId: brand.id,
					workspaceId: brand.workspace_id,
					provider: event.payload.provider ?? "manual",
					postIds,
					scheduledAt: event.payload.scheduledAt ?? null,
					defaultScheduledAt: event.timestamp.toISOString(),
					workflowRunId: createId("workflow"),
					requestedBy: event.payload.requestedBy ?? null,
				};
			},
		);

		const providerDecision = resolveSchedulingProviderDecision(validation.provider);
		if (!providerDecision.ok) {
			const deferred: ProviderDeferredResult = await step.do(
				"record-provider-deferred",
				{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
				async (): Promise<ProviderDeferredResult> => {
					const db = getDb(this.env);
					await writeWorkflowRun(db, {
						validation,
						externalWorkflowId: event.instanceId,
						status: "waiting_manual",
						progress: 100,
						output: {
							provider: providerDecision.provider,
							reason: providerDecision.reason,
							message: providerDecision.message,
						},
						errorMessage: providerDecision.message,
					});
					await writeAuditLog(db, {
						workspaceId: validation.workspaceId,
						brandId: validation.brandId,
						userId: validation.requestedBy,
						action: "scheduler.provider_deferred",
						entityType: "scheduler",
						after: {
							provider: providerDecision.provider,
							reason: providerDecision.reason,
						},
					});
					return {
						status: "deferred",
						provider: providerDecision.provider,
						reason: providerDecision.reason,
						workflowRunId: validation.workflowRunId,
					};
				},
			);
			return {
				workflow: "ApprovalSchedulingWorkflow",
				status: deferred.status,
				instanceId: event.instanceId,
				workflowRunId: deferred.workflowRunId,
				provider: deferred.provider,
				reason: deferred.reason,
			};
		}

		const evaluation: SchedulingPostEvaluation = await step.do(
			"load-and-validate-approved-posts",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<SchedulingPostEvaluation> => {
				const db = getDb(this.env);
				const posts: WorkflowSchedulablePost[] = [];
				for (const postId of validation.postIds) {
					const post = await dbFirst<WorkflowSchedulablePostRow>(
						db,
						`SELECT id, brand_id, platform, status, caption, scheduled_at
						FROM content_posts
						WHERE id = ? AND brand_id = ?
						LIMIT 1`,
						[postId, validation.brandId],
					);
					if (post) {
						posts.push(toWorkflowSchedulablePost(post));
					}
				}
				return evaluateApprovedPostsForScheduling(posts, validation.postIds);
			},
		);

		if (!evaluation.ok) {
			await step.do(
				"record-approval-gate-failure",
				{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
				async (): Promise<{ status: "failed"; workflowRunId: string }> => {
					const db = getDb(this.env);
					await writeWorkflowRun(db, {
						validation,
						externalWorkflowId: event.instanceId,
						status: "failed",
						progress: 100,
						output: {
							errorCode: evaluation.errorCode,
							postId: evaluation.postId,
							message: evaluation.message,
						},
						errorMessage: evaluation.message,
					});
					return { status: "failed", workflowRunId: validation.workflowRunId };
				},
			);
			return {
				workflow: "ApprovalSchedulingWorkflow",
				status: "failed",
				instanceId: event.instanceId,
				workflowRunId: validation.workflowRunId,
				errorCode: evaluation.errorCode,
				postId: evaluation.postId,
				message: evaluation.message,
			};
		}

		const scheduledPlans: ScheduledPostWritePlan[] = await step.do(
			"manual-export-approved-posts",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<ScheduledPostWritePlan[]> => {
				const provider = getSchedulerProvider("manual");
				const plans: ScheduledPostWritePlan[] = [];
				for (const post of evaluation.posts) {
					const scheduledAt =
						validation.scheduledAt ?? post.scheduled_at ?? validation.defaultScheduledAt;
					const result = await provider.schedule({
						postId: post.id,
						brandId: validation.brandId,
						platform: post.platform,
						caption: post.caption,
						scheduledAt,
					});
					plans.push(
						buildScheduledPostWritePlan({
							post,
							scheduledPostId: createId("sched"),
							scheduledAt,
							result,
						}),
					);
				}
				return plans;
			},
		);

		const persisted: PersistResult = await step.do(
			"persist-manual-export",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<PersistResult> => {
				const db = getDb(this.env);
				const batchStatements: D1PreparedStatement[] = [];
				for (const plan of scheduledPlans) {
					batchStatements.push(
						db
							.prepare(
								`INSERT OR IGNORE INTO scheduled_posts (
									id, brand_id, post_id, scheduler_provider, external_id, status,
									scheduled_at, failure_reason, metadata_json
								) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
							)
							.bind(
								plan.scheduledPostId,
								validation.brandId,
								plan.postId,
								plan.provider,
								plan.externalId,
								plan.status,
								plan.scheduledAt,
								plan.failureReason,
								plan.metadataJson,
							),
						db
							.prepare(
								`UPDATE content_posts
								SET status = ?, updated_at = CURRENT_TIMESTAMP
								WHERE id = ? AND brand_id = ?`,
							)
							.bind(plan.nextPostStatus, plan.postId, validation.brandId),
					);
				}
				if (batchStatements.length > 0) {
					await db.batch(batchStatements);
				}
				await writeWorkflowRun(db, {
					validation,
					externalWorkflowId: event.instanceId,
					status: "complete",
					progress: 100,
					output: {
						provider: "manual",
						scheduledPostIds: scheduledPlans.map((plan) => plan.scheduledPostId),
						postIds: scheduledPlans.map((plan) => plan.postId),
					},
					errorMessage: null,
				});
				await writeAuditLog(db, {
					workspaceId: validation.workspaceId,
					brandId: validation.brandId,
					userId: validation.requestedBy,
					action: "scheduler.manual_export.workflow_completed",
					entityType: "scheduled_post",
					after: { count: scheduledPlans.length, provider: "manual" },
				});
				return {
					status: "complete",
					workflowRunId: validation.workflowRunId,
					exportedCount: scheduledPlans.length,
				};
			},
		);

		return {
			workflow: "ApprovalSchedulingWorkflow",
			status: persisted.status,
			instanceId: event.instanceId,
			workflowRunId: persisted.workflowRunId,
			provider: "manual",
			exportedCount: persisted.exportedCount,
			postIds: scheduledPlans.map((plan) => plan.postId),
		};
	}
}

function toWorkflowSchedulablePost(row: WorkflowSchedulablePostRow): WorkflowSchedulablePost {
	return {
		id: row.id,
		brand_id: row.brand_id,
		platform: row.platform,
		status: row.status,
		caption: row.caption,
		scheduled_at: row.scheduled_at,
	};
}

async function writeWorkflowRun(
	db: D1Database,
	input: {
		validation: ValidationResult;
		externalWorkflowId: string;
		status: "complete" | "failed" | "waiting_manual";
		progress: number;
		output: unknown;
		errorMessage: string | null;
	},
): Promise<void> {
	await dbRun(
		db,
		`INSERT OR REPLACE INTO workflow_runs (
			id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
			input_json, output_json, error_message
		) VALUES (?, ?, ?, ?, 'ApprovalSchedulingWorkflow', ?, ?, ?, ?, ?)`,
		[
			input.validation.workflowRunId,
			input.externalWorkflowId,
			input.validation.brandId,
			input.validation.workspaceId,
			input.status,
			input.progress,
			toJson({
				brandId: input.validation.brandId,
				postIds: input.validation.postIds,
				provider: input.validation.provider,
				scheduledAt: input.validation.scheduledAt,
				requestedBy: input.validation.requestedBy,
			}),
			toJson(input.output),
			input.errorMessage,
		],
	);
}
