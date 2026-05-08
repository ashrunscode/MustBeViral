import type { Env } from "../env";
import { dbRun, toJson } from "../db/sql";
import { createId } from "../utils/id";

export type ModelCategory =
	| "cheap_text"
	| "premium_text"
	| "compliance_review"
	| "image_fast"
	| "image_default"
	| "image_premium";

export interface ModelRequest {
	workspaceId?: string | null;
	brandId?: string | null;
	category: ModelCategory;
	prompt: string;
}

export interface ModelResponse {
	provider: "mock" | "workers_ai" | "external";
	model: string;
	text: string;
	usageEventId?: string;
}

export class ModelRouter {
	constructor(
		private readonly env: Env,
		private readonly db?: D1Database,
	) {}

	async generateText(request: ModelRequest): Promise<ModelResponse> {
		const provider: ModelResponse["provider"] = this.env.USE_MOCK_AI === "true" ? "mock" : "workers_ai";
		const model = this.selectModel(request.category);
		const text =
			provider === "mock"
				? `Mock ${request.category} output for: ${request.prompt.slice(0, 120)}`
				: `Configured ${provider} call placeholder for ${model}.`;
		const usageEventId = await this.logUsage(request, provider, model);

		const response: ModelResponse = { provider, model, text };
		if (usageEventId) {
			response.usageEventId = usageEventId;
		}
		return response;
	}

	private selectModel(category: ModelCategory): string {
		if (category === "image_fast") {
			return this.env.FAST_IMAGE_MODEL;
		}
		if (category === "image_premium") {
			return this.env.PREMIUM_IMAGE_MODEL;
		}
		if (category === "image_default") {
			return this.env.DEFAULT_IMAGE_MODEL;
		}
		return this.env.DEFAULT_TEXT_MODEL;
	}

	private async logUsage(
		request: ModelRequest,
		provider: ModelResponse["provider"],
		model: string,
	): Promise<string | undefined> {
		if (!this.db) {
			return undefined;
		}

		const usageEventId = createId("usage");
		await dbRun(
			this.db,
			`INSERT INTO usage_events (
				id, workspace_id, brand_id, event_type, provider, model, quantity, cost_estimate_cents, metadata_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				usageEventId,
				request.workspaceId ?? null,
				request.brandId ?? null,
				request.category,
				provider,
				model,
				1,
				provider === "mock" ? 0 : 2,
				toJson({ promptChars: request.prompt.length }),
			],
		);
		return usageEventId;
	}
}
