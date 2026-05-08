import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Env } from "../env";
import { type BrandWorkflowInput, runWorkflowStub } from "./base";

export class ImageGenerationWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
	override async run(
		event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		return runWorkflowStub("ImageGenerationWorkflow", event, step);
	}
}
