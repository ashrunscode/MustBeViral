import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import type { BrandWorkflowInput } from "./params";

export type { BrandWorkflowInput } from "./params";

export interface WorkflowStubResult {
	workflow: string;
	status: "stubbed";
	instanceId: string;
	receivedAt: string;
	payload: BrandWorkflowInput;
}

export async function runWorkflowStub(
	workflow: string,
	event: Readonly<WorkflowEvent<BrandWorkflowInput>>,
	step: WorkflowStep,
): Promise<WorkflowStubResult> {
	return step.do(`${workflow}:stub`, () =>
		Promise.resolve({
			workflow,
			status: "stubbed",
			instanceId: event.instanceId,
			receivedAt: event.timestamp.toISOString(),
			payload: event.payload,
		}),
	);
}
