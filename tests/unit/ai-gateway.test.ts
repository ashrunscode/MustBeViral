import { describe, expect, it } from "vitest";

import {
	buildAiGatewayChatPayload,
	buildAiGatewayHeaders,
	parseAiGatewayChatResponse,
	resolveAiGatewayTextRoute,
} from "../../src/server/services/model-router-gateway";

describe("AI Gateway routing helpers", () => {
	it("routes Kimi models through Moonshot provider-native AI Gateway with both auth headers", () => {
		const route = resolveAiGatewayTextRoute("kimi-2.6", {
			accountId: "acct_123",
			gatewayId: "mustbeviral",
			aiGatewayToken: "cf-token",
			kimiApiKey: "kimi-key",
		});

		expect(route.ok).toBe(true);
		if (!route.ok) {
			throw new Error(route.failureReason);
		}
		expect(route.route.endpoint).toBe(
			"https://gateway.ai.cloudflare.com/v1/acct_123/mustbeviral/moonshot-ai/chat/completions",
		);
		expect(route.route.provider).toBe("moonshot-ai");
		expect(route.route.mode).toBe("provider_native");

		const headers = buildAiGatewayHeaders(route.route);
		expect(headers.get("Authorization")).toBe("Bearer kimi-key");
		expect(headers.get("cf-aig-authorization")).toBe("Bearer cf-token");

		const payload = buildAiGatewayChatPayload(route.route, "system", "user");
		expect(payload.model).toBe("kimi-2.6");
		expect(payload.messages).toEqual([
			{ role: "system", content: "system" },
			{ role: "user", content: "user" },
		]);
	});

	it("falls closed to mock-safe failure reasons when Kimi Gateway config is missing", () => {
		expect(
			resolveAiGatewayTextRoute("kimi-2.6", {
				kimiApiKey: "kimi-key",
			}),
		).toEqual({ ok: false, failureReason: "ai_gateway_account_unconfigured" });

		expect(
			resolveAiGatewayTextRoute("kimi-2.6", {
				accountId: "acct_123",
				gatewayId: "mustbeviral",
			}),
		).toEqual({ ok: false, failureReason: "kimi_api_key_unconfigured" });
	});

	it("parses OpenAI-compatible AI Gateway chat responses and token usage", () => {
		const parsed = parseAiGatewayChatResponse({
			choices: [{ message: { content: "Campaign ready" } }],
			usage: { prompt_tokens: 12, completion_tokens: 3 },
		});

		expect(parsed).toEqual({
			text: "Campaign ready",
			tokensIn: 12,
			tokensOut: 3,
		});
	});
});
