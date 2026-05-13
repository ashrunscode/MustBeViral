import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	metaAdapter,
	normaliseMetaPayload,
	verifyMetaWebhookSignature,
} from "../../../src/server/services/platforms/meta";
import type { AccessToken } from "../../../src/server/services/platforms/types";

const fbToken: AccessToken = {
	accessToken: "page_token_111",
	tokenType: "Bearer",
	scopes: ["pages_manage_posts"],
	externalAccountId: "page_111",
	socialAccountTokenId: "sat_fb",
	platformMetadata: { surface: "facebook_page", page_id: "page_111", page_name: "Brand" },
};

const igToken: AccessToken = {
	accessToken: "page_token_111",
	tokenType: "Bearer",
	scopes: ["instagram_content_publish"],
	externalAccountId: "ig_999",
	socialAccountTokenId: "sat_ig",
	platformMetadata: {
		surface: "instagram_business",
		page_id: "page_111",
		instagram_business_account_id: "ig_999",
		image_url: "https://example.com/img.png",
	},
};

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("metaAdapter.publish — Facebook Page", () => {
	it("POSTs to /{page-id}/feed with message + page access token", async () => {
		let capturedUrl = "";
		let capturedBody = "";
		const fetchSpy = vi.fn(
			(input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				capturedUrl =
					typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				capturedBody = (init?.body as string | undefined) ?? "";
				return Promise.resolve(
					new Response(JSON.stringify({ id: "page_111_post_42" }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await metaAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hello FB",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			fbToken,
		);
		expect(result.platform).toBe("meta");
		expect(result.status).toBe("published");
		expect(result.externalPostId).toBe("page_111_post_42");
		expect(capturedUrl).toContain("page_111/feed");
		expect(capturedBody).toContain("message=Hello+FB");
		expect(capturedBody).toContain("access_token=page_token_111");
	});

	it("returns token_expired on 401", async () => {
		const fetchSpy = vi.fn((): Promise<Response> => Promise.resolve(new Response("", { status: 401 })));
		vi.stubGlobal("fetch", fetchSpy);
		const result = await metaAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "x",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			fbToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("token_expired");
	});
});

describe("metaAdapter.publish — Instagram Business", () => {
	it("uses 2-step container API and returns externalPostId from media_publish", async () => {
		const callLog: string[] = [];
		const fetchSpy = vi.fn(
			(input: RequestInfo | URL): Promise<Response> => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				callLog.push(url);
				if (url.endsWith("/media")) {
					return Promise.resolve(
						new Response(JSON.stringify({ id: "container_999" }), {
							status: 200,
							headers: { "content-type": "application/json" },
						}),
					);
				}
				if (url.endsWith("/media_publish")) {
					return Promise.resolve(
						new Response(JSON.stringify({ id: "ig_post_55" }), {
							status: 200,
							headers: { "content-type": "application/json" },
						}),
					);
				}
				return Promise.reject(new Error("unexpected url: " + url));
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await metaAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hello IG",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			igToken,
		);
		expect(result.status).toBe("published");
		expect(result.externalPostId).toBe("ig_post_55");
		expect(result.externalUrl).toBe("https://www.instagram.com/p/ig_post_55");
		expect(callLog[0]).toContain("/ig_999/media");
		expect(callLog[1]).toContain("/ig_999/media_publish");
	});

	it("fails with instagram_missing_image_url when no image_url is provided", async () => {
		const tokenNoImage: AccessToken = {
			...igToken,
			platformMetadata: {
				surface: "instagram_business",
				instagram_business_account_id: "ig_999",
			},
		};
		const result = await metaAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "x",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			tokenNoImage,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("instagram_missing_image_url");
	});
});

describe("metaAdapter.reply", () => {
	it("uses /{comment-id}/comments for FB and /{comment-id}/replies for IG", async () => {
		const calls: string[] = [];
		const fetchSpy = vi.fn(
			(input: RequestInfo | URL): Promise<Response> => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				calls.push(url);
				return Promise.resolve(
					new Response(JSON.stringify({ id: "reply_42" }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		await metaAdapter.reply(
			{
				brandId: "b",
				workspaceId: "w",
				inboundEventId: "dme_1",
				externalCommentId: "fb_comment_1",
				replyBody: "Thanks",
				approvedBy: "u",
			},
			fbToken,
		);
		await metaAdapter.reply(
			{
				brandId: "b",
				workspaceId: "w",
				inboundEventId: "dme_2",
				externalCommentId: "ig_comment_1",
				replyBody: "Cheers",
				approvedBy: "u",
			},
			igToken,
		);
		expect(calls[0]).toContain("/fb_comment_1/comments");
		expect(calls[1]).toContain("/ig_comment_1/replies");
	});
});

describe("normaliseMetaPayload", () => {
	it("extracts page feed comment events", () => {
		const events = normaliseMetaPayload({
			object: "page",
			entry: [
				{
					id: "page_111",
					time: 1_700_000_000,
					changes: [
						{
							field: "feed",
							value: {
								item: "comment",
								comment_id: "fb_c_1",
								post_id: "page_111_post_42",
								parent_id: "page_111_post_42",
								from: { id: "user_xx", name: "Alice" },
								message: "Great post!",
							},
						},
					],
				},
			],
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			externalCommentId: "fb_c_1",
			externalPostId: "page_111_post_42",
			parentExternalCommentId: "page_111_post_42",
			authorExternalId: "user_xx",
			authorHandle: "Alice",
			body: "Great post!",
		});
	});

	it("extracts instagram comment events", () => {
		const events = normaliseMetaPayload({
			object: "instagram",
			entry: [
				{
					id: "ig_999",
					changes: [
						{
							field: "comments",
							value: {
								id: "ig_c_1",
								from: { id: "ig_user", name: "iguser" },
								message: "🔥",
							},
						},
					],
				},
			],
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			externalCommentId: "ig_c_1",
			authorHandle: "iguser",
			body: "🔥",
		});
	});

	it("returns empty array for non-feed/comments fields", () => {
		const events = normaliseMetaPayload({
			object: "page",
			entry: [
				{
					id: "page_111",
					changes: [{ field: "messages", value: { id: "m1" } }],
				},
			],
		});
		expect(events).toHaveLength(0);
	});
});

describe("verifyMetaWebhookSignature", () => {
	async function hmacHex(secret: string, body: string): Promise<string> {
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
		return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
	}

	it("accepts a valid sha256= signature", async () => {
		const body = JSON.stringify({ object: "page", entry: [] });
		const expected = await hmacHex("app_secret", body);
		const ok = await verifyMetaWebhookSignature(body, `sha256=${expected}`, "app_secret");
		expect(ok).toBe(true);
	});

	it("rejects a tampered signature", async () => {
		const body = JSON.stringify({ object: "page", entry: [] });
		const ok = await verifyMetaWebhookSignature(body, "sha256=deadbeef", "app_secret");
		expect(ok).toBe(false);
	});

	it("rejects when header is missing", async () => {
		const ok = await verifyMetaWebhookSignature("{}", null, "app_secret");
		expect(ok).toBe(false);
	});

	it("rejects when format isn't sha256=<hex>", async () => {
		const ok = await verifyMetaWebhookSignature("{}", "sha1=abc", "app_secret");
		expect(ok).toBe(false);
	});
});
