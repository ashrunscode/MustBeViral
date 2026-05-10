import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Env } from "../env";
import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import {
	getBrand,
	insertGeneratedCreative,
	type ContentPostRow,
} from "../services/brand-operations";
import { ModelRouter, type ImageModelResponse } from "../services/model-router";
import { buildCreativeR2Key, imageBase64ToBytes } from "../services/model-router-image";
import { sanitizeUntrustedText } from "../services/security/prompt-injection";
import { createId } from "../utils/id";
import { type BrandWorkflowInput } from "./base";

export interface ImageGenerationWorkflowInput extends BrandWorkflowInput {
	postId?: string;
	prompt?: string;
	category?: "image_fast" | "image_default" | "image_premium";
	creativeId?: string;
}

interface ValidationResult {
	brandId: string;
	workspaceId: string;
	postId: string | null;
	creativeId: string;
	workflowRunId: string;
}

interface SanitisedPromptResult {
	prompt: string;
	risk: "low" | "medium" | "high";
	flags: string[];
}

interface GeneratedImageStepResult {
	provider: string;
	model: string;
	imageBase64: string;
	contentType: "image/png";
	usageEventId: string | null;
	failureReason: string | null;
	mockImage: boolean;
}

interface UploadResult {
	r2Key: string;
	byteSize: number;
}

interface RecordResult {
	creativeId: string;
	workflowRunId: string;
	status: "complete";
}

export class ImageGenerationWorkflow extends WorkflowEntrypoint<Env, ImageGenerationWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<ImageGenerationWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, postId, requestedBy } = event.payload;
		const rawPrompt = event.payload.prompt?.trim();
		const category = event.payload.category ?? "image_default";

		if (!brandId) {
			return {
				workflow: "ImageGenerationWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}
		if (!rawPrompt) {
			return {
				workflow: "ImageGenerationWorkflow",
				status: "skipped",
				reason: "missing_prompt",
				instanceId: event.instanceId,
			};
		}

		const validation: ValidationResult = await step.do(
			"validate-brand-and-post",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<ValidationResult> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				if (postId) {
					const post = await getWorkflowPost(db, brand.id, postId);
					if (!post) {
						throw new Error(`post_not_found:${postId}`);
					}
				}
				return {
					brandId: brand.id,
					workspaceId: brand.workspace_id,
					postId: postId ?? null,
					creativeId: event.payload.creativeId ?? createId("creative"),
					workflowRunId: createId("workflow"),
				};
			},
		);

		const sanitised: SanitisedPromptResult = await step.do(
			"sanitise-prompt",
			(): Promise<SanitisedPromptResult> => {
				const result = sanitizeUntrustedText(rawPrompt);
				return Promise.resolve({
					prompt: result.sanitizedText,
					risk: result.risk,
					flags: result.flags,
				});
			},
		);

		const generated: GeneratedImageStepResult = await step.do(
			"generate-image",
			{ retries: { limit: 2, delay: "20 seconds", backoff: "exponential" } },
			async (): Promise<GeneratedImageStepResult> => {
				const db = getDb(this.env);
				const image = await new ModelRouter(this.env, db).generateImage({
					workspaceId: validation.workspaceId,
					brandId: validation.brandId,
					category,
					prompt: sanitised.prompt,
				});
				return toGeneratedImageStepResult(image);
			},
		);

		const uploaded: UploadResult = await step.do(
			"upload-image-to-r2",
			{ retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
			async (): Promise<UploadResult> => {
				const bytes = imageBase64ToBytes(generated.imageBase64);
				const r2Key = buildCreativeR2Key(validation.brandId, validation.creativeId);
				await this.env.MEDIA_BUCKET.put(r2Key, bytes, {
					httpMetadata: { contentType: generated.contentType },
				});
				return { r2Key, byteSize: bytes.byteLength };
			},
		);

		const recorded: RecordResult = await step.do(
			"record-generated-creative",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<RecordResult> => {
				const db = getDb(this.env);
				await insertGeneratedCreative(db, {
					creativeId: validation.creativeId,
					brandId: validation.brandId,
					postId: validation.postId,
					prompt: rawPrompt,
					provider: generated.provider,
					model: generated.model,
					r2Key: uploaded.r2Key,
					status: "complete",
					usageEventId: generated.usageEventId,
					metadata: {
						mockImage: generated.mockImage,
						failureReason: generated.failureReason,
						promptInjectionRisk: sanitised.risk,
						promptInjectionFlags: sanitised.flags,
						byteSize: uploaded.byteSize,
						workflowInstanceId: event.instanceId,
					},
				});
				await dbRun(
					db,
					`INSERT OR REPLACE INTO workflow_runs (
						id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
						input_json, output_json
					) VALUES (?, ?, ?, ?, 'ImageGenerationWorkflow', 'complete', 100, ?, ?)`,
					[
						validation.workflowRunId,
						event.instanceId,
						validation.brandId,
						validation.workspaceId,
						toJson({
							brandId: validation.brandId,
							postId: validation.postId,
							category,
							requestedBy: requestedBy ?? null,
						}),
						toJson({
							creativeId: validation.creativeId,
							r2Key: uploaded.r2Key,
							provider: generated.provider,
							model: generated.model,
							mockImage: generated.mockImage,
						}),
					],
				);
				return {
					creativeId: validation.creativeId,
					workflowRunId: validation.workflowRunId,
					status: "complete",
				};
			},
		);

		return {
			workflow: "ImageGenerationWorkflow",
			status: recorded.status,
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			creativeId: recorded.creativeId,
			workflowRunId: recorded.workflowRunId,
			r2Key: uploaded.r2Key,
			provider: generated.provider,
			model: generated.model,
			mockImage: generated.mockImage,
		};
	}
}

async function getWorkflowPost(
	db: D1Database,
	brandId: string,
	postId: string,
): Promise<ContentPostRow | null> {
	return dbFirst<ContentPostRow>(
		db,
		`SELECT id, brand_id, platform, status, caption, scheduled_at, risk_level,
			hashtags_json, why_json, evidence_json
		FROM content_posts
		WHERE id = ? AND brand_id = ?
		LIMIT 1`,
		[postId, brandId],
	);
}

function toGeneratedImageStepResult(image: ImageModelResponse): GeneratedImageStepResult {
	return {
		provider: image.provider,
		model: image.model,
		imageBase64: image.imageBase64,
		contentType: image.contentType,
		usageEventId: image.usageEventId ?? null,
		failureReason: image.failureReason ?? null,
		mockImage: image.mockImage,
	};
}
