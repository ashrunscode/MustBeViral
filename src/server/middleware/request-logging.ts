import { createMiddleware } from "hono/factory";

import type { AppHonoContext } from "../http/types";

export function requestLogging() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = crypto.randomUUID();
		const startedAt = Date.now();
		c.set("requestId", requestId);

		try {
			await next();
		} finally {
			console.log(
				JSON.stringify({
					ts: new Date().toISOString(),
					level: "info",
					msg: "request",
					requestId,
					method: c.req.method,
					path: c.req.path,
					status: c.res.status,
					durationMs: Date.now() - startedAt,
				}),
			);
		}
	});
}
