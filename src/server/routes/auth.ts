import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbAll, dbFirst, dbRun, toJson } from "../db/sql";
import { errorEnvelope, successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { parseJsonBody } from "../http/validation";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../services/audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../services/auth/password";
import {
	createSession,
	normalizeEmail,
	revokeCurrentSession,
	type AuthContext,
} from "../services/auth/session";
import { createId } from "../utils/id";

export const authRoutes = new Hono<AppHonoContext>();

const signupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	name: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

interface UserRow extends Record<string, unknown> {
	id: string;
	email: string;
	name: string | null;
	role: "user" | "admin";
	password_hash: string;
	failed_login_attempts: number;
	locked_until: string | null;
}

authRoutes.post("/signup", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, signupSchema);
	if (!parsed.ok) {
		return parsed.response;
	}

	const email = normalizeEmail(parsed.data.email);
	const passwordErrors = validatePasswordStrength(parsed.data.password);
	if (passwordErrors.length > 0) {
		return c.json(
			errorEnvelope("WEAK_PASSWORD", "Password does not meet security requirements.", requestId, {
				errors: passwordErrors,
			}),
			400,
		);
	}

	const db = getDb(c.env);
	const existing = await dbFirst(db, "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", [email]);
	if (existing) {
		return c.json(errorEnvelope("EMAIL_IN_USE", "A user with this email already exists.", requestId), 409);
	}

	const userId = createId("user");
	const passwordHash = await hashPassword(parsed.data.password);
	await dbRun(
		db,
		`INSERT INTO users (id, email, name, role)
		VALUES (?, ?, ?, 'user')`,
		[userId, email, parsed.data.name ?? null],
	);
	await dbRun(
		db,
		`INSERT INTO password_credentials (user_id, password_hash, password_algo, password_params_json)
		VALUES (?, ?, 'pbkdf2-sha512', ?)`,
		[userId, passwordHash, toJson({ iterations: 100_000, hash: "SHA-512" })],
	);
	await createSession(c, userId);
	await writeAuditLog(db, {
		userId,
		action: "auth.signup",
		entityType: "user",
		entityId: userId,
		after: { email },
	});

	return c.json(
		successEnvelope({ user: { id: userId, email, name: parsed.data.name ?? null, role: "user" } }, requestId),
		201,
	);
});

authRoutes.post("/login", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, loginSchema);
	if (!parsed.ok) {
		return parsed.response;
	}

	const email = normalizeEmail(parsed.data.email);
	const db = getDb(c.env);
	const user = await dbFirst<UserRow>(
		db,
		`SELECT u.id, u.email, u.name, u.role, u.failed_login_attempts, u.locked_until, pc.password_hash
		FROM users u
		INNER JOIN password_credentials pc ON pc.user_id = u.id
		WHERE u.email = ? AND u.deleted_at IS NULL
		LIMIT 1`,
		[email],
	);
	if (!user) {
		return c.json(errorEnvelope("INVALID_CREDENTIALS", "Invalid email or password.", requestId), 401);
	}
	if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
		return c.json(errorEnvelope("ACCOUNT_LOCKED", "Account is temporarily locked.", requestId), 423);
	}

	const valid = await verifyPassword(parsed.data.password, user.password_hash);
	if (!valid) {
		const attempts = user.failed_login_attempts + 1;
		const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
		await dbRun(db, "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?", [
			attempts,
			lockedUntil,
			user.id,
		]);
		return c.json(errorEnvelope("INVALID_CREDENTIALS", "Invalid email or password.", requestId), 401);
	}

	await dbRun(db, "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [
		user.id,
	]);
	await createSession(c, user.id);
	await writeAuditLog(db, {
		userId: user.id,
		action: "auth.login",
		entityType: "user",
		entityId: user.id,
	});

	return c.json(successEnvelope({ user: publicUser(user) }, requestId));
});

authRoutes.post("/logout", requireAuth(), async (c) => {
	const requestId = c.get("requestId");
	await revokeCurrentSession(c);
	return c.json(successEnvelope({ loggedOut: true }, requestId));
});

authRoutes.get("/me", requireAuth(), async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth") as AuthContext;
	const workspaces = await dbAll(
		getDb(c.env),
		`SELECT w.id, w.name, w.slug, w.plan, wm.role, w.created_at
		FROM workspaces w
		INNER JOIN workspace_members wm ON wm.workspace_id = w.id
		WHERE wm.user_id = ? AND w.deleted_at IS NULL
		ORDER BY w.created_at DESC`,
		[auth.userId],
	);

	return c.json(
		successEnvelope(
			{ user: { id: auth.userId, email: auth.email, name: auth.name, role: auth.role }, workspaces },
			requestId,
		),
	);
});

function publicUser(user: UserRow): Record<string, unknown> {
	return { id: user.id, email: user.email, name: user.name, role: user.role };
}
