/**
 * TikTok for Business OAuth 2.0 helpers.
 *
 * TikTok's OAuth uses `client_key` (not client_id) and `client_secret`.
 * The authorize endpoint is `/v2/auth/authorize/`; the token endpoint is
 * `open.tiktokapis.com/v2/oauth/token/`.
 *
 * Scopes used (must be approved in TikTok Developer Portal for live mode;
 * Sandbox Mode supports all of these against test accounts):
 *   user.info.basic            - resolve open_id / display_name
 *   video.publish              - publish videos via Content Posting API
 *   video.list                 - list user's videos
 *   comment.list               - read comments on user's videos
 *   comment.list.manage        - reply to comments
 */

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";

export const DEFAULT_TIKTOK_SCOPES = [
	"user.info.basic",
	"video.publish",
	"video.list",
	"comment.list",
	"comment.list.manage",
] as const;

export interface BuildTikTokAuthorizeUrlInput {
	state: string;
	clientKey: string;
	redirectUri: string;
	scopes?: readonly string[];
}

export function buildTikTokAuthorizeUrl(input: BuildTikTokAuthorizeUrlInput): string {
	const params = new URLSearchParams({
		client_key: input.clientKey,
		response_type: "code",
		scope: (input.scopes ?? DEFAULT_TIKTOK_SCOPES).join(","),
		redirect_uri: input.redirectUri,
		state: input.state,
	});
	return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
}

export interface TikTokExchangeCodeInput {
	code: string;
	clientKey: string;
	clientSecret: string;
	redirectUri: string;
}

export interface TikTokTokenBundle {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	refreshExpiresIn: number;
	scope: string;
	openId: string;
	tokenType: string;
}

export interface TikTokOAuthError {
	error: string;
	error_description?: string | undefined;
	status?: number | undefined;
}

export type TikTokTokenResult =
	| { ok: true; bundle: TikTokTokenBundle }
	| { ok: false; error: TikTokOAuthError };

export async function exchangeTikTokCode(
	input: TikTokExchangeCodeInput,
): Promise<TikTokTokenResult> {
	const body = new URLSearchParams({
		client_key: input.clientKey,
		client_secret: input.clientSecret,
		code: input.code,
		grant_type: "authorization_code",
		redirect_uri: input.redirectUri,
	});
	const response = await fetch(TIKTOK_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Cache-Control": "no-cache",
		},
		body: body.toString(),
	});
	return parseTikTokTokenResponse(response);
}

export interface TikTokRefreshInput {
	refreshToken: string;
	clientKey: string;
	clientSecret: string;
}

export async function refreshTikTokToken(input: TikTokRefreshInput): Promise<TikTokTokenResult> {
	const body = new URLSearchParams({
		client_key: input.clientKey,
		client_secret: input.clientSecret,
		grant_type: "refresh_token",
		refresh_token: input.refreshToken,
	});
	const response = await fetch(TIKTOK_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Cache-Control": "no-cache",
		},
		body: body.toString(),
	});
	return parseTikTokTokenResponse(response);
}

async function parseTikTokTokenResponse(response: Response): Promise<TikTokTokenResult> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return {
			ok: false,
			error: {
				error: "invalid_token_response",
				error_description: `TikTok token endpoint returned non-JSON (status ${String(response.status)})`,
				status: response.status,
			},
		};
	}
	const obj = toRecord(payload);
	// TikTok wraps errors as `{error: "...", error_description: "..."}` at the top level.
	if (typeof obj.error === "string" && obj.error.length > 0) {
		return {
			ok: false,
			error: {
				error: obj.error,
				error_description:
					typeof obj.error_description === "string" ? obj.error_description : undefined,
				status: response.status,
			},
		};
	}
	if (!response.ok) {
		return {
			ok: false,
			error: {
				error: "tiktok_oauth_error",
				error_description: JSON.stringify(payload),
				status: response.status,
			},
		};
	}
	if (
		typeof obj.access_token !== "string" ||
		typeof obj.expires_in !== "number" ||
		typeof obj.open_id !== "string"
	) {
		return {
			ok: false,
			error: {
				error: "malformed_token_response",
				error_description: "missing access_token, expires_in, or open_id",
				status: response.status,
			},
		};
	}
	return {
		ok: true,
		bundle: {
			accessToken: obj.access_token,
			refreshToken: typeof obj.refresh_token === "string" ? obj.refresh_token : "",
			expiresIn: obj.expires_in,
			refreshExpiresIn:
				typeof obj.refresh_expires_in === "number" ? obj.refresh_expires_in : 0,
			scope: typeof obj.scope === "string" ? obj.scope : "",
			openId: obj.open_id,
			tokenType: typeof obj.token_type === "string" ? obj.token_type : "bearer",
		},
	};
}

export interface TikTokUserInfo {
	openId: string;
	displayName?: string;
	avatarUrl?: string;
}

export type TikTokUserInfoResult =
	| { ok: true; userInfo: TikTokUserInfo }
	| { ok: false; error: TikTokOAuthError };

export async function resolveTikTokUserInfo(
	accessToken: string,
): Promise<TikTokUserInfoResult> {
	const params = new URLSearchParams({ fields: "open_id,display_name,avatar_url" });
	const response = await fetch(`${TIKTOK_USERINFO_URL}?${params.toString()}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		return {
			ok: false,
			error: {
				error: "userinfo_failed",
				error_description: `status ${String(response.status)}`,
				status: response.status,
			},
		};
	}
	const body = toRecord(await response.json());
	const data = toRecord(toRecord(body.data).user);
	if (typeof data.open_id !== "string") {
		return {
			ok: false,
			error: { error: "userinfo_malformed", error_description: "missing open_id" },
		};
	}
	return {
		ok: true,
		userInfo: {
			openId: data.open_id,
			...(typeof data.display_name === "string" ? { displayName: data.display_name } : {}),
			...(typeof data.avatar_url === "string" ? { avatarUrl: data.avatar_url } : {}),
		},
	};
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export const TIKTOK_OAUTH_CONSTANTS = {
	AUTHORIZE_URL: TIKTOK_AUTHORIZE_URL,
	TOKEN_URL: TIKTOK_TOKEN_URL,
	USERINFO_URL: TIKTOK_USERINFO_URL,
} as const;
