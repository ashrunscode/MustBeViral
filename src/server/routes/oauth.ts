/**
 * OAuth callback router. Mounted at `/api/oauth/*`.
 *
 * Callbacks are global routes (no session cookie) — the platform redirects
 * the user's browser to us with `?code=...&state=...`. We don't have a
 * session, so the signed `state` parameter is the authentication: it carries
 * `{brandId, platform, csrfNonce, ts}` and is verified before any D1 write.
 *
 * Per-platform handlers all follow the same shape:
 *  1. Flag-gate (`isPlatformEnabled(env, platform, "publish")`).
 *  2. Verify `state` HMAC + replay window.
 *  3. Exchange `code` for tokens via the platform's token endpoint.
 *  4. Resolve account metadata (user info, organizations).
 *  5. Encrypt + write tokens to KV; insert metadata row in `social_account_tokens`.
 *  6. Upsert `brand_social_profiles` row to `connected` for the same brand+platform.
 *  7. 302 redirect to `/app/brands/<brandId>/connections?connected=<platform>`.
 *
 * Errors return 4xx with an envelope or 302 to the connections page with
 * `?error=<code>` so the UI can surface what went wrong without leaking
 * details.
 */

import { Hono } from "hono";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import type { AppHonoContext } from "../http/types";
import { isPlatformEnabled } from "../services/platforms/feature-flags";
import {
	exchangeLinkedInCode,
	resolveAdministeredLinkedInOrgs,
	resolveLinkedInUserInfo,
} from "../services/platforms/linkedin-oauth";
import { verifyState } from "../services/platforms/oauth-state";
import { writeToken } from "../services/platforms/token-storage";
import type { StoredTokenPayload } from "../services/platforms/types";
import { exchangeXCode, resolveXUserInfo } from "../services/platforms/x-oauth";
import { createId } from "../utils/id";

export const oauthRoutes = new Hono<AppHonoContext>();

