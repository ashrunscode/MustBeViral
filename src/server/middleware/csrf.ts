import { createMiddleware } from "hono/factory";
import type { Context } from "hono";

import { errorEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";

const sessionCookieName = "mbv_session";
const unsafeMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export function csrfProtection() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		if (!unsafeMethods.has(c.req.method.toUpperCase()) || !hasSessionCookie(c.req.header("Cookie"))) {
			await next();
			return;
		}

		const origin = c.req.header("Origin");
		if (origin && isAllowedOrigin(c, origin)) {
			await next();
			return;
		}

		const fetchSite = c.req.header("Sec-Fetch-Site");
		if (!origin && (fetchSite === "same-origin" || fetchSite === "same-site")) {
			await next();
			return;
		}

		const requestId = c.get("requestId") ?? crypto.randomUUID();
		return c.json(
			errorEnvelope("CSRF_BLOCKED", "Cross-site mutation requests are not allowed.", requestId),
			403,
		);
	});
}

function hasSessionCookie(cookieHeader: string | undefined): boolean {
	return cookieHeader?.split(";").some((part) => part.trim().startsWith(`${sessionCookieName}=`)) ?? false;
}

function isAllowedOrigin(c: Context<AppHonoContext>, origin: string): boolean {
	const allowed = new Set<string>([new URL(c.req.url).origin]);
	try {
		allowed.add(new URL(c.env.PUBLIC_APP_URL).origin);
	} catch {
		// Bad environment values should fail closed to the request origin.
	}
	return allowed.has(origin);
}
