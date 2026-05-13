/**
 * Meta (Facebook + Instagram Business) OAuth 2.0 helpers.
 *
 * One Meta connection yields TWO publishable surfaces:
 *   - Facebook Page (page_id with a page access token)
 *   - Instagram Business account (ig-user id attached to the page)
 *
 * The callback in `routes/oauth.ts` lists the user's pages, picks each one
 * with a `connected_instagram_business_account`, and writes one
 * `social_account_tokens` row per page (external_account_id = page_id, and
 * the IG user id is stored in platform_metadata.instagram_business_account_id).
 *
 * Permissions used (each one requires Meta App Review for live mode but
 * works under Development Mode for build-time smoke):
 *   pages_show_list                - enumerate the user's pages
 *   pages_manage_posts             - publish on behalf of a page
 *   pages_read_engagement          - read page comments + insights
 *   pages_manage_engagement        - reply to comments
 *   instagram_basic                - read IG business profile
 *   instagram_content_publish      - publish to IG business
 *   instagram_manage_comments      - reply to IG comments
 *
 * Webhook signing: payloads come in with `X-Hub-Signature-256: sha256=<hex>`
 * where the secret is META_APP_SECRET. Verification happens in `meta.ts`.
 *
 * Subscription verification: Meta GETs `/api/webhooks/meta?hub.mode=subscribe&...`
 * with `hub.verify_token` that must match META_WEBHOOK_VERIFY_TOKEN, and we
 * echo `hub.challenge` back as plain text.
 */

const META_GRAPH_VERSION = "v18.0";
const META_AUTHORIZE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
const META_ME_ACCOUNTS_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`;

export const DEFAULT_META_SCOPES = [
	"pages_show_list",
	"pages_manage_posts",
	"pages_read_engagement",
	"pages_manage_engagement",
	"instagram_basic",
	"instagram_content_publish",
	"instagram_manage_comments",
] as const;

export interface BuildMetaAuthorizeUrlInput {
	state: string;
	clientId: string;
	redirectUri: string;
	scopes?: readonly string[];
}

export function buildMetaAuthorizeUrl(input: BuildMetaAuthorizeUrlInput): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		state: input.state,
		scope: (input.scopes ?? DEFAULT_META_SCOPES).join(","),
	});
	return `${META_AUTHORIZE_URL}?${params.toString()}`;
}

export interface MetaExchangeCodeInput {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export interface MetaTokenBundle {
	accessToken: string;
	expiresIn?: number; // seconds; some flows return undefined for long-lived tokens
	tokenType: string;
}

export interface MetaOAuthError {
	error: string;
	error_description?: string | undefined;
	status?: number | undefined;
}

export type MetaTokenResult =
	| { ok: true; bundle: MetaTokenBundle }
	| { ok: false; error: MetaOAuthError };

export async function exchangeMetaCode(input: MetaExchangeCodeInput): Promise<MetaTokenResult> {
	const params = new URLSearchParams({
		client_id: input.clientId,
		client_secret: input.clientSecret,
		redirect_uri: input.redirectUri,
		code: input.code,
	});
	const response = await fetch(`${META_TOKEN_URL}?${params.toString()}`, {
		method: "GET",
		headers: { Accept: "application/json" },
	});
	return parseMetaTokenResponse(response);
}

async function parseMetaTokenResponse(response: Response): Promise<MetaTokenResult> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return {
			ok: false,
			error: {
				error: "invalid_token_response",
				error_description: `Meta token endpoint returned non-JSON (status ${String(response.status)})`,
				status: response.status,
			},
		};
	}
	if (!response.ok) {
		const obj = toRecord(payload);
		const errObj = toRecord(obj.error);
		return {
			ok: false,
			error: {
				error: typeof errObj.message === "string" ? errObj.message : "meta_oauth_error",
				error_description: typeof errObj.type === "string" ? errObj.type : undefined,
				status: response.status,
			},
		};
	}
	const obj = toRecord(payload);
	if (typeof obj.access_token !== "string") {
		return {
			ok: false,
			error: {
				error: "malformed_token_response",
				error_description: "missing access_token",
				status: response.status,
			},
		};
	}
	return {
		ok: true,
		bundle: {
			accessToken: obj.access_token,
			...(typeof obj.expires_in === "number" ? { expiresIn: obj.expires_in } : {}),
			tokenType: typeof obj.token_type === "string" ? obj.token_type : "bearer",
		},
	};
}

/**
 * Page + IG business account summary. Each page row gets persisted as its own
 * social_account_tokens row (the page access token is the canonical token for
 * publishing on that page; IG publishing reuses the same page access token).
 */
export interface MetaPageSummary {
	pageId: string;
	pageName: string;
	pageAccessToken: string;
	instagramBusinessAccountId?: string;
	category?: string;
}

export interface ResolveMetaPagesInput {
	userAccessToken: string;
}

export type ResolveMetaPagesResult =
	| { ok: true; pages: MetaPageSummary[] }
	| { ok: false; error: MetaOAuthError };

export async function resolveMetaPages(
	input: ResolveMetaPagesInput,
): Promise<ResolveMetaPagesResult> {
	const params = new URLSearchParams({
		access_token: input.userAccessToken,
		fields: "id,name,access_token,category,instagram_business_account{id,name}",
	});
	const response = await fetch(`${META_ME_ACCOUNTS_URL}?${params.toString()}`, {
		method: "GET",
		headers: { Accept: "application/json" },
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
				error: "me_accounts_failed",
				error_description: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
				status: response.status,
			},
		};
	}
	const body = toRecord(await response.json());
	const data = Array.isArray(body.data) ? body.data : [];
	const pages: MetaPageSummary[] = [];
	for (const entry of data) {
		if (!entry || typeof entry !== "object") continue;
		const rec = entry as Record<string, unknown>;
		if (typeof rec.id !== "string" || typeof rec.access_token !== "string") continue;
		const igRaw = rec.instagram_business_account;
		const igObj =
			igRaw && typeof igRaw === "object" ? (igRaw as Record<string, unknown>) : null;
		const igId = igObj && typeof igObj.id === "string" ? igObj.id : undefined;
		pages.push({
			pageId: rec.id,
			pageName: typeof rec.name === "string" ? rec.name : rec.id,
			pageAccessToken: rec.access_token,
			...(igId === undefined ? {} : { instagramBusinessAccountId: igId }),
			...(typeof rec.category === "string" ? { category: rec.category } : {}),
		});
	}
	return { ok: true, pages };
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export const META_OAUTH_CONSTANTS = {
	AUTHORIZE_URL: META_AUTHORIZE_URL,
	TOKEN_URL: META_TOKEN_URL,
	ME_ACCOUNTS_URL: META_ME_ACCOUNTS_URL,
	GRAPH_VERSION: META_GRAPH_VERSION,
} as const;
