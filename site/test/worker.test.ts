import { describe, expect, it } from "vitest";
import worker, { handleWaitlist, type Env } from "../src/index";
import { parseSignUp } from "../src/waitlist";

type Call = { sql: string; params: unknown[] };

function fakeDb(opts: { fail?: boolean } = {}) {
  const calls: Call[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (opts.fail) throw new Error("D1_ERROR: boom");
              calls.push({ sql, params });
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as D1Database, calls };
}

function env(extra: Partial<Env> = {}, db = fakeDb().db): Env {
  return {
    ASSETS: {
      fetch: async () =>
        new Response("<html>asset</html>", {
          headers: { "Content-Type": "text/html" },
        }),
    } as unknown as Fetcher,
    DB: db,
    CANONICAL_HOST: "mustbeviral.com",
    ...extra,
  };
}

const URL_NEXT = new URL("https://next.mustbeviral.com/api/waitlist");

function post(body: string, headers: Record<string, string>) {
  return new Request(URL_NEXT, { method: "POST", body, headers });
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const good = {
  email: "Owner@Example.com ",
  business_type: "food",
  business_name: "Corner Cafe",
  city: "Houston",
};

describe("parseSignUp", () => {
  it("accepts a good sign-up and normalises the email", () => {
    const r = parseSignUp(good);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.signUp.email).toBe("Owner@Example.com");
    expect(r.signUp.emailNorm).toBe("owner@example.com");
    expect(r.signUp.note).toBeNull();
  });

  it("flags a missing email and an unknown business type", () => {
    const r = parseSignUp({ email: "", business_type: "bank" });
    expect(r.kind).toBe("invalid");
    if (r.kind !== "invalid") return;
    expect(Object.keys(r.errors).sort()).toEqual(["business_type", "email"]);
  });

  it("rejects a malformed email", () => {
    const r = parseSignUp({ ...good, email: "not an email" });
    expect(r.kind).toBe("invalid");
  });

  it("treats a filled honeypot as a bot", () => {
    expect(parseSignUp({ ...good, company_site: "http://spam" }).kind).toBe(
      "bot",
    );
  });

  it("accepts every listed kind of business", () => {
    for (const t of ["food", "beauty", "fitness", "retail", "services", "laundromat", "other"]) {
      expect(parseSignUp({ ...good, business_type: t }).kind).toBe("ok");
    }
  });

  it("rejects an over-long note", () => {
    const r = parseSignUp({ ...good, note: "x".repeat(1001) });
    expect(r.kind).toBe("invalid");
  });

  it("strips control characters and drops unsafe utm values", () => {
    const r = parseSignUp({
      ...good,
      city: "Hous\u0000ton",
      utm_source: "instagram",
      utm_campaign: "<script>",
    });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.signUp.city).toBe("Houston");
    expect(r.signUp.utmSource).toBe("instagram");
    expect(r.signUp.utmCampaign).toBeNull();
  });
});

describe("handleWaitlist", () => {
  it("stores a form post and redirects to /thanks/", async () => {
    const { db, calls } = fakeDb();
    const res = await handleWaitlist(
      post(form(good), {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://next.mustbeviral.com",
      }),
      env({}, db),
      URL_NEXT,
      new Date("2026-11-08T12:00:00Z"),
      "id-1",
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(
      "https://next.mustbeviral.com/thanks/",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual([
      "id-1",
      "Owner@Example.com",
      "owner@example.com",
      "Corner Cafe",
      "food",
      "Houston",
      null,
      null,
      null,
      "next.mustbeviral.com",
      "2026-11-08T12:00:00.000Z",
    ]);
  });

  it("answers JSON when asked", async () => {
    const res = await handleWaitlist(
      post(JSON.stringify(good), {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      env(),
      URL_NEXT,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns field errors as JSON", async () => {
    const res = await handleWaitlist(
      post(JSON.stringify({ email: "x" }), {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      env(),
      URL_NEXT,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(body.fields).sort()).toEqual(["business_type", "email"]);
  });

  it("refuses a cross-site post", async () => {
    const { db, calls } = fakeDb();
    const res = await handleWaitlist(
      post(form(good), {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      }),
      env({}, db),
      URL_NEXT,
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("answers a bot like a person and stores nothing", async () => {
    const { db, calls } = fakeDb();
    const res = await handleWaitlist(
      post(JSON.stringify({ ...good, company_site: "x" }), {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      env({}, db),
      URL_NEXT,
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("returns 429 when the rate limit says no", async () => {
    const limiter = {
      limit: async () => ({ success: false }),
    } as unknown as RateLimit;
    const res = await handleWaitlist(
      post(JSON.stringify(good), {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      env({ WAITLIST_LIMIT: limiter }),
      URL_NEXT,
    );
    expect(res.status).toBe(429);
  });

  it("refuses a body over 8 KB", async () => {
    const res = await handleWaitlist(
      post(JSON.stringify({ ...good, note: "x".repeat(9000) }), {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      env(),
      URL_NEXT,
    );
    expect(res.status).toBe(400);
  });

  it("does not leak the submitted values when the database fails", async () => {
    const res = await handleWaitlist(
      post(form(good), { "Content-Type": "application/x-www-form-urlencoded" }),
      env({}, fakeDb({ fail: true }).db),
      URL_NEXT,
    );
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).not.toContain("Corner Cafe");
    expect(html).not.toContain("example.com");
  });

  it("only takes POST", async () => {
    const res = await handleWaitlist(new Request(URL_NEXT), env(), URL_NEXT);
    expect(res.status).toBe(405);
  });
});

describe("fetch", () => {
  it("redirects www to the bare domain", async () => {
    const res = await worker.fetch(
      new Request("https://www.mustbeviral.com/privacy/?a=1"),
      env(),
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "https://mustbeviral.com/privacy/?a=1",
    );
  });

  it("marks preview hosts noindex and adds security headers", async () => {
    const res = await worker.fetch(
      new Request("https://next.mustbeviral.com/"),
      env(),
    );
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("lets the canonical host be indexed", async () => {
    const res = await worker.fetch(
      new Request("https://mustbeviral.com/"),
      env(),
    );
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("refuses other methods on pages", async () => {
    const res = await worker.fetch(
      new Request("https://mustbeviral.com/", { method: "PUT" }),
      env(),
    );
    expect(res.status).toBe(405);
  });

  it("returns JSON 404 for unknown API paths", async () => {
    const res = await worker.fetch(
      new Request("https://mustbeviral.com/api/nope"),
      env(),
    );
    expect(res.status).toBe(404);
  });
});
