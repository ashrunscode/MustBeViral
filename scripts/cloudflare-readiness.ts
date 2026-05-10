import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type WranglerResult = {
	status: number;
	stdout: string;
	stderr: string;
};

const cwd = process.cwd();
const wranglerConfigPath = join(cwd, "wrangler.jsonc");
const bundledNodePath = join(
	homedir(),
	".cache",
	"codex-runtimes",
	"codex-primary-runtime",
	"dependencies",
	"node",
	"bin",
	process.platform === "win32" ? "node.exe" : "node",
);
const wranglerJsPath = join(cwd, "node_modules", "wrangler", "bin", "wrangler.js");

const wranglerCommand =
	existsSync(bundledNodePath) && existsSync(wranglerJsPath)
		? { bin: bundledNodePath, prefixArgs: [wranglerJsPath] }
		: { bin: process.platform === "win32" ? "wrangler.cmd" : "wrangler", prefixArgs: [] };

const configText = readFileSync(wranglerConfigPath, "utf8");
const expectedD1Names = uniqueMatches(configText, /"database_name"\s*:\s*"([^"]+)"/g).filter(
	(name) => name !== "mustbeviral",
);
const expectedR2Buckets = uniqueMatches(configText, /"bucket_name"\s*:\s*"([^"]+)"/g).filter(
	(name) => name !== "mustbeviral-media",
);
const expectedKvIds = uniqueMatches(configText, /"id"\s*:\s*"([0-9a-f]{32})"/gi).filter(
	(id) => !/^0+$/.test(id),
);
let exitStatus = 0;

console.log("MustBeViral Cloudflare readiness check");
console.log("Mode: read-only inventory only; no create, patch, deploy, migration, or secret writes.");
console.log("");
printConfigured("Configured remote D1 database names", expectedD1Names);
printConfigured("Configured remote R2 bucket names", expectedR2Buckets);
printConfigured("Configured remote KV namespace ids", expectedKvIds);
console.log("");

const whoami = runWrangler(["whoami"]);
printCommand("wrangler whoami", whoami);
if (whoami.status !== 0) {
	console.error("Cloudflare readiness is blocked because Wrangler is not authenticated in this shell.");
	exitStatus = 1;
} else {
	const d1 = runWrangler(["d1", "list"]);
	const kv = runWrangler(["kv", "namespace", "list"]);
	const r2 = runWrangler(["r2", "bucket", "list"]);

	printCommand("wrangler d1 list", d1);
	printCommand("wrangler kv namespace list", kv);
	printCommand("wrangler r2 bucket list", r2);

	const d1Ok = checkInventory("D1", expectedD1Names, d1);
	const kvOk = checkInventory("KV", expectedKvIds, kv);
	const r2Ok = checkInventory("R2", expectedR2Buckets, r2);
	exitStatus = d1Ok && kvOk && r2Ok ? 0 : 1;
}

process.exit(exitStatus);

function runWrangler(args: string[]): WranglerResult {
	const result = spawnSync(wranglerCommand.bin, [...wranglerCommand.prefixArgs, ...args], {
		cwd,
		encoding: "utf8",
		env: process.env,
		shell: false,
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function printConfigured(label: string, values: string[]): void {
	console.log(`${label}:`);
	if (values.length === 0) {
		console.log("  none configured");
		return;
	}
	for (const value of values) {
		console.log(`  ${value}`);
	}
}

function printCommand(label: string, result: WranglerResult): void {
	console.log("");
	console.log(`${label}: ${result.status === 0 ? "PASS" : "FAIL"}`);
	if (result.status !== 0) {
		const detail = compactOutput(result.stderr || result.stdout);
		if (detail) {
			console.log(detail);
		}
	}
}

function checkInventory(label: string, expected: string[], result: WranglerResult): boolean {
	if (result.status !== 0) {
		console.log(`${label} inventory: unknown because the read command failed`);
		return false;
	}
	const haystack = `${result.stdout}\n${result.stderr}`;
	let ok = true;
	for (const resource of expected) {
		const found = haystack.includes(resource);
		console.log(`${label} ${resource}: ${found ? "FOUND" : "MISSING"}`);
		ok = ok && found;
	}
	return ok;
}

function uniqueMatches(text: string, regex: RegExp): string[] {
	return [...new Set(Array.from(text.matchAll(regex), (match) => match[1]).filter(Boolean) as string[])];
}

function compactOutput(text: string): string {
	return text
		.replace(/\u001b\[[0-9;]*m/g, "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 8)
		.map((line) => `  ${line}`)
		.join("\n");
}
