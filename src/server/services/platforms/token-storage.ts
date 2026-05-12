/**
 * Encrypted platform-token storage.
 *
 * Tokens (access + refresh + metadata) are stored encrypted in KV. D1
 * `social_account_tokens` holds only metadata (platform, scope_csv, expiry,
 * `token_kv_key`). Encryption key is derived per-brand via HKDF from a single
 * Worker secret `TOKEN_ENCRYPTION_KEY` (32-byte base64) + brand id as salt.
 *
 * Threat model:
 *  - Compromise of the D1 row alone leaks no usable token (only the KV key).
 *  - Compromise of KV ciphertext alone leaks no usable token (key derived
 *    from a secret + brand-scoped salt; AES-GCM auth tag rejects tampering).
 *  - Compromise of BOTH KV ciphertext AND the `TOKEN_ENCRYPTION_KEY` secret
 *    yields all brands' tokens — this is the same threat model as any
 *    symmetric-key-encryption-at-rest design and is documented in
 *    `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md`.
 *
 * Key rotation procedure: write `TOKEN_ENCRYPTION_KEY_NEXT`, redeploy with a
 * dual-read path, re-encrypt all KV values under the new key, swap names,
 * delete the old key. Not implemented yet; runbook documents the steps.
 */

import type {
	PlatformEnv,
	PlatformId,
	PlatformKvNamespace,
	StoredTokenPayload,
} from "./types";

const IV_BYTES = 12;
const HKDF_INFO_LABEL = "social_account_tokens";

export interface TokenStorageOptions {
	/**
	 * Override the KV key prefix. Defaults to `social_token:` so it's easy to
	 * scan with `wrangler kv:key list --prefix social_token:` if needed.
	 */
	keyPrefix?: string;
}

export interface WriteTokenInput {
	brandId: string;
	platform: PlatformId;
	externalAccountId: string;
	payload: StoredTokenPayload;
}

export interface ReadTokenInput {
	brandId: string;
	tokenKvKey: string;
}

export class TokenStorageError extends Error {
	override readonly name = "TokenStorageError";
	constructor(
		message: string,
		readonly code:
			| "missing_encryption_key"
			| "missing_kv_binding"
			| "invalid_ciphertext"
			| "decrypt_failed"
			| "missing_payload",
	) {
		super(message);
	}
}

export function deriveTokenKvKey(
	brandId: string,
	platform: PlatformId,
	externalAccountId: string,
	prefix = "social_token:",
): string {
	if (!brandId || !platform || !externalAccountId) {
		throw new TokenStorageError("brandId, platform, and externalAccountId required", "missing_payload");
	}
	return `${prefix}${brandId}:${platform}:${externalAccountId}`;
}

/**
 * Encrypt + write a token payload to KV. Returns the KV key for D1 storage.
 */
export async function writeToken(
	env: PlatformEnv,
	input: WriteTokenInput,
	options: TokenStorageOptions = {},
): Promise<string> {
	const kv = requireKv(env);
	const masterKey = requireEncryptionKey(env);
	const derivedKey = await deriveBrandKey(masterKey, input.brandId);
	const plaintext = encodePayload(input.payload);
	const ciphertext = await encryptBytes(derivedKey, plaintext);
	const tokenKvKey = deriveTokenKvKey(
		input.brandId,
		input.platform,
		input.externalAccountId,
		options.keyPrefix,
	);
	await kv.put(tokenKvKey, ciphertext);
	return tokenKvKey;
}

/**
 * Read + decrypt the token payload at the given KV key. Returns null if
 * KV row is missing (e.g. after revocation). Throws on tamper/wrong-key.
 */
export async function readToken(
	env: PlatformEnv,
	input: ReadTokenInput,
): Promise<StoredTokenPayload | null> {
	const kv = requireKv(env);
	const masterKey = requireEncryptionKey(env);
	const value = await kv.get(input.tokenKvKey, { type: "arrayBuffer" });
	if (value === null) {
		return null;
	}
	if (!(value instanceof ArrayBuffer)) {
		throw new TokenStorageError("KV returned non-ArrayBuffer for token read", "invalid_ciphertext");
	}
	const derivedKey = await deriveBrandKey(masterKey, input.brandId);
	const plaintext = await decryptBytes(derivedKey, new Uint8Array(value));
	return decodePayload(plaintext);
}

