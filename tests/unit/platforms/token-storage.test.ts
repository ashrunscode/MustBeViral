import { describe, expect, it } from "vitest";

import {
	deriveTokenKvKey,
	readToken,
	revokeToken,
	TokenStorageError,
	writeToken,
} from "../../../src/server/services/platforms/token-storage";
import type {
	PlatformEnv,
	PlatformKvNamespace,
	StoredTokenPayload,
} from "../../../src/server/services/platforms/types";

function makeMemoryKv(): PlatformKvNamespace & { entries: Map<string, ArrayBuffer> } {
	const entries = new Map<string, ArrayBuffer>();
	return {
		entries,
		get(key, options): Promise<string | null | ArrayBuffer | ReadableStream<Uint8Array>> {
			const value = entries.get(key);
			if (value === undefined) {
				return Promise.resolve(null);
			}
			if (options?.type === "arrayBuffer") {
				return Promise.resolve(value);
			}
			return Promise.resolve(new TextDecoder().decode(value));
		},
		put(key, value): Promise<void> {
			if (value instanceof ArrayBuffer) {
				entries.set(key, value);
			} else if (typeof value === "string") {
				entries.set(key, new TextEncoder().encode(value).buffer);
			} else {
				return Promise.reject(new Error("unsupported KV put value in test"));
			}
			return Promise.resolve();
		},
		delete(key): Promise<void> {
			entries.delete(key);
			return Promise.resolve();
		},
	};
}

