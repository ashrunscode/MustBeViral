import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import type { Env } from "../env";
import { generateGrowthOpportunities, getBrand } from "../services/brand-operations";
import { type BrandWorkflowInput } from "./base";

interface GrowthRunResult {
	opportunityIds: ReadonlyArray<string>;
}

export class GrowthOpportunityWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, requestedBy } = event.payload;
		if (!brandId) {
			return {
				workflow: "GrowthOpportunityWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}

		const result: GrowthRunResult = await step.do(
			"identify-growth-opportunities",
			{ retries: { limit: 2, delay: "10 seconds", backoff: "exponential" } },
			async (): Promise<GrowthRunResult> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				const out = await generateGrowthOpportunities(db, {
					brand,
					...(requestedBy ? { requestedBy } : {}),
				});
				const ids = Array.isArray(out.opportunityIds)
					? (out.opportunityIds as ReadonlyArray<unknown>).filter(
							(v): v is string => typeof v === "string" && v.length > 0,
						)
					: [];
				return { opportunityIds: ids };
			},
		);

		return {
			workflow: "GrowthOpportunityWorkflow",
			status: "complete",
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			opportunityIds: result.opportunityIds,
		};
	}
}
