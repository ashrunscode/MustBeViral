import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("project scaffold", () => {
	it("preserves the build source-of-truth documents", () => {
		const root = process.cwd();

		expect(existsSync(join(root, "docs/system-dna/PRODUCT_DNA.md"))).toBe(true);
		expect(existsSync(join(root, "audit/MASTER_AUDIT_REPORT.md"))).toBe(true);
		expect(existsSync(join(root, "final-strategy/00_FINAL_EXECUTIVE_VERDICT.md"))).toBe(
			true,
		);
	});
});
