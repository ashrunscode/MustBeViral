import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	normaliseTikTokPayload,
	tiktokAdapter,
	verifyTikTokWebhookSignature,
} from "../../../src/server/services/platforms/tiktok";
import type { AccessToken } from "../../../src/server/services/platforms/types";

const baseToken: AccessToken = {
	accessToken: "TT_ACCESS",
	refreshToken: "TT_REFRESH",
	tokenType: "Bearer",
	scopes: ["user.info.basic", "video.publish"],
	externalAccountId: "open_xyz",
	socialAccountTokenId: "sat_tt",
	platformMetadata: { open_id: "open_xyz", video_url: "https://example.com/video.mp4" },
};

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("tiktokAdapter.publish", () => {
	it("calls /v2/post/publish/inbox/video/init/ with PULL_FROM_URL source and returns publish_id", async () => {
		let capturedBody = "";
		const fetchSpy = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				capturedBody = (init?.body as string | undefined) ?? "";
				return Promise.resolve(
					new Response(
						JSON.stringify({
							data: { publish_id: "pub_42" },
							error: { code: "ok", message: "" },
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await tiktokAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "Hello TikTok",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.platform).toBe("tiktok");
		expect(result.status).toBe("published");
		expect(result.externalPostId).toBe("pub_42");
		expect(capturedBody).toContain("PULL_FROM_URL");
		expect(capturedBody).toContain("https://example.com/video.mp4");
	});

	it("returns tiktok_missing_video_url when no video URL is provided", async () => {
		const tokenNoVideo: AccessToken = {
			...baseToken,
			platformMetadata: { open_id: "open_xyz" },
		};
		const result = await tiktokAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "x",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			tokenNoVideo,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("tiktok_missing_video_url");
	});

	it("treats payload error.code !== 'ok' as failure", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: {},
							error: { code: "post_info.invalid_privacy_level", message: "bad privacy" },
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await tiktokAdapter.publish(
			{
				brandId: "b",
				workspaceId: "w",
				postId: "p",
				caption: "x",
				mediaR2Keys: [],
				scheduledAt: new Date().toISOString(),
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("post_info.invalid_privacy_level");
	});
});

describe("tiktokAdapter.reply", () => {
	it("POSTs to /v2/comment/reply/create/ with video_id + comment_id + text", async () => {
		let capturedBody = "";
		const fetchSpy = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				capturedBody = (init?.body as string | undefined) ?? "";
				return Promise.resolve(
					new Response(
						JSON.stringify({
							data: { reply_comment: { comment_id: "reply_42" } },
							error: { code: "ok", message: "" },
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await tiktokAdapter.reply(
			{
				brandId: "b",
				workspaceId: "w",
				inboundEventId: "dme_1",
				externalCommentId: "c_1",
				replyBody: "Thanks",
				approvedBy: "u",
				platformMetadata: { video_id: "v_99" },
			},
			baseToken,
		);
		expect(result.status).toBe("sent");
		expect(result.externalReplyId).toBe("reply_42");
		expect(capturedBody).toContain('"video_id":"v_99"');
		expect(capturedBody).toContain('"comment_id":"c_1"');
	});

	it("returns tiktok_missing_video_id when video_id is absent", async () => {
		const result = await tiktokAdapter.reply(
			{
				brandId: "b",
				workspaceId: "w",
				inboundEventId: "dme_1",
				externalCommentId: "c_1",
				replyBody: "x",
				approvedBy: "u",
			},
			baseToken,
		);
		expect(result.status).toBe("failed");
		expect(result.errorCode).toBe("tiktok_missing_video_id");
	});
});

describe("normaliseTikTokPayload", () => {
	it("extracts a comment event from a TikTok webhook payload", () => {
		const events = normaliseTikTokPayload({
			event: "comment",
			client_key: "ck",
			user_openid: "open_555",
			create_time: 1_700_000_000,
			content: {
				comment_id: "tt_c_1",
				video_id: "tt_v_99",
				text: "Loved this!",
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			externalCommentId: "tt_c_1",
			externalPostId: "tt_v_99",
			authorExternalId: "open_555",
			body: "Loved this!",
		});
	});

	it("returns empty when event field is not 'comment'", () => {
		const events = normaliseTikTokPayload({ event: "user.update", content: {} });
		expect(events).toHaveLength(0);
	});
});

describe("verifyTikTokWebhookSignature", () => {
	async function hmacHex(secret: string, message: string): Promise<string> {
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
		return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
	}

	it("accepts a valid timestamp + body signature", async () => {
		const timestamp = "1700000000";
		const body = JSON.stringify({ event: "comment" });
		const expected = await hmacHex("client_secret", `${timestamp}\n${body}`);
		const ok = await verifyTikTokWebhookSignature(timestamp, body, expected, "client_secret");
		expect(ok).toBe(true);
	});

	it("rejects a tampered signature", async () => {
		const ok = await verifyTikTokWebhookSignature("1700000000", "{}", "deadbeef", "client_secret");
		expect(ok).toBe(false);
	});

	it("rejects missing signature header", async () => {
		const ok = await verifyTikTokWebhookSignature("1700000000", "{}", null, "client_secret");
		expect(ok).toBe(false);
	});
});
