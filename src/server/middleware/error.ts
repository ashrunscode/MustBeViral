import type { Context } from "hono";

import { errorEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";

export function handleError(error: Error, c: Context<AppHonoContext>): Response {
	const requestId = c.get("requestId") ?? crypto.randomUUID();

	console.error(
		JSON.stringify({
			ts: new Date().toISOString(),
			level: "error",
			msg: error.message,
			requestId,
			path: c.req.path,
			stack: c.env.APP_ENV === "development" ? error.stack : undefined,
		}),
	);

	return c.json(errorEnvelope("INTERNAL_SERVER_ERROR", "Unexpected server error.", requestId), 500);
}

export function handleNotFound(c: Context<AppHonoContext>): Response {
	const requestId = c.get("requestId") ?? crypto.randomUUID();

	return c.json(errorEnvelope("NOT_FOUND", "Route not found.", requestId), 404);
}
