import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { getDb } from "../../db/client";
import { dbFirst, dbRun } from "../../db/sql";
import type { AppHonoContext } from "../../http/types";
import { createId } from "../../utils/id";

const encoder = new TextEncoder();
const sessionCookie = "mbv_session";
const sessionDays = 30;

export interface AuthContext {
	userId: string;
	sessionId: string;
	role: "user" | "admin";
	email: string;
	name: string | null;
}

interface SessionAuthRow extends Record<string, unknown> {
	session_id: string;
	user_id: string;
	email: string;
	name: string | null;
	role: "user" | "admin";
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function createSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", encoder.encode(token));
	return bytesToHex(new Uint8Array(hash));
}

export async function createSession(
	c: Context<AppHonoContext>,
	userId: string,
): Promise<{ sessionId: string; token: string }> {
	const db = getDb(c.env);
	const token = createSessionToken();
	const sessionId = createId("sess");
	const hashedToken = await hashToken(token);
	const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();

	await dbRun(
		db,
		`INSERT INTO sessions (
			id, user_id, hashed_token, expires_at, ip_hash, user_agent
		) VALUES (?, ?, ?, ?, ?, ?)`,
		[
			sessionId,
			userId,
			hashedToken,
			expiresAt,
			c.req.header("CF-Connecting-IP") ?? null,
			c.req.header("User-Agent") ?? null,
		],
	);

	setCookie(c, sessionCookie, token, {
		httpOnly: true,
		secure: c.env.APP_ENV !== "development",
		sameSite: "Lax",
		path: "/",
		maxAge: sessionDays * 24 * 60 * 60,
	});

	return { sessionId, token };
}

export async function authenticateRequest(c: Context<AppHonoContext>): Promise<AuthContext | null> {
	const token = getCookie(c, sessionCookie) ?? readBearerToken(c.req.header("Authorization"));
	if (!token) {
		return null;
	}

	const db = getDb(c.env);
	const hashedToken = await hashToken(token);
	const row = await dbFirst<SessionAuthRow>(
		db,
		`SELECT
			s.id AS session_id,
			u.id AS user_id,
			u.email,
			u.name,
			u.role
		FROM sessions s
		INNER JOIN users u ON u.id = s.user_id
		WHERE s.hashed_token = ?
			AND s.revoked_at IS NULL
			AND s.expires_at > ?
			AND u.deleted_at IS NULL
		LIMIT 1`,
		[hashedToken, new Date().toISOString()],
	);

	if (!row) {
		return null;
	}

	await dbRun(db, "UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?", [
		row.session_id,
	]);

	return {
		userId: row.user_id,
		sessionId: row.session_id,
		role: row.role,
		email: row.email,
		name: row.name,
	};
}

export async function revokeCurrentSession(c: Context<AppHonoContext>): Promise<void> {
	const auth = c.get("auth");
	if (auth) {
		await dbRun(getDb(c.env), "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [
			auth.sessionId,
		]);
	}

	deleteCookie(c, sessionCookie, { path: "/" });
}

function readBearerToken(authorization: string | undefined): string | null {
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
}
