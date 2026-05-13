import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildTikTokAuthorizeUrl,
	exchangeTikTokCode,
	resolveTikTokUserInfo,
	TIKTOK_OAUTH_CONSTANTS,
} from "../../../src/server/services/platforms/tiktok-oauth";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("buildTikTokAuthorizeUrl", () => {
	it("uses client_key (not client_id), comma-joined scopes, response_type=code", () => {
		const url = buildTikTokAuthorizeUrl({
			state: "signed_state",
			clientKey: "ttkey_42",
			redirectUri: "https://example.com/cb",
		});
		expect(url).toContain(TIKTOK_OAUTH_CONSTANTS.AUTHORIZE_URL);
		expect(url).toContain("client_key=ttkey_42");
		expect(url).toContain("response_type=code");
		expect(url).toContain("state=signed_state");
		expect(decodeURIComponent(url)).toContain("video.publish");
		expect(decodeURIComponent(url)).toContain("user.info.basic");
	});
});

describe("exchangeTikTokCode", () => {
	it("returns ok bundle on 200 with required open_id", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "TT_ACCESS",
							refresh_token: "TT_REFRESH",
							expires_in: 86400,
							refresh_expires_in: 31536000,
							scope: "user.info.basic,video.publish",
							token_type: "Bearer",
							open_id: "open_xyz",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeTikTokCode({
			code: "c",
			clientKey: "ck",
			clientSecret: "cs",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.bundle.openId).toBe("open_xyz");
			expect(result.bundle.refreshToken).toBe("TT_REFRESH");
		}
	});

	it("returns ok=false on error envelope (TikTok returns 200 with error field on certain failures)", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: "invalid_grant",
							error_description: "Authorization code expired",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeTikTokCode({
			code: "bad",
			clientKey: "ck",
			clientSecret: "cs",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("invalid_grant");
		}
	});

	it("returns ok=false on malformed response (missing open_id)", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "T",
							expires_in: 86400,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeTikTokCode({
			code: "c",
			clientKey: "ck",
			clientSecret: "cs",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("malformed_token_response");
		}
	});
});

describe("resolveTikTokUserInfo", () => {
	it("normalises /v2/user/info response", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: {
								user: {
									open_id: "open_999",
									display_name: "creator",
									avatar_url: "https://example.com/a.png",
								},
							},
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveTikTokUserInfo("token");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.userInfo.openId).toBe("open_999");
			expect(result.userInfo.displayName).toBe("creator");
		}
	});
});
