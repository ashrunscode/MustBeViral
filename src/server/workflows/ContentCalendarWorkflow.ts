import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import type { Env } from "../env";
import { generateMockContentCalendar, getBrand } from "../services/brand-operations";
import { type BrandWorkflowInput } from "./base";

interface CalendarRunIds {
	calendarId: string | null;
	campaignId: string | null;
	postCount: number;
	workflowRunId: string | null;
}

export class ContentCalendarWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, requestedBy } = event.payload;
		if (!brandId) {
			return {
				workflow: "ContentCalendarWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}

		const ids: CalendarRunIds = await step.do(
			"generate-calendar",
			{ retries: { limit: 2, delay: "15 seconds", backoff: "exponential" } },
			async (): Promise<CalendarRunIds> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					throw new Error(`brand_not_found:${brandId}`);
				}
				const out = await generateMockContentCalendar(db, {
					brand,
					...(requestedBy ? { requestedBy } : {}),
				});
				return {
					calendarId: stringOrNull(out.calendarId),
					campaignId: stringOrNull(out.campaignId),
					postCount: typeof out.postCount === "number" ? out.postCount : 0,
					workflowRunId: stringOrNull(out.workflowRunId),
				};
			},
		);

		return {
			workflow: "ContentCalendarWorkflow",
			status: "complete",
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			calendarId: ids.calendarId,
			campaignId: ids.campaignId,
			postCount: ids.postCount,
			workflowRunId: ids.workflowRunId,
		};
	}
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}
