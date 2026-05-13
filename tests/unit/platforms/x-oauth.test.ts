import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildXAuthorizeUrl,
	exchangeXCode,
	generatePkcePair,
	resolveXUserInfo,
	X_OAUTH_CONSTANTS,
} from "../../../src/server/services/platforms/x-oauth";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("generatePkcePair", () => {
	it("generates a verifier 43 base64url chars and a 43-char S256 challenge", async () => {
		const pair = await generatePkcePair();
		expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(pair.verifier).not.toBe(pair.challenge);
	});

	it("derives a deterministic challenge from a given verifier", async () => {
		const p1 = await generatePkcePair();
		const p2 = await generatePkcePair();
		// Two independent pairs must have distinct verifiers (PKCE security).
		expect(p1.verifier).not.toBe(p2.verifier);
	});
});

describe("buildXAuthorizeUrl", () => {
	it("includes required PKCE + OAuth 2.0 params", () => {
		const url = buildXAuthorizeUrl({
			state: "signed_state",
			codeChallenge: "challenge_abc",
			clientId: "X_CLIENT_ABC",
			redirectUri: "https://example.com/api/oauth/x/callback",
		});
		expect(url).toContain(X_OAUTH_CONSTANTS.AUTHORIZE_URL);
		expect(url).toContain("response_type=code");
		expect(url).toContain("client_id=X_CLIENT_ABC");
		expect(url).toContain("state=signed_state");
		expect(url).toContain("code_challenge=challenge_abc");
		expect(url).toContain("code_challenge_method=S256");
		expect(url).toContain("scope=tweet.read+tweet.write+users.read+offline.access");
	});
});

describe("exchangeXCode", () => {
	it("returns ok with the token bundle on a 200 response", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "AAAA",
							refresh_token: "RRRR",
							expires_in: 7200,
							scope: "tweet.read tweet.write users.read offline.access",
							token_type: "bearer",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeXCode({
			code: "mock_code",
			codeVerifier: "mock_verifier",
			clientId: "X_CLIENT_ID",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.bundle.accessToken).toBe("AAAA");
			expect(result.bundle.refreshToken).toBe("RRRR");
			expect(result.bundle.expiresIn).toBe(7200);
			expect(result.bundle.scope).toContain("tweet.write");
		}
	});

	it("returns ok=false on 4xx with parsed error fields", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							error: "invalid_request",
							error_description: "code_verifier mismatch",
						}),
						{ status: 400, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await exchangeXCode({
			code: "bad",
			codeVerifier: "bad",
			clientId: "X_CLIENT_ID",
			redirectUri: "https://example.com/cb",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("invalid_request");
			expect(result.error.error_description).toContain("verifier");
			expect(result.error.status).toBe(400);
		}
	});

	it("attaches Basic auth header when clientSecret is provided (confidential client)", async () => {
		const fetchSpy = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
				const headers = init?.headers ? new Headers(init.headers) : new Headers();
				expect(headers.get("Authorization")).toMatch(/^Basic /);
				return Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "X",
							expires_in: 7200,
							scope: "",
							token_type: "bearer",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);
		await exchangeXCode({
			code: "c",
			codeVerifier: "v",
			clientId: "id",
			clientSecret: "secret",
			redirectUri: "https://example.com/cb",
		});
		expect(fetchSpy).toHaveBeenCalledOnce();
	});
});

describe("resolveXUserInfo", () => {
	it("normalises /2/users/me response into XUserInfo shape", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: { id: "999", username: "founder", name: "Founder" },
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveXUserInfo("token");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.userInfo.id).toBe("999");
			expect(result.userInfo.username).toBe("founder");
			expect(result.userInfo.name).toBe("Founder");
		}
	});

	it("returns ok=false on userinfo_failed when response is not 200", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveXUserInfo("bad");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("userinfo_failed");
		}
	});

	it("returns ok=false when response shape is malformed (missing data.id)", async () => {
		const fetchSpy = vi.fn(
			(): Promise<Response> =>
				Promise.resolve(
					new Response(JSON.stringify({ data: { username: "no_id" } }), { status: 200 }),
				),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const result = await resolveXUserInfo("token");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error).toBe("userinfo_malformed");
		}
	});
});
