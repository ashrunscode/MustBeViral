/**
 * LinkedIn OAuth 2.0 helpers (pure functions, no I/O outside `fetch`).
 *
 * Flow: Sign In with LinkedIn using OpenID Connect + Marketing Developer
 * Platform scopes for posting and community management.
 *
 * Scopes used:
 *   openid profile           - resolve user id + name via /userinfo
 *   w_member_social          - publish on member's own behalf
 *   w_organization_social    - publish on behalf of a managed organization
 *   r_organization_social    - read organization's social actions (comments)
 *   rw_organization_admin    - manage organization (page admin)
 *
 * Member vs Organization: the adapter determines which URN to post against
 * by what the user authorised. For Phase B we collect both scope groups so
 * the same connection can post to personal AND company pages.
 */

const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_ORGS_URL =
	"https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName)))";
const LINKEDIN_API_VERSION = "202406";

export const DEFAULT_LINKEDIN_SCOPES = [
	"openid",
	"profile",
	"email",
	"w_member_social",
	"w_organization_social",
	"r_organization_social",
	"rw_organization_admin",
] as const;

export interface BuildAuthorizeUrlInput {
	state: string;
	clientId: string;
	redirectUri: string;
	scopes?: readonly string[];
}

export function buildLinkedInAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		state: input.state,
		scope: (input.scopes ?? DEFAULT_LINKEDIN_SCOPES).join(" "),
	});
	return `${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`;
}

export interface ExchangeCodeInput {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export interface LinkedInTokenBundle {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number; // seconds
	refreshTokenExpiresIn?: number; // seconds (LinkedIn returns this on first issuance)
	scope: string;
	tokenType: string;
	idToken?: string;
}

export interface LinkedInOAuthError {
	error: string;
	error_description?: string | undefined;
	status?: number | undefined;
}

export type LinkedInTokenResult =
	| { ok: true; bundle: LinkedInTokenBundle }
	| { ok: false; error: LinkedInOAuthError };

export async function exchangeLinkedInCode(input: ExchangeCodeInput): Promise<LinkedInTokenResult> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: input.code,
		client_id: input.clientId,
		client_secret: input.clientSecret,
		redirect_uri: input.redirectUri,
	});
	const response = await fetch(LINKEDIN_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: body.toString(),
	});
	return parseTokenResponse(response);
}

export interface RefreshTokenInput {
	refreshToken: string;
	clientId: string;
	clientSecret: string;
}

export async function refreshLinkedInToken(input: RefreshTokenInput): Promise<LinkedInTokenResult> {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: input.refreshToken,
		client_id: input.clientId,
		client_secret: input.clientSecret,
	});
	const response = await fetch(LINKEDIN_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: body.toString(),
	});
	return parseTokenResponse(response);
}

async function parseTokenResponse(response: Response): Promise<LinkedInTokenResult> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return {
			ok: false,
			error: {
				error: "invalid_token_response",
				error_description: `LinkedIn token endpoint returned non-JSON (status ${String(response.status)})`,
				status: response.status,
			},
		};
	}
	if (!response.ok) {
		const obj = toRecord(payload);
		return {
			ok: false,
			error: {
				error: typeof obj.error === "string" ? obj.error : "linkedin_oauth_error",
				error_description:
					typeof obj.error_description === "string" ? obj.error_description : undefined,
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
			...(typeof obj.refresh_token_expires_in === "number"
				? { refreshTokenExpiresIn: obj.refresh_token_expires_in }
				: {}),
			scope: typeof obj.scope === "string" ? obj.scope : "",
			tokenType: typeof obj.token_type === "string" ? obj.token_type : "Bearer",
			...(typeof obj.id_token === "string" ? { idToken: obj.id_token } : {}),
		},
	};
}

export interface LinkedInUserInfo {
	sub: string; // OIDC subject id; LinkedIn formats as their internal id
	name?: string;
	givenName?: string;
	familyName?: string;
	email?: string;
	memberUrn: string; // urn:li:person:<sub>
}

export type LinkedInUserInfoResult =
	| { ok: true; userInfo: LinkedInUserInfo }
	| { ok: false; error: LinkedInOAuthError };

export async function resolveLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfoResult> {
	const response = await fetch(LINKEDIN_USERINFO_URL, {
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
	if (typeof body.sub !== "string") {
		return {
			ok: false,
			error: { error: "userinfo_malformed", error_description: "missing sub field" },
		};
	}
	return {
		ok: true,
		userInfo: {
			sub: body.sub,
			...(typeof body.name === "string" ? { name: body.name } : {}),
			...(typeof body.given_name === "string" ? { givenName: body.given_name } : {}),
			...(typeof body.family_name === "string" ? { familyName: body.family_name } : {}),
			...(typeof body.email === "string" ? { email: body.email } : {}),
			memberUrn: `urn:li:person:${body.sub}`,
		},
	};
}

export interface LinkedInOrganizationSummary {
	id: string;
	urn: string; // urn:li:organization:<id>
	localizedName: string;
}

export interface LinkedInOrgsResult {
	ok: boolean;
	organizations: LinkedInOrganizationSummary[];
	error?: LinkedInOAuthError;
}

export async function resolveAdministeredLinkedInOrgs(
	accessToken: string,
): Promise<LinkedInOrgsResult> {
	const response = await fetch(LINKEDIN_ORGS_URL, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"LinkedIn-Version": LINKEDIN_API_VERSION,
			"X-Restli-Protocol-Version": "2.0.0",
		},
	});
	if (!response.ok) {
		// Many LinkedIn personal accounts have no admin'd orgs; that's not an error.
		// We surface non-200 as `ok: true, organizations: []` so the connection still
		// completes for member-only posting.
		return { ok: true, organizations: [] };
	}
	const body = toRecord(await response.json());
	const elements = Array.isArray(body.elements) ? body.elements : [];
	const orgs: LinkedInOrganizationSummary[] = [];
	for (const element of elements) {
		if (!element || typeof element !== "object") continue;
		const elObj = element as Record<string, unknown>;
		const orgRaw = elObj["organization~"];
		if (!orgRaw || typeof orgRaw !== "object") continue;
		const organization = orgRaw as Record<string, unknown>;
		if (typeof organization.id !== "string") continue;
		orgs.push({
			id: organization.id,
			urn: `urn:li:organization:${organization.id}`,
			localizedName:
				typeof organization.localizedName === "string" ? organization.localizedName : "Unknown",
		});
	}
	return { ok: true, organizations: orgs };
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export const LINKEDIN_OAUTH_CONSTANTS = {
	AUTHORIZE_URL: LINKEDIN_AUTHORIZE_URL,
	TOKEN_URL: LINKEDIN_TOKEN_URL,
	USERINFO_URL: LINKEDIN_USERINFO_URL,
	API_VERSION: LINKEDIN_API_VERSION,
} as const;