function freshKey(): string {
	// 32 random bytes → base64 ≈ same shape as the real TOKEN_ENCRYPTION_KEY secret.
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = "";
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

function makeEnv(overrides: Partial<PlatformEnv> = {}): PlatformEnv {
	return {
		TOKEN_ENCRYPTION_KEY: freshKey(),
		CACHE: makeMemoryKv(),
		...overrides,
	};
}

const samplePayload: StoredTokenPayload = {
	access_token: "ya29.example-access-token-value",
	refresh_token: "1//refresh-token-value",
	token_type: "Bearer",
	issued_at: "2026-05-12T00:00:00.000Z",
	platform_metadata: { org_urn: "urn:li:organization:12345" },
};

describe("deriveTokenKvKey", () => {
	it("composes a deterministic key from brand, platform, externalAccountId", () => {
		expect(deriveTokenKvKey("brand_abc", "linkedin", "urn:li:org:1")).toBe(
			"social_token:brand_abc:linkedin:urn:li:org:1",
		);
	});

	it("respects a custom prefix", () => {
		expect(deriveTokenKvKey("brand_abc", "x", "user_42", "test_prefix:")).toBe(
			"test_prefix:brand_abc:x:user_42",
		);
	});

	it("throws when any segment is empty", () => {
		expect(() => deriveTokenKvKey("", "linkedin", "x")).toThrow(TokenStorageError);
	});
});

describe("writeToken + readToken round-trip", () => {
	it("encrypts on write, decrypts on read, returns identical payload", async () => {
		const env = makeEnv();
		const kvKey = await writeToken(env, {
			brandId: "brand_round_trip",
			platform: "linkedin",
			externalAccountId: "urn:li:organization:99",
			payload: samplePayload,
		});
		expect(kvKey).toBe("social_token:brand_round_trip:linkedin:urn:li:organization:99");
		const out = await readToken(env, { brandId: "brand_round_trip", tokenKvKey: kvKey });
		expect(out).toEqual(samplePayload);
	});

	it("stores ciphertext in KV (not plaintext)", async () => {
		const env = makeEnv();
		const kv = env.CACHE as ReturnType<typeof makeMemoryKv>;
		const kvKey = await writeToken(env, {
			brandId: "brand_secret",
			platform: "linkedin",
			externalAccountId: "urn:li:organization:1",
			payload: samplePayload,
		});
		const stored = kv.entries.get(kvKey);
		expect(stored).toBeInstanceOf(ArrayBuffer);
		if (!stored) throw new Error("stored value missing");
		const asText = new TextDecoder().decode(stored);
		expect(asText).not.toContain("ya29.example-access-token-value");
		expect(asText).not.toContain("refresh-token-value");
	});

	it("returns null when the KV key is absent", async () => {
		const env = makeEnv();
		const out = await readToken(env, {
			brandId: "brand_x",
			tokenKvKey: "social_token:brand_x:linkedin:missing",
		});
		expect(out).toBeNull();
	});

	it("derives a different ciphertext per brand id (HKDF salt = brandId)", async () => {
		const env = makeEnv();
		const kv = env.CACHE as ReturnType<typeof makeMemoryKv>;
		await writeToken(env, {
			brandId: "brand_one",
			platform: "linkedin",
			externalAccountId: "urn:li:org:same",
			payload: samplePayload,
		});
		await writeToken(env, {
			brandId: "brand_two",
			platform: "linkedin",
			externalAccountId: "urn:li:org:same",
			payload: samplePayload,
		});
		const a = kv.entries.get("social_token:brand_one:linkedin:urn:li:org:same");
		const b = kv.entries.get("social_token:brand_two:linkedin:urn:li:org:same");
		expect(a).toBeInstanceOf(ArrayBuffer);
		expect(b).toBeInstanceOf(ArrayBuffer);
		const aHex = Array.from(new Uint8Array(a!), (n) => n.toString(16)).join("");
		const bHex = Array.from(new Uint8Array(b!), (n) => n.toString(16)).join("");
		expect(aHex).not.toEqual(bHex);
	});

	it("rejects decryption when a different brand id is provided (wrong derived key)", async () => {
		const env = makeEnv();
		const kvKey = await writeToken(env, {
			brandId: "brand_correct",
			platform: "linkedin",
			externalAccountId: "urn:li:org:42",
			payload: samplePayload,
		});
		await expect(
			readToken(env, { brandId: "brand_wrong", tokenKvKey: kvKey }),
		).rejects.toMatchObject({ code: "decrypt_failed" });
	});

	it("rejects tampered ciphertext", async () => {
		const env = makeEnv();
		const kv = env.CACHE as ReturnType<typeof makeMemoryKv>;
		const kvKey = await writeToken(env, {
			brandId: "brand_tamper",
			platform: "linkedin",
			externalAccountId: "urn:li:org:1",
			payload: samplePayload,
		});
		const stored = new Uint8Array(kv.entries.get(kvKey)!);
		const lastIndex = stored.length - 1;
		const lastByte = stored[lastIndex] ?? 0;
		stored[lastIndex] = lastByte ^ 0xff; // flip last byte
		kv.entries.set(kvKey, stored.buffer);
		await expect(
			readToken(env, { brandId: "brand_tamper", tokenKvKey: kvKey }),
		).rejects.toMatchObject({ code: "decrypt_failed" });
	});

	it("rejects ciphertext that is too short to contain an IV", async () => {
		const env = makeEnv();
		const kv = env.CACHE as ReturnType<typeof makeMemoryKv>;
		kv.entries.set("social_token:brand_short:linkedin:1", new Uint8Array([1, 2, 3]).buffer);
		await expect(
			readToken(env, { brandId: "brand_short", tokenKvKey: "social_token:brand_short:linkedin:1" }),
		).rejects.toMatchObject({ code: "invalid_ciphertext" });
	});
});

describe("revokeToken", () => {
	it("deletes the KV ciphertext", async () => {
		const env = makeEnv();
		const kv = env.CACHE as ReturnType<typeof makeMemoryKv>;
		const kvKey = await writeToken(env, {
			brandId: "brand_revoke",
			platform: "linkedin",
			externalAccountId: "urn:li:org:7",
			payload: samplePayload,
		});
		expect(kv.entries.has(kvKey)).toBe(true);
		await revokeToken(env, kvKey);
		expect(kv.entries.has(kvKey)).toBe(false);
	});
});

describe("error guards", () => {
	it("throws missing_encryption_key when TOKEN_ENCRYPTION_KEY is absent", async () => {
		const env: PlatformEnv = { CACHE: makeMemoryKv() };
		await expect(
			writeToken(env, {
				brandId: "b",
				platform: "linkedin",
				externalAccountId: "x",
				payload: samplePayload,
			}),
		).rejects.toMatchObject({ code: "missing_encryption_key" });
	});

	it("throws missing_kv_binding when CACHE is absent", async () => {
		const env: PlatformEnv = { TOKEN_ENCRYPTION_KEY: freshKey() };
		await expect(
			writeToken(env, {
				brandId: "b",
				platform: "linkedin",
				externalAccountId: "x",
				payload: samplePayload,
			}),
		).rejects.toMatchObject({ code: "missing_kv_binding" });
	});
});
