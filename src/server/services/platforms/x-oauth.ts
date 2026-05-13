/**
 * X (Twitter) OAuth 2.0 helpers with PKCE.
 *
 * X v2 requires PKCE for all OAuth 2.0 flows. The `code_verifier` is generated
 * here and embedded in the signed `state` parameter so the callback can
 * complete the token exchange without server-side session storage.
 *
 * Scopes used (Free + Basic tier compatible):
 *   tweet.read       - read tweets the authenticated user can see
 *   tweet.write      - publish + reply on user's behalf
 *   users.read       - resolve /2/users/me
 *   offline.access   - refresh tokens (without this scope, no refresh token returned)
 */

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_USERINFO_URL = "https://api.twitter.com/2/users/me";

export const DEFAULT_X_SCOPES = [
	"tweet.read",
	"tweet.write",
	"users.read",
	"offline.access",
] as const;

export interface XCodeVerifier {
	verifier: string;
	challenge: string;
}

/**
 * Generate a PKCE code_verifier + S256 challenge pair.
 * Verifier: 43–128 chars, [A-Z][a-z][0-9]\-._~  → base64url of 32 random bytes (43 chars).
 * Challenge: BASE64URL(SHA256(verifier)).
 */
export async function generatePkcePair(): Promise<XCodeVerifier> {
	const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
	const verifier = base64UrlEncode(verifierBytes);
	const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(new TextEncoder().encode(verifier)));
	const challenge = base64UrlEncode(new Uint8Array(digest));
	return { verifier, challenge };
}

export interface BuildXAuthorizeUrlInput {
	state: string;
	codeChallenge: string;
	clientId: string;
	redirectUri: string;
	scopes?: readonly string[];
}

export function buildXAuthorizeUrl(input: BuildXAuthorizeUrlInput): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		state: input.state,
		scope: (input.scopes ?? DEFAULT_X_SCOPES).join(" "),
		code_challenge: input.codeChallenge,
		code_challenge_method: "S256",
	});
	return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

export interface XExchangeCodeInput {
	code: string;
	codeVerifier: string;
	clientId: string;
	clientSecret?: string; // Optional: confidential clients use Basic auth; public clients don't
	redirectUri: string;
}

export interface XTokenBundle {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	scope: string;
	tokenType: string;
}

export interface XOAuthError {
	error: string;
	error_description?: string | undefined;
	status?: number | undefined;
}

export type XTokenResult = { ok: true; bundle: XTokenBundle } | { ok: false; error: XOAuthError };

export async function exchangeXCode(input: XExchangeCodeInput): Promise<XTokenResult> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: input.code,
		client_id: input.clientId,
		code_verifier: input.codeVerifier,
		redirect_uri: input.redirectUri,
	});
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
		Accept: "application/json",
	};
	if (input.clientSecret) {
		headers.Authorization = `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`;
	}
	const response = await fetch(X_TOKEN_URL, {
		method: "POST",
		headers,
		body: body.toString(),
	});
	return parseXTokenResponse(response);
}

export interface XRefreshInput {
	refreshToken: string;
	clientId: string;
	clientSecret?: string;
}

export async function refreshXToken(input: XRefreshInput): Promise<XTokenResult> {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: input.refreshToken,
		client_id: input.clientId,
	});
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
		Accept: "application/json",
	};
	if (input.clientSecret) {
		headers.Authorization = `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`;
	}
	const response = await fetch(X_TOKEN_URL, {
		method: "POST",
		headers,
		body: body.toString(),
	});
	return parseXTokenResponse(response);
}

async function parseXTokenResponse(response: Response): Promise<XTokenResult> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return {
			ok: false,
			error: {
				error: "invalid_token_response",
				error_description: `X token endpoint returned non-JSON (status ${String(response.status)})`,
				status: response.status,
			},
		};
	}
	if (!response.ok) {
		const obj = toRecord(payload);
		return {
			ok: false,
			error: {
				error: typeof obj.error === "string" ? obj.error : "x_oauth_error",
				error_description: typeof obj.error_description === "string" ? obj.error_description : undefined,
				status: response.status,
			},
		};
	}
	const obj = toRecord(payload);
	if (typeof obj.access_token !== "string" || typeof obj.expires_in !== "number") {
		return {
			ok: false,
			error: {
				error: "malformed_token_response",
				error_description: "missing access_token or expires_in",
				status: response.status,
			},
		};
	}
	return {
		ok: true,
		bundle: {
			accessToken: obj.access_token,
			...(typeof obj.refresh_token === "string" ? { refreshToken: obj.refresh_token } : {}),
			expiresIn: obj.expires_in,
			scope: typeof obj.scope === "string" ? obj.scope : "",
			tokenType: typeof obj.token_type === "string" ? obj.token_type : "bearer",
		},
	};
}

export interface XUserInfo {
	id: string;
	username: string;
	name?: string;
}

export type XUserInfoResult =
	| { ok: true; userInfo: XUserInfo }
	| { ok: false; error: XOAuthError };

export async function resolveXUserInfo(accessToken: string): Promise<XUserInfoResult> {
	const response = await fetch(X_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
	});
	if (!response.ok) {
		let detail: unknown = null;
		try {
			detail = await response.json();
		} catch {
			// ignore
		}
		return {
			ok: false,
			error: {
				error: "userinfo_failed",
				error_description: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
				status: response.status,
			},
		};
	}
	const body = toRecord(await response.json());
	const data = toRecord(body.data);
	if (typeof data.id !== "string" || typeof data.username !== "string") {
		return {
			ok: false,
			error: { error: "userinfo_malformed", error_description: "missing id or username" },
		};
	}
	return {
		ok: true,
		userInfo: {
			id: data.id,
			username: data.username,
			...(typeof data.name === "string" ? { name: data.name } : {}),
		},
	};
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	const out = new ArrayBuffer(view.byteLength);
	new Uint8Array(out).set(view);
	return out;
}

export const X_OAUTH_CONSTANTS = {
	AUTHORIZE_URL: X_AUTHORIZE_URL,
	TOKEN_URL: X_TOKEN_URL,
	USERINFO_URL: X_USERINFO_URL,
} as const;
