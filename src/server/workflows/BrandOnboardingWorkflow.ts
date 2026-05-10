import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import type { Env } from "../env";
import { createMockOnboardingArtifacts, getBrand } from "../services/brand-operations";
import { type BrandWorkflowInput } from "./base";

interface OnboardingArtifactIds {
	scanId: string | null;
	scoreId: string | null;
	profileId: string | null;
	targetId: string | null;
	workflowRunId: string | null;
	idempotent: boolean;
}

/**
 * Real Cloudflare Workflow for brand onboarding. The body delegates to
 * `createMockOnboardingArtifacts` (mock-safe Phase 1 generator) but runs
 * inside `step.do` with retry config, so the Workers runtime persists
 * progress and retries on transient failure. Route handlers can invoke
 * `env.BRAND_ONBOARDING_WORKFLOW.create({...})` for true async fan-out
 * (audit gap C-2).
 *
 * step.do callbacks return JSON-narrow objects (string IDs only) to satisfy
 * Cloudflare's `Serializable<T>` constraint without a type cast.
 */
export class BrandOnboardingWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, requestedBy } = event.payload;
		if (!brandId) {
			return {
				workflow: "BrandOnboardingWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}

		await step.do(
			"validate-brand",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async () => {
				const db = getDb(this.env);
				const row = await getBrand(db, brandId);
				if (!row) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				return { ok: true };
			},
		);

		const ids: OnboardingArtifactIds = await step.do(
			"create-onboarding-artifacts",
			{ retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
			async (): Promise<OnboardingArtifactIds> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				const out = await createMockOnboardingArtifacts(db, {
					brand,
					...(requestedBy ? { requestedBy } : {}),
				});
				return {
					scanId: stringOrNull(out.scanId),
					scoreId: stringOrNull(out.scoreId),
					profileId: stringOrNull(out.profileId),
					targetId: stringOrNull(out.targetId),
					workflowRunId: stringOrNull(out.workflowRunId),
					idempotent: out.idempotent === true,
				};
			},
		);

		return {
			workflow: "BrandOnboardingWorkflow",
			status: "complete",
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			scanId: ids.scanId,
			scoreId: ids.scoreId,
			profileId: ids.profileId,
			targetId: ids.targetId,
			workflowRunId: ids.workflowRunId,
			idempotent: ids.idempotent,
		};
	}
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}
