import { createMiddleware } from "hono/factory";

import type { AppHonoContext } from "../http/types";

const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com",
	"img-src 'self' data: blob: https://imagedelivery.net",
	"connect-src 'self' https://api.stripe.com https://gateway.ai.cloudflare.com",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

export function securityHeaders() {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		await next();

		// Defence-in-depth headers applied to every response. The Worker is the
		// only origin behind mustbeviral.com so headers can be uniform; routes
		// that need to relax CSP (rare) should override after this middleware.
		c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		c.header("X-Frame-Options", "DENY");
		c.header("X-Content-Type-Options", "nosniff");
		c.header("Referrer-Policy", "strict-origin-when-cross-origin");
		c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
		c.header("Content-Security-Policy", csp);
		c.header("Cross-Origin-Opener-Policy", "same-origin");
		c.header("Cross-Origin-Resource-Policy", "same-origin");
	});
}
