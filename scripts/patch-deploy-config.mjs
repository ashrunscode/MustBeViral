// Patches build/server/wrangler.json so it deploys to a specific env,
// since the Cloudflare Vite plugin strips env blocks from the build output
// and `wrangler deploy --env <name>` is silently a no-op against the redirected
// config. Idempotent: regenerated on every `npm run build`, so re-run before each deploy.
//
// Usage: node scripts/patch-deploy-config.mjs <staging|production>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const envName = process.argv[2];
if (envName !== "staging" && envName !== "production") {
	console.error(`patch-deploy-config: env must be "staging" or "production", got "${envName}"`);
	process.exit(2);
}

function stripJsoncComments(text) {
	// State-machine parser. Tracks in-string vs in-line-comment vs in-block-
	// comment so we never strip `/*` or `//` sequences embedded inside string
	// literals (e.g. route patterns like "staging.mustbeviral.com/*").
	let out = "";
	let i = 0;
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;
	while (i < text.length) {
		const c = text[i];
		const next = text[i + 1];
		if (inLineComment) {
			if (c === "\n") {
				inLineComment = false;
				out += c;
			}
			i += 1;
			continue;
		}
		if (inBlockComment) {
			if (c === "*" && next === "/") {
				inBlockComment = false;
				i += 2;
				continue;
			}
			i += 1;
			continue;
		}
		if (inString) {
			out += c;
			if (c === "\\" && next !== undefined) {
				out += next;
				i += 2;
				continue;
			}
			if (c === '"') {
				inString = false;
			}
			i += 1;
			continue;
		}
		if (c === '"') {
			inString = true;
			out += c;
			i += 1;
			continue;
		}
		if (c === "/" && next === "/") {
			inLineComment = true;
			i += 2;
			continue;
		}
		if (c === "/" && next === "*") {
			inBlockComment = true;
			i += 2;
			continue;
		}
		out += c;
		i += 1;
	}
	return out;
}

const rootCfgPath = resolve(repoRoot, "wrangler.jsonc");
const buildCfgPath = resolve(repoRoot, "build/server/wrangler.json");

const rootCfg = JSON.parse(stripJsoncComments(readFileSync(rootCfgPath, "utf8")));
const buildCfg = JSON.parse(readFileSync(buildCfgPath, "utf8"));

const envBlock = rootCfg.env?.[envName];
if (!envBlock) {
	console.error(`patch-deploy-config: env.${envName} block not found in wrangler.jsonc`);
	process.exit(2);
}

const baseName = rootCfg.name ?? buildCfg.name;
const scriptName = `${baseName}-${envName}`;

// Override the keys that legacy_env splits per-environment. Keep build outputs
// (main, assets dir, modules, observability) untouched.
const overrideKeys = [
	"vars",
	"d1_databases",
	"r2_buckets",
	"kv_namespaces",
	"durable_objects",
	"workflows",
	"routes",
	"queues",
	"vectorize",
	"hyperdrive",
	"services",
	"analytics_engine_datasets",
	"send_email",
	"ai",
];
for (const key of overrideKeys) {
	if (envBlock[key] !== undefined) {
		buildCfg[key] = envBlock[key];
	}
}
buildCfg.name = scriptName;

// Remove `definedEnvironments` so wrangler treats this as a single-env config
// (otherwise it expects an env block that's no longer present).
delete buildCfg.definedEnvironments;
delete buildCfg.legacy_env;

writeFileSync(buildCfgPath, JSON.stringify(buildCfg, null, 2));
console.log(`patched build/server/wrangler.json -> name=${scriptName}, env=${envName}`);
console.log(`  d1: ${buildCfg.d1_databases?.[0]?.database_id}`);
console.log(`  kv: ${buildCfg.kv_namespaces?.[0]?.id}`);
console.log(`  r2: ${buildCfg.r2_buckets?.[0]?.bucket_name}`);
console.log(`  vars.APP_ENV: ${buildCfg.vars?.APP_ENV}`);
console.log(`  vars.PUBLIC_APP_URL: ${buildCfg.vars?.PUBLIC_APP_URL}`);
