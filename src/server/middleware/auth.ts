import { createMiddleware } from "hono/factory";

import { errorEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { authenticateRequest, type AuthContext } from "../services/auth/session";

export type { AuthContext };

export function requireAuth() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = c.get("requestId");
		const auth = await authenticateRequest(c);

		if (!auth) {
			return c.json(errorEnvelope("UNAUTHORIZED", "Authentication is required.", requestId), 401);
		}

		c.set("auth", auth);
		await next();
	});
}
