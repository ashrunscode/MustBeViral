const resourceCommands = [
	{
		name: "D1 database",
		command: ["wrangler", "d1", "create", "mustbeviral"],
		patch: "d1_databases[0].database_id",
	},
	{
		name: "R2 media bucket",
		command: ["wrangler", "r2", "bucket", "create", "mustbeviral-media"],
		patch: "r2_buckets[0].bucket_name",
	},
	{
		name: "KV cache namespace",
		command: ["wrangler", "kv", "namespace", "create", "CACHE"],
		patch: "kv_namespaces[0].id",
	},
] as const;

const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");

if (!dryRun && !apply) {
	console.log("Use --dry-run to print planned commands. Real provisioning requires --apply.");
	process.exitCode = 1;
} else {
	for (const resource of resourceCommands) {
		console.log(`${dryRun ? "DRY RUN" : "APPLY"} ${resource.name}`);
		console.log(`  command: ${resource.command.join(" ")}`);
		console.log(`  patch: ${resource.patch}`);
	}

	if (apply) {
		throw new Error("Cloudflare provisioning is intentionally not implemented in this safe pass.");
	}
}
