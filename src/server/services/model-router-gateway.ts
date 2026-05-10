export type AiGatewayMode = "provider_native" | "compat";
export type AiGatewayProvider = "moonshot-ai" | "openai" | "anthropic";

export interface AiGatewayConfig {
	accountId?: string | undefined;
	gatewayId?: string | undefined;
	aiGatewayToken?: string | undefined;
	kimiApiKey?: string | undefined;
	openaiApiKey?: string | undefined;
	anthropicApiKey?: string | undefined;
}

export interface AiGatewayRoute {
	endpoint: string;
	mode: AiGatewayMode;
	provider: AiGatewayProvider;
	providerApiKey: string;
	gatewayToken?: string | undefined;
	outboundModel: string;
}

export type AiGatewayRouteResult =
	| { ok: true; route: AiGatewayRoute }
	| { ok: false; failureReason: string };

export interface AiGatewayChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface AiGatewayChatPayload {
	model: string;
	messages: AiGatewayChatMessage[];
	temperature: number;
	max_tokens: number;
}

export interface ParsedAiGatewayResponse {
	text: string;
	tokensIn?: number | undefined;
	tokensOut?: number | undefined;
}

const DEFAULT_GATEWAY_ID = "default";

export function resolveAiGatewayTextRoute(
	model: string,
	config: AiGatewayConfig,
): AiGatewayRouteResult {
	const accountId = clean(config.accountId);
	if (!accountId) {
		return { ok: false, failureReason: "ai_gateway_account_unconfigured" };
	}
	const gatewayId = clean(config.gatewayId) ?? DEFAULT_GATEWAY_ID;
	const gatewayToken = clean(config.aiGatewayToken);

	if (isKimiModel(model)) {
		const providerApiKey = clean(config.kimiApiKey);
		if (!providerApiKey) {
			return { ok: false, failureReason: "kimi_api_key_unconfigured" };
		}
		return {
			ok: true,
			route: {
				endpoint: providerNativeEndpoint(accountId, gatewayId, "moonshot-ai"),
				mode: "provider_native",
				provider: "moonshot-ai",
				providerApiKey,
				gatewayToken,
				outboundModel: model,
			},
		};
	}

	const openAiModel = toOpenAiModel(model);
	if (openAiModel) {
		const providerApiKey = clean(config.openaiApiKey);
		if (!providerApiKey) {
			return { ok: false, failureReason: "openai_api_key_unconfigured" };
		}
		return {
			ok: true,
			route: {
				endpoint: compatEndpoint(accountId, gatewayId),
				mode: "compat",
				provider: "openai",
				providerApiKey,
				gatewayToken,
				outboundModel: openAiModel,
			},
		};
	}

	const anthropicModel = toAnthropicModel(model);
	if (anthropicModel) {
		const providerApiKey = clean(config.anthropicApiKey);
		if (!providerApiKey) {
			return { ok: false, failureReason: "anthropic_api_key_unconfigured" };
		}
		return {
			ok: true,
			route: {
				endpoint: compatEndpoint(accountId, gatewayId),
				mode: "compat",
				provider: "anthropic",
				providerApiKey,
				gatewayToken,
				outboundModel: anthropicModel,
			},
		};
	}

	return { ok: false, failureReason: "external_provider_unconfigured" };
}

export function buildAiGatewayHeaders(route: AiGatewayRoute): Headers {
	const headers = new Headers({
		Authorization: `Bearer ${route.providerApiKey}`,
		"Content-Type": "application/json",
	});
	if (route.gatewayToken) {
		headers.set("cf-aig-authorization", `Bearer ${route.gatewayToken}`);
	}
	return headers;
}

export function buildAiGatewayChatPayload(
	route: AiGatewayRoute,
	systemPrompt: string,
	userPrompt: string,
): AiGatewayChatPayload {
	return {
		model: route.outboundModel,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature: 0.4,
		max_tokens: 1200,
	};
}

export function parseAiGatewayChatResponse(payload: unknown): ParsedAiGatewayResponse {
	const record = asRecord(payload);
	const choices = Array.isArray(record.choices) ? record.choices : [];
	const first = asRecord(choices[0]);
	const message = asRecord(first.message);
	const content = extractContent(message.content);
	const usage = asRecord(record.usage);
	const tokensIn = toNumber(usage.prompt_tokens);
	const tokensOut = toNumber(usage.completion_tokens);
	if (!content) {
		throw new Error("ai_gateway_empty_response");
	}
	const parsed: ParsedAiGatewayResponse = { text: content };
	if (tokensIn !== undefined) {
		parsed.tokensIn = tokensIn;
	}
	if (tokensOut !== undefined) {
		parsed.tokensOut = tokensOut;
	}
	return parsed;
}

function providerNativeEndpoint(
	accountId: string,
	gatewayId: string,
	provider: AiGatewayProvider,
): string {
	return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(
		gatewayId,
	)}/${provider}/chat/completions`;
}

function compatEndpoint(accountId: string, gatewayId: string): string {
	return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(
		gatewayId,
	)}/compat/chat/completions`;
}

function isKimiModel(model: string): boolean {
	const lower = model.toLowerCase();
	return lower.startsWith("kimi-") || lower.startsWith("moonshot/");
}

function toOpenAiModel(model: string): string | null {
	if (model.startsWith("openai/")) {
		return model;
	}
	if (/^(gpt-|o[134]-|chatgpt-)/u.test(model)) {
		return `openai/${model}`;
	}
	return null;
}

function toAnthropicModel(model: string): string | null {
	if (model.startsWith("anthropic/")) {
		return model;
	}
	if (model.startsWith("claude-")) {
		return `anthropic/${model}`;
	}
	return null;
}

function extractContent(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (!Array.isArray(value)) {
		return "";
	}
	const parts = value
		.map((part) => {
			const record = asRecord(part);
			return typeof record.text === "string" ? record.text : "";
		})
		.filter((part) => part.length > 0);
	return parts.join("\n");
}

function clean(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
