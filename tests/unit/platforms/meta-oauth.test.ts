import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildMetaAuthorizeUrl,
	exchangeMetaCode,
	META_OAUTH_CONSTANTS,
	resolveMetaPages,
} from "../../../src/server/services/platforms/meta-oauth";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("buildMetaAuthorizeUrl", () => {
	it("includes required OAuth params + default scope set comma-joined", () => {
		const url = buildMetaAuthorizeUrl({
			state: "signed_state",
			clientId: "META_APP_42",
			redirectUri: "https://example.com/api/oauth/meta/callback",
		});
		expect(url).toContain(META_OAUTH_CONSTANTS.AUTHORIZE_URL);
		expect(url).toContain("client_id=META_APP_42");
		expect(url).toContain("response_type=code");
		expect(url).toContain("state=signed_state");
		expect(url).toContain("scope=");
		// Meta uses comma-separated scopes; pages_show_list should appear.
		expect(decodeURIComponent(url)).toContain("pages_show_list");
		expect(decodeURIComponent(url)).toContain("instagram_content_publish");
	});
});

describe("exchangeMetaCode", () => {
	it("returns ok bundle on 200", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "EAA_user",
							expires_in: 5_000_000,
							token_type: "bearer",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeMetaCode({
			code: "code_42",
			clientId: "id",
			clientSecret: "secret",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.bundle.accessToken).toBe("EAA_user");
			expect(result.bundle.expiresIn).toBe(5_000_000);
		}
	});

	it("returns ok=false with parsed error on 400", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: { message: "Invalid OAuth access token", type: "OAuthException" },
						}),
						{ status: 400, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeMetaCode({
			code: "bad",
			clientId: "id",
			clientSecret: "secret",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toContain("OAuth");
			expect(result.error.status).toBe(400);
		}
	});
});

describe("resolveMetaPages", () => {
	it("returns pages list with optional instagram_business_account_id", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: [
								{
									id: "page_111",
									name: "Brand Page",
									access_token: "page_token_111",
									category: "Brand",
									instagram_business_account: { id: "ig_999", name: "brand_ig" },
								},
								{
									id: "page_222",
									name: "FB Only Page",
									access_token: "page_token_222",
								},
							],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveMetaPages({ userAccessToken: "user_token" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.pages).toHaveLength(2);
			expect(result.pages[0]).toMatchObject({
				pageId: "page_111",
				pageName: "Brand Page",
				instagramBusinessAccountId: "ig_999",
				category: "Brand",
			});
			expect(result.pages[1]?.instagramBusinessAccountId).toBeUndefined();
		}
	});

	it("returns ok=false when /me/accounts fails", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> => Promise.resolve(new Response("forbidden", { status: 403 })),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveMetaPages({ userAccessToken: "bad" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("me_accounts_failed");
		}
	});
});
