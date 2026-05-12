/**
 * HMAC-signed OAuth `state` parameter.
 *
 * Used to carry `{brandId, csrfNonce, ts, codeVerifier?}` from the OAuth
 * start route (`GET /api/brands/:brandId/oauth/<platform>/start`) to the
 * callback (`GET /api/oauth/<platform>/callback?code=...&state=...`) without
 * relying on a session cookie. The callback is hit by the platform with
 * no session context; the signed state is the authentication.
 *
 * Encoding: base64url("<json>.<sigHex>") where `<json>` is the canonical
 * JSON of the payload and `<sigHex>` is HMAC-SHA-256(json, TOKEN_ENCRYPTION_KEY).
 * Reuse of `TOKEN_ENCRYPTION_KEY` is intentional — one secret, two purposes,
 * documented in the platform integration runbook.
 *
 * Replay window: 5 minutes (300 seconds). State payloads with `ts` older
 * than now-300s are rejected.
 */

import type { PlatformEnv, PlatformId } from "./types";

const STATE_TTL_SECONDS = 300; // 5-minute replay window
const STATE_DELIMITER = ".";

export interface OAuthStatePayload {
	brandId: string;
	platform: PlatformId;
	csrfNonce: string;
	ts: number; // unix seconds
	codeVerifier?: string; // PKCE for X
	redirectAfter?: string;
}

export type OAuthStateVerifyResult =
	| { ok: true; payload: OAuthStatePayload }
	| {
			ok: false;
			reason: "expired" | "tampered" | "malformed" | "missing_secret";
			detail?: string;
	  };

export class OAuthStateError extends Error {
	override readonly name = "OAuthStateError";
	constructor(message: string, readonly reason: "missing_secret") {
		super(message);
	}
}

/**
 * Sign + encode a state payload.
 *
 * @param payload  Caller-supplied fields. `ts` and `csrfNonce` are filled in
 *                 here so callers cannot forge a stale timestamp.
 */
export async function signState(
	env: PlatformEnv,
	payload: Omit<OAuthStatePayload, "ts" | "csrfNonce"> & {
		ts?: number;
		csrfNonce?: string;
	},
): Promise<string> {
	const secret = requireSecret(env);
	const finalPayload: OAuthStatePayload = {
		brandId: payload.brandId,
		platform: payload.platform,
		ts: payload.ts ?? Math.floor(Date.now() / 1000),
		csrfNonce: payload.csrfNonce ?? generateNonce(),
		...(payload.codeVerifier === undefined ? {} : { codeVerifier: payload.codeVerifier }),
		...(payload.redirectAfter === undefined ? {} : { redirectAfter: payload.redirectAfter }),
	};
	const json = JSON.stringify(finalPayload);
	const sig = await hmacHex(secret, json);
	return base64UrlEncode(`${json}${STATE_DELIMITER}${sig}`);
}

/**
 * Verify + decode a state token. Returns `{ok: true, payload}` on success or
 * `{ok: false, reason}` on failure. Constant-time signature compare.
 */
export async function verifyState(
	env: PlatformEnv,
	state: string,
	nowSeconds?: number,
): Promise<OAuthStateVerifyResult> {
	const secret = env.TOKEN_ENCRYPTION_KEY;
	if (typeof secret !== "string" || secret.length === 0) {
		return { ok: false, reason: "missing_secret" };
	}
	let decoded: string;
	try {
		decoded = base64UrlDecode(state);
	} catch {
		return { ok: false, reason: "malformed", detail: "base64url decode failed" };
	}
	const lastDot = decoded.lastIndexOf(STATE_DELIMITER);
	if (lastDot <= 0) {
		return { ok: false, reason: "malformed", detail: "missing signature segment" };
	}
	const json = decoded.slice(0, lastDot);
	const sig = decoded.slice(lastDot + 1);
	if (!/^[0-9a-f]+$/.test(sig)) {
		return { ok: false, reason: "malformed", detail: "signature not hex" };
	}
	const expected = await hmacHex(secret, json);
	if (!timingSafeEqualHex(sig, expected)) {
		return { ok: false, reason: "tampered" };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, reason: "malformed", detail: "json parse failed" };
	}
	if (!parsed || typeof parsed !== "object") {
		return { ok: false, reason: "malformed", detail: "payload not object" };
	}
	const obj = parsed as Record<string, unknown>;
	if (
		typeof obj.brandId !== "string" ||
		typeof obj.platform !== "string" ||
		typeof obj.csrfNonce !== "string" ||
		typeof obj.ts !== "number"
	) {
		return { ok: false, reason: "malformed", detail: "payload missing required fields" };
	}
	const now = nowSeconds ?? Math.floor(Date.now() / 1000);
	if (obj.ts < now - STATE_TTL_SECONDS) {
		return { ok: false, reason: "expired" };
	}
	// Allow up to 60s of clock skew in the "future" direction.
	if (obj.ts > now + 60) {
		return { ok: false, reason: "tampered", detail: "future timestamp" };
	}
	return { ok: true, payload: obj as unknown as OAuthStatePayload };
}

// --- internals ---

function requireSecret(env: PlatformEnv): string {
	if (typeof env.TOKEN_ENCRYPTION_KEY !== "string" || env.TOKEN_ENCRYPTION_KEY.length === 0) {
		throw new OAuthStateError(
			"TOKEN_ENCRYPTION_KEY missing; cannot sign OAuth state",
			"missing_secret",
		);
	}
	return env.TOKEN_ENCRYPTION_KEY;
}

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

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function generateNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(input: string): string {
	// Encode UTF-8 bytes → base64 → url-safe variant.
	const bytes = new TextEncoder().encode(input);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
	const normalised = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}
