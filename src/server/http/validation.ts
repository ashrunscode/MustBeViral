import type { Context } from "hono";
import type { ZodSchema } from "zod";

import { errorEnvelope } from "./envelope";
import type { AppHonoContext } from "./types";

export async function parseJsonBody<T>(
	c: Context<AppHonoContext>,
	schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
	const requestId = c.get("requestId");

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return {
			ok: false,
			response: c.json(errorEnvelope("INVALID_JSON", "Request body must be valid JSON.", requestId), 400),
		};
	}

	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		return {
			ok: false,
			response: c.json(
				errorEnvelope("VALIDATION_ERROR", "Request validation failed.", requestId, parsed.error.flatten()),
				400,
			),
		};
	}

	return { ok: true, data: parsed.data };
}
