// Site checks. Static checks always run. Live checks run when a base URL is given:
//   node scripts/check-site.mjs                      static only
//   node scripts/check-site.mjs http://127.0.0.1:8787  static + live (writes one test sign-up)
// Live checks against a real host add a sign-up with a mustbeviral-check+... address.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL ${msg}`); };
const pass = (msg) => console.log(`ok   ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// ---------- Static ----------
const files = walk(ROOT).filter((f) => /\.(html|js|css|txt|xml)$/.test(f));
const pages = files.filter((f) => f.endsWith(".html"));

// Nobody behind the company is named on a page. The names to block live in a
// local, gitignored file (one per line), because this repository is public.
const NAMES_FILE = new URL("./private-names.txt", import.meta.url);
let PERSONAL = null;
try {
  const names = readFileSync(NAMES_FILE, "utf8").split(/\r?\n/).map((n) => n.trim()).filter((n) => n && !n.startsWith("#"));
  if (names.length) PERSONAL = new RegExp(`\\b(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
} catch { /* no local list */ }
if (!PERSONAL) console.log("warn scripts/private-names.txt is missing, so pages are not checked for personal names");
// Voice: words that read as machine copy (from the brand voice rules).
const SLOP = /\b(seamless(ly)?|unlock|elevate|leverage|delve|game[- ]changer|synergy|furthermore|moreover|revolutioni[sz]e)\b/i;
// Truth: no claims of customers, testimonials or numbers we don't have.
const CLAIMS = /\b(testimonial|trusted by|\d[\d,]*\+?\s*(customers|businesses|brands|users)|guaranteed)\b/i;

for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = relative(ROOT, f);
  if (PERSONAL && PERSONAL.test(text)) fail(`${rel}: names a person behind the company (${text.match(PERSONAL)[0]})`);
  if (SLOP.test(text)) fail(`${rel}: voice word "${text.match(SLOP)[0]}"`);
  if (CLAIMS.test(text)) fail(`${rel}: unproven claim "${text.match(CLAIMS)[0]}"`);
}
pass(`${files.length} files scanned for names, voice words and claims`);

for (const f of pages) {
  const html = readFileSync(f, "utf8");
  const rel = relative(ROOT, f);
  if (!/<html lang="en">/.test(html)) fail(`${rel}: missing lang`);
  if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(`${rel}: missing title`);
  if (!/name="viewport"/.test(html)) fail(`${rel}: missing viewport`);
  if (!html.includes("Axiom &amp; Alloy, Inc.")) fail(`${rel}: does not name Axiom & Alloy, Inc.`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) fail(`${rel}: inline script (blocked by the CSP)`);
  if (/\sstyle="/.test(html)) fail(`${rel}: inline style attribute (blocked by the CSP)`);
  if (/https?:\/\/(?!mustbeviral\.com|www\.sitemaps\.org)[a-z0-9.-]+\.[a-z]{2,}/i.test(html.replace(/mailto:[^"]+/g, "")))
    fail(`${rel}: loads or links an outside host`);
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const path = m[1];
    const target = path.endsWith("/") ? join(ROOT, path, "index.html") : join(ROOT, path);
    try { statSync(target); } catch { fail(`${rel}: broken link ${path}`); }
  }
}
pass(`${pages.length} pages checked for title, viewport, company name, CSP and links`);

// ---------- Live ----------
const base = process.argv[2];
if (base) {
  const u = (p) => new URL(p, base).toString();
  const host = new URL(base).host;

  const get = async (p, status, test) => {
    const r = await fetch(u(p), { redirect: "manual" });
    if (r.status !== status) return fail(`GET ${p} -> ${r.status}, wanted ${status}`);
    const body = await r.text();
    const why = test ? test(r, body) : null;
    why ? fail(`GET ${p}: ${why}`) : pass(`GET ${p} -> ${status}`);
  };

  await get("/", 200, (r, b) =>
    !r.headers.get("content-security-policy") ? "no CSP header"
    : !b.includes("Good reels out.") ? "hero copy missing"
    : host !== "mustbeviral.com" && r.headers.get("x-robots-tag") !== "noindex, nofollow" ? "preview host not noindex"
    : null);
  await get("/privacy/", 200, (_, b) => (b.includes("Axiom &amp; Alloy, Inc.") ? null : "company missing"));
  await get("/terms/", 200, (_, b) => (b.includes("State of Texas") ? null : "governing law missing"));
  await get("/thanks/", 200);
  await get("/styles.css", 200);
  await get("/fonts/bricolage-grotesque-latin-wght-v5.woff2", 200, (r) =>
    (r.headers.get("cache-control") ?? "").includes("immutable") ? null : "font not cached long");
  await get("/no-such-page", 404, (_, b) => (b.includes("That page isn't here.") ? null : "wrong 404 page"));
  await get("/api/health", 200);

  const stamp = Date.now();
  const email = `mustbeviral-check+${stamp}@example.com`;
  const post = (body, headers) => fetch(u("/api/waitlist"), { method: "POST", body, headers, redirect: "manual" });

  let r = await post(JSON.stringify({ email, business_type: "retail", business_name: "Site check", note: "automated check, safe to delete" }),
    { "Content-Type": "application/json", Accept: "application/json", Origin: new URL(base).origin });
  r.status === 200 ? pass(`POST JSON sign-up -> 200 (${email})`) : fail(`POST JSON sign-up -> ${r.status}`);

  r = await post(new URLSearchParams({ email, business_type: "other", city: "Houston" }).toString(),
    { "Content-Type": "application/x-www-form-urlencoded", Origin: new URL(base).origin });
  r.status === 303 && (r.headers.get("location") ?? "").endsWith("/thanks/")
    ? pass("POST form sign-up (same email) -> 303 /thanks/") : fail(`POST form -> ${r.status} ${r.headers.get("location")}`);

  r = await post(JSON.stringify({ email: "nope" }), { "Content-Type": "application/json", Accept: "application/json" });
  r.status === 400 ? pass("POST invalid -> 400") : fail(`POST invalid -> ${r.status}`);

  r = await post(JSON.stringify({ email, business_type: "other" }), { "Content-Type": "application/json", Accept: "application/json", Origin: "https://evil.example" });
  r.status === 403 ? pass("POST cross-site -> 403") : fail(`POST cross-site -> ${r.status}`);
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
