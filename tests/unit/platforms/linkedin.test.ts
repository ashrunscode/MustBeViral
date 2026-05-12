import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { linkedInAdapter, verifyLinkedInWebhookSignature } from "../../../src/server/services/platforms/linkedin";
import {
	buildLinkedInAuthorizeUrl,
	DEFAULT_LINKEDIN_SCOPES,
} from "../../../src/server/services/platforms/linkedin-oauth";
import { _clearAdaptersForTest, getAdapter, registerAdapter } from "../../../src/server/services/platforms/registry";
import type {
	AccessToken,
	PlatformEnv,
	PlatformPublishInput,
	PlatformReplyInput,
} from "../../../src/server/services/platforms/types";

// Per-test stubbed fetch. We use vi.stubGlobal so the override is installed
// fresh per test and restored after — avoids the issues with spyOn that miss
// module-level fetch references.
type FetchMock = ReturnType<typeof vi.fn>;
let fetchSpy: FetchMock;

beforeEach(() => {
	fetchSpy = vi.fn();
	vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function getMockCall(index: number): [unknown, unknown] {
	const calls = fetchSpy.mock.calls as unknown as Array<[unknown, unknown]>;
	const call = calls[index];
	expect(call).toBeDefined();
	return call!;
}

function sampleToken(overrides: Partial<AccessToken> = {}): AccessToken {
	return {
		accessToken: "AQX-test-access-token",
		refreshToken: "AQX-test-refresh-token",
		tokenType: "Bearer",
		expiresAt: new Date(Date.now() + 3600_000).toISOString(),
		scopes: ["w_member_social", "openid", "profile"],
		externalAccountId: "abc123",
		socialAccountTokenId: "sat_test",
		platformMetadata: { member_urn: "urn:li:person:abc123" },
		...overrides,
	};
}

function publishInput(overrides: Partial<PlatformPublishInput> = {}): PlatformPublishInput {
	return {
		brandId: "brand_test",
		workspaceId: "ws_test",
		postId: "post_test",
		caption: "Hello LinkedIn from MustBeViral test",
		mediaR2Keys: [],
		scheduledAt: new Date().toISOString(),
		approvedBy: "user_test",
		...overrides,
	};
}

function replyInput(overrides: Partial<PlatformReplyInput> = {}): PlatformReplyInput {
	return {
		brandId: "brand_test",
		workspaceId: "ws_test",
		inboundEventId: "dme_test",
		externalCommentId: "urn:li:comment:(activity:1234567890,5555)",
		replyBody: "Thanks for your comment!",
		approvedBy: "user_test",
		...overrides,
	};
}

function stringifyUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	if (input instanceof Request) return input.url;
	return String(input);
}

function stringifyBody(init: RequestInit | undefined): string {
	if (!init || init.body == null) return "";
	const body = init.body;
	if (typeof body === "string") return body;
	if (body instanceof URLSearchParams) return body.toString();
	return "";
}

describe("buildLinkedInAuthorizeUrl", () => {
	it("constructs an /oauth/v2/authorization URL with required params", () => {
		const url = buildLinkedInAuthorizeUrl({
			state: "test-state-token",
			clientId: "client_id_123",
			redirectUri: "https://mustbeviral.com/api/oauth/linkedin/callback",
		});
		expect(url).toContain("https://www.linkedin.com/oauth/v2/authorization?");
		expect(url).toContain("response_type=code");
		expect(url).toContain("client_id=client_id_123");
		expect(url).toContain("state=test-state-token");
		expect(url).toContain(
			"redirect_uri=https%3A%2F%2Fmustbeviral.com%2Fapi%2Foauth%2Flinkedin%2Fcallback",
		);
		for (const scope of DEFAULT_LINKEDIN_SCOPES) {
			expect(decodeURIComponent(url)).toContain(scope);
		}
	});

	it("honours a custom scope list", () => {
		const url = buildLinkedInAuthorizeUrl({
			state: "s",
			clientId: "c",
			redirectUri: "https://example.com/cb",
			scopes: ["openid", "profile"],
		});
		// URLSearchParams encodes a space-separated scope as `+`; assert on the
		// raw query rather than the decoded form so the test isn't fooled by
		// `decodeURIComponent` leaving `+` as `+`.
		expect(url).toContain("scope=openid+profile");
	});
});

describe("verifyLinkedInWebhookSignature", () => {
	it("returns true for a valid hex HMAC-SHA-256", async () => {
		const secret = "test-webhook-secret";
		const body = '{"events":[{"eventUrn":"urn:li:event:1"}]}';
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
		const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
		expect(await verifyLinkedInWebhookSignature(body, sigHex, secret)).toBe(true);
	});

	it("returns true for a valid base64 HMAC (tolerated)", async () => {
		const secret = "test-webhook-secret";
		const body = '{"events":[{"eventUrn":"urn:li:event:1"}]}';
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
		const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
		expect(await verifyLinkedInWebhookSignature(body, sigB64, secret)).toBe(true);
	});

	it("returns false for a tampered signature", async () => {
		const secret = "test-webhook-secret";
		const body = '{"events":[]}';
		expect(
			await verifyLinkedInWebhookSignature(body, "deadbeefdeadbeefdeadbeefdeadbeef", secret),
		).toBe(false);
	});

	it("returns false when the signature header is null", async () => {
		expect(await verifyLinkedInWebhookSignature("body", null, "secret")).toBe(false);
	});

	it("returns false when the body was tampered with after signing", async () => {
		const secret = "test-webhook-secret";
		const body = '{"events":[{"eventUrn":"urn:li:event:1"}]}';
		const tamperedBody = '{"events":[{"eventUrn":"urn:li:event:HACKED"}]}';
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
		const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
		expect(await verifyLinkedInWebhookSignature(tamperedBody, sigHex, secret)).toBe(false);
	});
});

describe("linkedInAdapter.publish", () => {
	it("returns published + externalPostId on 201", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(null, {
				status: 201,
				headers: { "x-restli-id": "urn:li:share:7234567890" },
			}),
		);
		const result = await linkedInAdapter.publish(publishInput(), sampleToken());
		expect(result.platform).toBe("linkedin");
		expect(result.status).toBe("published");
		expect(result.externalPostId).toBe("urn:li:share:7234567890");
		expect(result.externalUrl).toContain("linkedin.com/feed/update");
		expect(fetchSpy).toHaveBeenCalledOnce();
		const [requestUrl, init] = getMockCall(0);
		expect(stringifyUrl(requestUrl)).toBe("https://api.linkedin.com/rest/posts");
		expect((init as RequestInit).method).toBe("POST");
		const headers = (init as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer AQX-test-access-token");
		expect(headers["LinkedIn-Version"]).toBeDefined();
		expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
	});

	it("returns failed + rate_limited on 429 with retryAfter populated", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("rate limited", {
				status: 429,
				headers: { "retry-after": "30" },
			}),
		);
		const result = await linkedInAdapter.publish(publishInput(), sampleToken());
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("rate_limited");
		expect(result.rateLimitReset).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	it("returns failed + token_expired on 401", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response('{"message":"unauthorized"}', { status: 401 }),
		);
		const result = await linkedInAdapter.publish(publishInput(), sampleToken());
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("token_expired");
	});

	it("returns failed + scope_missing on 403", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response('{"message":"forbidden"}', { status: 403 }),
		);
		const result = await linkedInAdapter.publish(publishInput(), sampleToken());
		expect(result.errorCode).toBe("scope_missing");
	});

	it("returns failed + http_<status> on unexpected error", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response('{"message":"internal"}', { status: 500 }),
		);
		const result = await linkedInAdapter.publish(publishInput(), sampleToken());
		expect(result.errorCode).toBe("http_500");
		expect(result.status).toBe("failed");
	});

	it("uses organization URN when token metadata has preferred_author_urn", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:1" } }),
		);
		const token = sampleToken({
			platformMetadata: { preferred_author_urn: "urn:li:organization:99999" },
		});
		await linkedInAdapter.publish(publishInput(), token);
		const [, init] = getMockCall(0);
		const bodyText = stringifyBody(init as RequestInit);
		const body = JSON.parse(bodyText) as Record<string, unknown>;
		expect(body.author).toBe("urn:li:organization:99999");
	});

	it("falls back to memberUrn when no preferred or organisation is set", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:2" } }),
		);
		const token = sampleToken({
			platformMetadata: { member_urn: "urn:li:person:abc123" },
		});
		await linkedInAdapter.publish(publishInput(), token);
		const [, init] = getMockCall(0);
		const bodyText = stringifyBody(init as RequestInit);
		const body = JSON.parse(bodyText) as Record<string, unknown>;
		expect(body.author).toBe("urn:li:person:abc123");
	});
});

