import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

export interface BrandWorkflowInput {
	brandId?: string;
	workspaceId?: string;
	requestedBy?: string;
}

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
