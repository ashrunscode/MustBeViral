import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import type { Env } from "../env";
import { generateWeeklyReport, getBrand } from "../services/brand-operations";
import { type BrandWorkflowInput } from "./base";

interface WeeklyReportIds {
	reportId: string | null;
	workflowRunId: string | null;
}

export class WeeklyReportWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, requestedBy } = event.payload;
		if (!brandId) {
			return {
				workflow: "WeeklyReportWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}

		const ids: WeeklyReportIds = await step.do(
			"compose-weekly-report",
			{ retries: { limit: 2, delay: "10 seconds", backoff: "exponential" } },
			async (): Promise<WeeklyReportIds> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				const out = await generateWeeklyReport(db, {
					brand,
					...(requestedBy ? { requestedBy } : {}),
				});
				return {
					reportId: stringOrNull(out.reportId),
					workflowRunId: stringOrNull(out.workflowRunId),
				};
			},
		);

		return {
			workflow: "WeeklyReportWorkflow",
			status: "complete",
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			reportId: ids.reportId,
			workflowRunId: ids.workflowRunId,
		};
	}
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}
