import { describe, expect, it } from "vitest";

import {
	signState,
	verifyState,
} from "../../../src/server/services/platforms/oauth-state";
import type { PlatformEnv } from "../../../src/server/services/platforms/types";

function envWithSecret(secret = "test-secret-key-32bytes-padding-pad="): PlatformEnv {
	return { TOKEN_ENCRYPTION_KEY: secret };
}

describe("signState + verifyState round trip", () => {
	it("verifies a freshly signed state", async () => {
		const env = envWithSecret();
		const token = await signState(env, {
			brandId: "brand_ok",
			platform: "linkedin",
		});
		const verified = await verifyState(env, token);
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.payload.brandId).toBe("brand_ok");
			expect(verified.payload.platform).toBe("linkedin");
			expect(verified.payload.csrfNonce).toMatch(/^[0-9a-f]+$/);
			expect(typeof verified.payload.ts).toBe("number");
		}
	});

	it("round-trips optional codeVerifier + redirectAfter", async () => {
		const env = envWithSecret();
		const token = await signState(env, {
			brandId: "brand_pkce",
			platform: "x",
			codeVerifier: "raw-code-verifier-string-43-chars-min",
			redirectAfter: "/app/brands/brand_pkce/connections?connected=x",
		});
		const verified = await verifyState(env, token);
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.payload.codeVerifier).toBe("raw-code-verifier-string-43-chars-min");
			expect(verified.payload.redirectAfter).toBe("/app/brands/brand_pkce/connections?connected=x");
		}
	});
});

describe("verifyState rejections", () => {
	it("rejects a state signed with a different secret (tampered)", async () => {
		const env1 = envWithSecret("secret-one-value-1234567890");
		const env2 = envWithSecret("secret-two-value-9876543210");
		const token = await signState(env1, { brandId: "b", platform: "meta" });
		const verified = await verifyState(env2, token);
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("tampered");
		}
	});

	it("rejects a state where the JSON payload was modified after signing", async () => {
		const env = envWithSecret();
		const token = await signState(env, { brandId: "b_original", platform: "linkedin" });
		// Decode base64url, swap brandId in the JSON portion, re-encode without re-signing.
		const normalised = token.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
		const decoded = atob(padded);
		const lastDot = decoded.lastIndexOf(".");
		const json = decoded.slice(0, lastDot);
		const sig = decoded.slice(lastDot + 1);
		const tampered = json.replace("b_original", "b_HACKED") + "." + sig;
		const reencoded = btoa(tampered).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
		const verified = await verifyState(env, reencoded);
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("tampered");
		}
	});

	it("rejects a state older than 300 seconds (expired)", async () => {
		const env = envWithSecret();
		const oldTs = Math.floor(Date.now() / 1000) - 301;
		const token = await signState(env, { brandId: "b", platform: "linkedin", ts: oldTs });
		const verified = await verifyState(env, token);
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("expired");
		}
	});

	it("accepts a state signed 299 seconds ago (just inside the 5-minute replay window)", async () => {
		const env = envWithSecret();
		const ts = Math.floor(Date.now() / 1000) - 299;
		const token = await signState(env, { brandId: "b", platform: "tiktok", ts });
		const verified = await verifyState(env, token);
		expect(verified.ok).toBe(true);
	});

	it("rejects a state with a future timestamp beyond the 60s skew tolerance", async () => {
		const env = envWithSecret();
		const futureTs = Math.floor(Date.now() / 1000) + 120;
		const token = await signState(env, { brandId: "b", platform: "x", ts: futureTs });
		const verified = await verifyState(env, token);
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("tampered");
		}
	});

	it("rejects malformed base64url input", async () => {
		const env = envWithSecret();
		const verified = await verifyState(env, "!!!not_base64url!!!");
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("malformed");
		}
	});

	it("rejects a state missing the signature segment", async () => {
		const env = envWithSecret();
		// Encode a payload-only string with no `.` separator.
		const json = JSON.stringify({
			brandId: "b",
			platform: "linkedin",
			csrfNonce: "nonce",
			ts: Math.floor(Date.now() / 1000),
		});
		const noSig = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
		const verified = await verifyState(env, noSig);
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("malformed");
		}
	});

	it("returns missing_secret when TOKEN_ENCRYPTION_KEY is absent on the env", async () => {
		const env: PlatformEnv = {};
		// signState should throw; verifyState should return structured failure.
		const verified = await verifyState(env, "anything");
		expect(verified.ok).toBe(false);
		if (!verified.ok) {
			expect(verified.reason).toBe("missing_secret");
		}
	});
});
