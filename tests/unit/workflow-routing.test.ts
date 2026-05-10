import { describe, expect, it } from "vitest";

import { buildBrandWorkflowParams } from "../../src/server/workflows/params";

describe("brand workflow routing", () => {
	it("builds tenant-scoped workflow params without undefined optional fields", () => {
		expect(
			buildBrandWorkflowParams({
				brandId: "brand_1",
				workspaceId: "ws_1",
				requestedBy: "user_1",
			}),
		).toEqual({
			brandId: "brand_1",
			workspaceId: "ws_1",
			requestedBy: "user_1",
		});
	});

	it("keeps fallback-compatible params minimal when optional values are absent", () => {
		expect(
			buildBrandWorkflowParams({
				brandId: "brand_1",
				workspaceId: null,
			}),
		).toEqual({ brandId: "brand_1" });
	});
});