oauthRoutes.get("/linkedin/callback", async (c) => {
	const env = c.env;
	if (!isPlatformEnabled(env, "linkedin", "publish")) {
		return c.json({ success: false, error: { code: "FEATURE_DISABLED" } }, 503);
	}
	const code = c.req.query("code");
	const state = c.req.query("state");
	const errorParam = c.req.query("error");
	if (errorParam) {
		// User denied or LinkedIn returned an OAuth-level error before the callback.
		return c.redirect(buildConnectionsRedirect(undefined, "linkedin", errorParam), 302);
	}
	if (!code || !state) {
		return c.json({ success: false, error: { code: "OAUTH_CALLBACK_INVALID" } }, 400);
	}
	const stateResult = await verifyState(env, state);
	if (!stateResult.ok) {
		return c.json(
			{ success: false, error: { code: "OAUTH_STATE_INVALID", reason: stateResult.reason } },
			400,
		);
	}
	if (stateResult.payload.platform !== "linkedin") {
		return c.json(
			{ success: false, error: { code: "OAUTH_PLATFORM_MISMATCH" } },
			400,
		);
	}
	const brandId = stateResult.payload.brandId;
	const clientId = env.LINKEDIN_CLIENT_ID;
	const clientSecret = env.LINKEDIN_CLIENT_SECRET;
	const redirectUri = env.LINKEDIN_REDIRECT_URI ?? defaultRedirectUri(env, "linkedin");
	if (!clientId || !clientSecret) {
		return c.redirect(
			buildConnectionsRedirect(brandId, "linkedin", "missing_app_credentials"),
			302,
		);
	}
	const tokenResult = await exchangeLinkedInCode({
		code,
		clientId,
		clientSecret,
		redirectUri,
	});
	if (!tokenResult.ok) {
		return c.redirect(buildConnectionsRedirect(brandId, "linkedin", tokenResult.error.error), 302);
	}
	const userInfo = await resolveLinkedInUserInfo(tokenResult.bundle.accessToken);
	if (!userInfo.ok) {
		return c.redirect(
			buildConnectionsRedirect(brandId, "linkedin", "userinfo_failed"),
			302,
		);
	}
	const orgs = await resolveAdministeredLinkedInOrgs(tokenResult.bundle.accessToken);
	// Encrypt token payload into KV; D1 holds only metadata.
	const externalAccountId = userInfo.userInfo.sub;
	const payload: StoredTokenPayload = {
		access_token: tokenResult.bundle.accessToken,
		...(tokenResult.bundle.refreshToken
			? { refresh_token: tokenResult.bundle.refreshToken }
			: {}),
		token_type: tokenResult.bundle.tokenType,
		issued_at: new Date().toISOString(),
		platform_metadata: {
			member_urn: userInfo.userInfo.memberUrn,
			user_name: userInfo.userInfo.name ?? null,
			email: userInfo.userInfo.email ?? null,
			organizations: orgs.organizations,
			id_token_present: Boolean(tokenResult.bundle.idToken),
		},
	};
	let tokenKvKey: string;
	try {
		tokenKvKey = await writeToken(env, {
			brandId,
			platform: "linkedin",
			externalAccountId,
			payload,
		});
	} catch (err) {
		const reason =
			err instanceof Error && "code" in err && typeof err.code === "string"
				? err.code
				: "token_write_failed";
		return c.redirect(buildConnectionsRedirect(brandId, "linkedin", reason), 302);
	}
	const accessExpiresAt = new Date(
		Date.now() + tokenResult.bundle.expiresIn * 1000,
	).toISOString();
	const refreshExpiresAt = tokenResult.bundle.refreshTokenExpiresIn
		? new Date(Date.now() + tokenResult.bundle.refreshTokenExpiresIn * 1000).toISOString()
		: null;
	const db = getDb(env);
	const tokenRowId = createId("sat"); // social_account_token id
	const accountLabel = userInfo.userInfo.name ?? userInfo.userInfo.email ?? externalAccountId;
	const scopeCsv = tokenResult.bundle.scope.split(/[\s,]+/).filter(Boolean).join(",");
	await dbRun(
		db,
		`INSERT INTO social_account_tokens (
			id, brand_id, platform, external_account_id, account_label, scope_csv,
			token_kv_key, access_token_expires_at, refresh_token_expires_at, status
		) VALUES (?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, 'active')
		ON CONFLICT(brand_id, platform, external_account_id) DO UPDATE SET
			account_label = excluded.account_label,
			scope_csv = excluded.scope_csv,
			token_kv_key = excluded.token_kv_key,
			access_token_expires_at = excluded.access_token_expires_at,
			refresh_token_expires_at = excluded.refresh_token_expires_at,
			status = 'active',
			updated_at = CURRENT_TIMESTAMP`,
		[
			tokenRowId,
			brandId,
			externalAccountId,
			accountLabel,
			scopeCsv,
			tokenKvKey,
			accessExpiresAt,
			refreshExpiresAt,
		],
	);
	// Upsert the public-display row in brand_social_profiles. The UNIQUE
	// constraint there is (brand_id, platform, handle); when first connecting
	// from a personal account, handle = sub (member id). Organisations get
	// their own rows on a later page-selection step (not in Phase B).
	await dbRun(
		db,
		`INSERT INTO brand_social_profiles (
			id, brand_id, platform, handle, profile_url, connected_status, metadata_json
		) VALUES (?, ?, 'linkedin', ?, ?, 'connected', ?)
		ON CONFLICT(brand_id, platform, handle) DO UPDATE SET
			profile_url = excluded.profile_url,
			connected_status = 'connected',
			metadata_json = excluded.metadata_json,
			updated_at = CURRENT_TIMESTAMP`,
		[
			createId("bsp"),
			brandId,
			externalAccountId,
			`https://www.linkedin.com/in/${externalAccountId}`,
			toJson({
				member_urn: userInfo.userInfo.memberUrn,
				name: userInfo.userInfo.name ?? null,
				social_account_token_id: tokenRowId,
				organizations: orgs.organizations.map((o) => ({ id: o.id, name: o.localizedName })),
			}),
		],
	);
	await dbRun(
		db,
		`INSERT INTO audit_logs (
			id, workspace_id, brand_id, user_id, action, entity_type, entity_id,
			before_json, after_json, metadata_json
		) VALUES (?, NULL, ?, NULL, 'platform.linkedin.connected', 'social_account_token', ?, NULL, ?, '{}')`,
		[
			createId("audit"),
			brandId,
			tokenRowId,
			toJson({
				externalAccountId,
				scopeCsv,
				organizationsCount: orgs.organizations.length,
				redirectUri,
			}),
		],
	);
	// Look up the workspace_id from brands so the audit log carries it.
	const brandRow = await dbFirst<{ workspace_id: string }>(
		db,
		`SELECT workspace_id FROM brands WHERE id = ? LIMIT 1`,
		[brandId],
	);
	if (brandRow?.workspace_id) {
		await dbRun(
			db,
			`UPDATE audit_logs SET workspace_id = ? WHERE entity_id = ? AND action = 'platform.linkedin.connected'`,
			[brandRow.workspace_id, tokenRowId],
		);
	}
	return c.redirect(
		stateResult.payload.redirectAfter ?? buildConnectionsRedirect(brandId, "linkedin"),
		302,
	);
});

