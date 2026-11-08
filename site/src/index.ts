import { LIMITS, parseSignUp, storeSignUp, type FieldErrors } from "./waitlist";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  WAITLIST_LIMIT?: RateLimit;
  CANONICAL_HOST: string;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

/** Hosts other than the canonical one are previews and stay out of search. */
function isPreviewHost(host: string, env: Env): boolean {
  return host !== env.CANONICAL_HOST;
}

function withHeaders(
  res: Response,
  host: string,
  env: Env,
  path: string,
): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if (isPreviewHost(host, env))
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (path.startsWith("/fonts/"))
    out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return out;
}

function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function wantsJson(req: Request): boolean {
  return (req.headers.get("Accept") ?? "").includes("application/json");
}

/** A same-origin check. Browsers send Origin on POST; tools like curl do not. */
function originAllowed(req: Request, url: URL): boolean {
  const origin = req.headers.get("Origin");
  if (origin === null) return true;
  if (origin === "null") return false;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

/** The no-JavaScript error page. It only ever shows our own fixed messages. */
function errorPage(status: number, messages: string[]): Response {
  const items = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>That didn't go through · Must Be Viral</title><link rel="stylesheet" href="/styles.css"></head><body class="plain"><main class="wrap narrow"><p class="eyebrow">Waitlist</p><h1 class="h-page">That didn't go through.</h1><ul class="errors">${items}</ul><p><a class="btn" href="/#join">Go back to the form</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readFields(
  req: Request,
): Promise<Record<string, unknown> | null> {
  const type = req.headers.get("Content-Type") ?? "";
  const text = await req.text();
  if (text.length > LIMITS.body) return null;
  if (type.includes("application/json")) {
    try {
      const v: unknown = JSON.parse(text);
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return null;
}

export async function handleWaitlist(
  req: Request,
  env: Env,
  url: URL,
  now = new Date(),
  id = crypto.randomUUID(),
): Promise<Response> {
  const asJson = wantsJson(req);

  if (req.method !== "POST")
    return json({ ok: false, error: "method" }, 405, { Allow: "POST" });
  if (!originAllowed(req, url))
    return json({ ok: false, error: "origin" }, 403);

  const declared = Number(req.headers.get("Content-Length") ?? "0");
  if (declared > LIMITS.body) {
    return asJson
      ? json({ ok: false, error: "too_large" }, 413)
      : errorPage(413, [
          "The form was too large. Shorten the note and try again.",
        ]);
  }

  if (env.WAITLIST_LIMIT) {
    const key = req.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.WAITLIST_LIMIT.limit({ key });
    if (!success) {
      return asJson
        ? json({ ok: false, error: "rate_limited" }, 429, {
            "Retry-After": "60",
          })
        : errorPage(429, [
            "Too many tries in a minute. Wait a minute and send it again.",
          ]);
    }
  }

  const fields = await readFields(req);
  if (!fields) {
    return asJson
      ? json({ ok: false, error: "bad_request" }, 400)
      : errorPage(400, ["The form came through empty or garbled. Try again."]);
  }

  const parsed = parseSignUp(fields);
  const done = () =>
    asJson
      ? json({ ok: true })
      : Response.redirect(new URL("/thanks/", url).toString(), 303);

  // Bots get the same answer as people, and nothing is stored.
  if (parsed.kind === "bot") return done();

  if (parsed.kind === "invalid") {
    const errors: FieldErrors = parsed.errors;
    return asJson
      ? json({ ok: false, error: "invalid", fields: errors }, 400)
      : errorPage(400, Object.values(errors));
  }

  try {
    await storeSignUp(env.DB, parsed.signUp, url.hostname, now, id);
  } catch (err) {
    // Log the failure, never the submitted values.
    console.error(
      "waitlist_store_failed",
      err instanceof Error ? err.name : "unknown",
    );
    return asJson
      ? json({ ok: false, error: "server" }, 500)
      : errorPage(500, [
          "Something broke on our side. Your details were not saved. Please try again in a minute.",
        ]);
  }

  return done();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // One address: www goes to the bare domain.
    if (url.hostname === `www.${env.CANONICAL_HOST}`) {
      url.hostname = env.CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/waitlist") {
      return withHeaders(
        await handleWaitlist(req, env, url),
        url.hostname,
        env,
        url.pathname,
      );
    }
    if (url.pathname === "/api/health") {
      return withHeaders(json({ ok: true }), url.hostname, env, url.pathname);
    }
    if (url.pathname.startsWith("/api/")) {
      return withHeaders(
        json({ ok: false, error: "not_found" }, 404),
        url.hostname,
        env,
        url.pathname,
      );
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return withHeaders(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        }),
        url.hostname,
        env,
        url.pathname,
      );
    }

    const res = await env.ASSETS.fetch(req);
    return withHeaders(res, url.hostname, env, url.pathname);
  },
} satisfies ExportedHandler<Env>;
