import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pollXMentions, xAdapter } from "../../../src/server/services/platforms/x";
import type { AccessToken } from "../../../src/server/services/platforms/types";

const baseToken: AccessToken = {
	accessToken: "AAAA",
	tokenType: "Bearer",
	scopes: ["tweet.read", "tweet.write", "users.read"],
	externalAccountId: "999",
	socialAccountTokenId: "sat_test",
	platformMetadata: { username: "founder" },
};

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("xAdapter.publish", () => {
	it("posts to /2/tweets with the caption and returns published + externalUrl", async () => {
		let capturedBody: unknown;
		const fetchSpy = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				capturedBody = init?.body ? JSON.parse(init.body as string) : null;
				return Promise.resolve(
					new Response(JSON.stringify({ data: { id: "1234567890", text: "Hello" } }), {
						status: 201,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await xAdapter.publish(
			{
				brandId: "brand_a",
				workspaceId: "ws_a",
				postId: "post_a",
				caption: "Hello",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "user_a",
			},
			baseToken,
		);
		expect(result.platform).toBe("x");
		expect(result.status).toBe("published");
		expect(result.externalPostId).toBe("1234567890");
		expect(result.externalUrl).toBe("https://x.com/founder/status/1234567890");
		expect(capturedBody).toEqual({ text: "Hello" });
	});

	it("returns rate_limited on 429 with parsed reset", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(JSON.stringify({ error: "Too Many Requests" }), {
						status: 429,
						headers: {
							"content-type": "application/json",
							"x-rate-limit-reset": "1799999999",
						},
					}),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await xAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hi",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("rate_limited");
		expect(result.rateLimitReset).toBe(1799999999);
	});

	it("returns token_expired on 401", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await xAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hi",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("token_expired");
	});

	it("returns network_error when fetch throws", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("network down"))),
		);
		const result = await xAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hi",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("network_error");
		expect(result.errorMessage).toContain("network down");
	});
});

describe("xAdapter.reply", () => {
	it("posts to /2/tweets with reply.in_reply_to_tweet_id and returns sent + externalReplyId", async () => {
		let capturedBody: unknown;
		const fetchSpy = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				capturedBody = init?.body ? JSON.parse(init.body as string) : null;
				return Promise.resolve(
					new Response(JSON.stringify({ data: { id: "9876543210", text: "Thanks!" } }), {
						status: 201,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await xAdapter.reply(
			{
				brandId: "b",
				workspaceId: "w",
				inboundEventId: "dme_1",
				externalCommentId: "5555",
				replyBody: "Thanks!",
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.platform).toBe("x");
		expect(result.status).toBe("sent");
		expect(result.externalReplyId).toBe("9876543210");
		expect(capturedBody).toEqual({
			text: "Thanks!",
			reply: { in_reply_to_tweet_id: "5555" },
		});
	});
});

describe("xAdapter.ingestInbound", () => {
	it("always returns unsupported (X v2 Free/Basic has no webhooks)", async () => {
		const result = await xAdapter.ingestInbound!({}, null, {});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("ignored");
		expect(result.events).toHaveLength(0);
	});
});

describe("pollXMentions", () => {
	it("returns normalised events + newest_id cursor on happy path", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: [
								{
									id: "m_1",
									text: "Hey @founder",
									author_id: "u_42",
									referenced_tweets: [{ type: "replied_to", id: "tweet_orig" }],
								},
								{
									id: "m_2",
									text: "Loved the post",
									author_id: "u_99",
								},
							],
							includes: {
								users: [
									{ id: "u_42", username: "alice" },
									{ id: "u_99", username: "bob" },
								],
							},
							meta: { newest_id: "m_2" },
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await pollXMentions({
			accountId: "founder_id",
			accessToken: "AAAA",
		});
		expect(result.ok).toBe(true);
		expect(result.events).toHaveLength(2);
		expect(result.events[0]).toMatchObject({
			externalCommentId: "m_1",
			authorExternalId: "u_42",
			authorHandle: "alice",
			body: "Hey @founder",
			referencedTweetId: "tweet_orig",
		});
		expect(result.events[1]).toMatchObject({
			externalCommentId: "m_2",
			authorHandle: "bob",
		});
		expect(result.newestId).toBe("m_2");
	});

	it("passes since_id when provided (cursor advancement)", async () => {
		let capturedUrl = "";
		const fetchSpy = vi.fn(
			(input: RequestInfo | URL): Promise<Response> => {
				capturedUrl =
					typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				return Promise.resolve(
					new Response(JSON.stringify({ data: [], meta: {} }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		await pollXMentions({
			accountId: "user_a",
			accessToken: "AAAA",
			sinceId: "m_99",
		});
		expect(capturedUrl).toContain("since_id=m_99");
	});

	it("returns rate_limited on 429", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> => Promise.resolve(new Response("", { status: 429 })),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await pollXMentions({ accountId: "u", accessToken: "t" });
		expect(result.ok).toBe(false);
		expect(result.errorCode).toBe("rate_limited");
	});

	it("returns token_expired on 401", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> => Promise.resolve(new Response("", { status: 401 })),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await pollXMentions({ accountId: "u", accessToken: "t" });
		expect(result.ok).toBe(false);
		expect(result.errorCode).toBe("token_expired");
	});
});