/**
 * Delete the KV ciphertext for a revoked token. D1 row should be flipped to
 * `status='revoked'` separately by the caller.
 */
export async function revokeToken(
	env: PlatformEnv,
	tokenKvKey: string,
): Promise<void> {
	const kv = requireKv(env);
	await kv.delete(tokenKvKey);
}

// --- internals ---

function requireEncryptionKey(env: PlatformEnv): Uint8Array {
	const raw = env.TOKEN_ENCRYPTION_KEY;
	if (typeof raw !== "string" || raw.length === 0) {
		throw new TokenStorageError(
			"TOKEN_ENCRYPTION_KEY secret is not set. Run `wrangler secret put TOKEN_ENCRYPTION_KEY --env <env>`.",
			"missing_encryption_key",
		);
	}
	return base64Decode(raw);
}

function requireKv(env: PlatformEnv): PlatformKvNamespace {
	if (!env.CACHE) {
		throw new TokenStorageError("CACHE KV binding missing from env", "missing_kv_binding");
	}
	return env.CACHE;
}

async function deriveBrandKey(masterKey: Uint8Array, brandId: string): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		"raw",
		toArrayBuffer(masterKey),
		"HKDF",
		false,
		["deriveKey"],
	);
	const salt = new TextEncoder().encode(brandId);
	const info = new TextEncoder().encode(HKDF_INFO_LABEL);
	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: toArrayBuffer(salt),
			info: toArrayBuffer(info),
		},
		baseKey,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<ArrayBuffer> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const cipher = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: toArrayBuffer(iv) },
		key,
		toArrayBuffer(plaintext),
	);
	const cipherBytes = new Uint8Array(cipher);
	const out = new Uint8Array(IV_BYTES + cipherBytes.byteLength);
	out.set(iv, 0);
	out.set(cipherBytes, IV_BYTES);
	return toArrayBuffer(out);
}

async function decryptBytes(key: CryptoKey, ciphertext: Uint8Array): Promise<Uint8Array> {
	if (ciphertext.byteLength <= IV_BYTES) {
		throw new TokenStorageError("ciphertext too short for IV header", "invalid_ciphertext");
	}
	const iv = ciphertext.subarray(0, IV_BYTES);
	const body = ciphertext.subarray(IV_BYTES);
	try {
		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: toArrayBuffer(iv) },
			key,
			toArrayBuffer(body),
		);
		return new Uint8Array(plain);
	} catch {
		throw new TokenStorageError("decryption failed (wrong key or tampered ciphertext)", "decrypt_failed");
	}
}

function encodePayload(payload: StoredTokenPayload): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(payload));
}

function decodePayload(bytes: Uint8Array): StoredTokenPayload {
	const text = new TextDecoder().decode(bytes);
	const parsed = JSON.parse(text) as unknown;
	if (!parsed || typeof parsed !== "object") {
		throw new TokenStorageError("decrypted payload was not an object", "invalid_ciphertext");
	}
	const obj = parsed as Record<string, unknown>;
	if (typeof obj.access_token !== "string" || typeof obj.issued_at !== "string") {
		throw new TokenStorageError("decrypted payload missing required fields", "invalid_ciphertext");
	}
	return obj as unknown as StoredTokenPayload;
}

/**
 * Decode standard or URL-safe base64 to bytes. Tolerant of optional padding.
 */
function base64Decode(input: string): Uint8Array {
	const normalised = input
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.replace(/\s/g, "");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Convert a Uint8Array view into a fresh ArrayBuffer slice. WebCrypto APIs
 * require ArrayBuffer (not Uint8Array) parameters; using `.buffer` directly
 * is wrong when the view covers a slice of a larger backing buffer.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const out = new ArrayBuffer(view.byteLength);
	new Uint8Array(out).set(view);
	return out;
}
