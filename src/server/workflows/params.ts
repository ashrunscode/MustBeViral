export interface BrandWorkflowInput {
	brandId?: string;
	workspaceId?: string;
	requestedBy?: string;
}

export function buildBrandWorkflowParams(input: {
	brandId: string;
	workspaceId?: string | null | undefined;
	requestedBy?: string | null | undefined;
}): BrandWorkflowInput {
	const params: BrandWorkflowInput = { brandId: input.brandId };
	if (input.workspaceId) {
		params.workspaceId = input.workspaceId;
	}
	if (input.requestedBy) {
		params.requestedBy = input.requestedBy;
	}
	return params;
}
