import { describe, expect, it } from "vitest";

import { getSchedulerProvider } from "../../src/server/services/scheduler";

describe("scheduler adapters", () => {
	it("manual export adapter returns an export payload without external credentials", async () => {
		const provider = getSchedulerProvider("manual");
		const result = await provider.schedule({
			postId: "post_1",
			brandId: "brand_1",
			platform: "instagram",
			caption: "Approved caption",
			scheduledAt: "2026-05-08T00:00:00.000Z",
		});

		expect(result.status).toBe("manual_export");
		expect(result.exportPayload).toMatchObject({ postId: "post_1", platform: "instagram" });
	});

	it("external adapters fail closed until configured", async () => {
		const provider = getSchedulerProvider("buffer");
		const result = await provider.schedule({
			postId: "post_1",
			brandId: "brand_1",
			platform: "x",
			caption: "Approved caption",
			scheduledAt: "2026-05-08T00:00:00.000Z",
		});

		expect(result.status).toBe("failed");
		expect(result.message).toContain("typed skeleton");
	});
});