// X (Twitter) OAuth 2.0 callback. PKCE — code_verifier was embedded in the
// signed state at start; the callback exchanges code + verifier for tokens.
oauthRoutes.get("/x/callback", async (c) => {
	const env = c.env;
	if (!isPlatformEnabled(env, "x", "publish")) {
		return c.json({ success: false, error: { code: "FEATURE_DISABLED" } }, 503);
	}
	const code = c.req.query("code");
	const state = c.req.query("state");
	const errorParam = c.req.query("error");
	if (errorParam) {
		return c.redirect(buildConnectionsRedirect(undefined, "x", errorParam), 302);
	}
	if (!code || !state) {
		return c.json({ success: false, error: { code: "OAUTH_CALLBACK_INVALID" } }, 400);
	}
	const stateResult = await verifyState(env, state);
	if (!stateResult.ok) {
		return c.json(
			{ success: false, error: { code: "OAUTH_STATE_INVALID", reason: stateResult.reason } },
			400,
		);
	}
	if (stateResult.payload.platform !== "x") {
		return c.json({ success: false, error: { code: "OAUTH_PLATFORM_MISMATCH" } }, 400);
	}
	const brandId = stateResult.payload.brandId;
	const codeVerifier = stateResult.payload.codeVerifier;
	if (!codeVerifier) {
		return c.redirect(buildConnectionsRedirect(brandId, "x", "pkce_verifier_missing"), 302);
	}
	const clientId = env.X_CLIENT_ID;
	const redirectUri = env.X_REDIRECT_URI ?? defaultRedirectUri(env, "x");
	if (!clientId) {
		return c.redirect(buildConnectionsRedirect(brandId, "x", "missing_app_credentials"), 302);
	}
	const tokenResult = await exchangeXCode({
		code,
		codeVerifier,
		clientId,
		...(env.X_CLIENT_SECRET ? { clientSecret: env.X_CLIENT_SECRET } : {}),
		redirectUri,
	});
	if (!tokenResult.ok) {
		return c.redirect(buildConnectionsRedirect(brandId, "x", tokenResult.error.error), 302);
	}
	const userInfo = await resolveXUserInfo(tokenResult.bundle.accessToken);
	if (!userInfo.ok) {
		return c.redirect(buildConnectionsRedirect(brandId, "x", "userinfo_failed"), 302);
	}
	const externalAccountId = userInfo.userInfo.id;
	const payload: StoredTokenPayload = {
		access_token: tokenResult.bundle.accessToken,
		...(tokenResult.bundle.refreshToken
			? { refresh_token: tokenResult.bundle.refreshToken }
			: {}),
		token_type: tokenResult.bundle.tokenType,
		issued_at: new Date().toISOString(),
		platform_metadata: {
			username: userInfo.userInfo.username,
			name: userInfo.userInfo.name ?? null,
		},
	};
	let tokenKvKey: string;
	try {
		tokenKvKey = await writeToken(env, {
			brandId,
			platform: "x",
			externalAccountId,
			payload,
		});
	} catch (err) {
		const reason =
			err instanceof Error && "code" in err && typeof err.code === "string"
				? err.code
				: "token_write_failed";
		return c.redirect(buildConnectionsRedirect(brandId, "x", reason), 302);
	}
	const accessExpiresAt = new Date(
		Date.now() + tokenResult.bundle.expiresIn * 1000,
	).toISOString();
	const db = getDb(env);
	const tokenRowId = createId("sat");
	const accountLabel =
		userInfo.userInfo.name ?? userInfo.userInfo.username ?? externalAccountId;
	const scopeCsv = tokenResult.bundle.scope.split(/[\s,]+/).filter(Boolean).join(",");
	await dbRun(
		db,
		`INSERT INTO social_account_tokens (
			id, brand_id, platform, external_account_id, account_label, scope_csv,
			token_kv_key, access_token_expires_at, refresh_token_expires_at, status
		) VALUES (?, ?, 'x', ?, ?, ?, ?, ?, NULL, 'active')
		ON CONFLICT(brand_id, platform, external_account_id) DO UPDATE SET
			account_label = excluded.account_label,
			scope_csv = excluded.scope_csv,
			token_kv_key = excluded.token_kv_key,
			access_token_expires_at = excluded.access_token_expires_at,
			status = 'active',
			updated_at = CURRENT_TIMESTAMP`,
		[
			tokenRowId,
			brandId,
			externalAccountId,
			accountLabel,
			scopeCsv,
			tokenKvKey,
			accessExpiresAt,
		],
	);
	await dbRun(
		db,
		`INSERT INTO brand_social_profiles (
			id, brand_id, platform, handle, profile_url, connected_status, metadata_json
		) VALUES (?, ?, 'x', ?, ?, 'connected', ?)
		ON CONFLICT(brand_id, platform, handle) DO UPDATE SET
			profile_url = excluded.profile_url,
			connected_status = 'connected',
			metadata_json = excluded.metadata_json,
			updated_at = CURRENT_TIMESTAMP`,
		[
			createId("bsp"),
			brandId,
			userInfo.userInfo.username,
			`https://x.com/${userInfo.userInfo.username}`,
			toJson({
				external_account_id: externalAccountId,
				name: userInfo.userInfo.name ?? null,
				social_account_token_id: tokenRowId,
			}),
		],
	);
	const brandRow = await dbFirst<{ workspace_id: string }>(
		db,
		`SELECT workspace_id FROM brands WHERE id = ? LIMIT 1`,
		[brandId],
	);
	await dbRun(
		db,
		`INSERT INTO audit_logs (
			id, workspace_id, brand_id, user_id, action, entity_type, entity_id,
			before_json, after_json, metadata_json
		) VALUES (?, ?, ?, NULL, 'platform.x.connected', 'social_account_token', ?, NULL, ?, '{}')`,
		[
			createId("audit"),
			brandRow?.workspace_id ?? null,
			brandId,
			tokenRowId,
			toJson({
				externalAccountId,
				username: userInfo.userInfo.username,
				scopeCsv,
				redirectUri,
			}),
		],
	);
	return c.redirect(
		stateResult.payload.redirectAfter ?? buildConnectionsRedirect(brandId, "x"),
		302,
	);
});

function buildConnectionsRedirect(
	brandId: string | undefined,
	platform: string,
	error?: string,
): string {
	const path = brandId
		? `/app/brands/${brandId}/connections`
		: "/app/connections";
	const params = new URLSearchParams();
	if (error) {
		params.set("error", error);
	} else {
		params.set("connected", platform);
	}
	return `${path}?${params.toString()}`;
}

function defaultRedirectUri(env: AppHonoContext["Bindings"], platform: string): string {
	const base = env.PUBLIC_APP_URL ?? "https://mustbeviral.com";
	return `${base}/api/oauth/${platform}/callback`;
}