describe("linkedInAdapter.reply", () => {
	it("returns sent on 201", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "urn:li:comment:reply:42" }), {
				status: 201,
				headers: { "content-type": "application/json" },
			}),
		);
		const result = await linkedInAdapter.reply(replyInput(), sampleToken());
		expect(result.status).toBe("sent");
		expect(result.externalReplyId).toBe("urn:li:comment:reply:42");
		const [requestUrl] = getMockCall(0);
		const url = stringifyUrl(requestUrl);
		expect(url).toContain("/rest/socialActions/");
		expect(url).toContain("/comments");
	});

	it("returns failed + rate_limited on 429", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(null, { status: 429, headers: { "retry-after": "10" } }),
		);
		const result = await linkedInAdapter.reply(replyInput(), sampleToken());
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("rate_limited");
	});
});

describe("linkedInAdapter.ingestInbound", () => {
	it("returns invalid_signature when LINKEDIN_WEBHOOK_SECRET is missing", async () => {
		const env: PlatformEnv = {};
		const result = await linkedInAdapter.ingestInbound!(
			{ events: [{ eventUrn: "urn:li:event:1" }] },
			"any-sig",
			env,
		);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("invalid_signature");
		expect(result.events).toEqual([]);
	});

	it("returns ok with normalised events when secret + signature + payload all valid", async () => {
		const env = { LINKEDIN_WEBHOOK_SECRET: "some-secret" } as unknown as PlatformEnv;
		const payload = {
			events: [
				{
					eventUrn: "urn:li:comment:(activity:7,1)",
					actor: "urn:li:person:def",
					object: "urn:li:share:9876",
					message: { text: "Great post!" },
				},
			],
		};
		const result = await linkedInAdapter.ingestInbound!(payload, "any-sig-route-already-verified", env);
		expect(result.ok).toBe(true);
		expect(result.events).toHaveLength(1);
		expect(result.events[0]?.externalCommentId).toBe("urn:li:comment:(activity:7,1)");
		expect(result.events[0]?.authorExternalId).toBe("urn:li:person:def");
		expect(result.events[0]?.externalPostId).toBe("urn:li:share:9876");
		expect(result.events[0]?.body).toBe("Great post!");
	});

	it("returns malformed_payload when payload isn't an object", async () => {
		const env = { LINKEDIN_WEBHOOK_SECRET: "x" } as unknown as PlatformEnv;
		const result = await linkedInAdapter.ingestInbound!("not-an-object", "sig", env);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("malformed_payload");
	});
});

describe("registry registration", () => {
	it("linkedInAdapter is registered under id 'linkedin' (importing linkedin.ts side-effects)", () => {
		const looked = getAdapter("linkedin");
		expect(looked).not.toBeNull();
		expect(looked?.id).toBe("linkedin");
	});

	it("returns null for unknown platform", () => {
		const looked = getAdapter("x");
		expect(looked).toBeNull();
	});

	it("re-register replaces the previous adapter (test isolation helper)", () => {
		_clearAdaptersForTest();
		expect(getAdapter("linkedin")).toBeNull();
		registerAdapter(linkedInAdapter);
		expect(getAdapter("linkedin")).not.toBeNull();
	});
});
