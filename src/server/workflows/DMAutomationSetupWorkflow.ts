import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Env } from "../env";
import { type BrandWorkflowInput, runWorkflowStub } from "./base";

export class DMAutomationSetupWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		return runWorkflowStub("DMAutomationSetupWorkflow", event, step);
	}
}
