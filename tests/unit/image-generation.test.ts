import { describe, expect, it } from "vitest";

import {
	buildCreativeR2Key,
	buildWorkersAiImageInput,
	mockPngBase64,
	normaliseWorkersAiImageOutput,
} from "../../src/server/services/model-router-image";

describe("image generation helpers", () => {
	it("builds multipart input for verified Flux 2 Workers AI models", () => {
		const input = buildWorkersAiImageInput(
			"@cf/black-forest-labs/flux-2-klein-9b",
			"Create a product photo",
		);

		expect("multipart" in input).toBe(true);
		if ("multipart" in input) {
			expect(input.multipart.contentType).toContain("multipart/form-data");
			expect(input.multipart.body).toBeTruthy();
		}
	});

	it("builds prompt and steps input for Flux 1 Schnell", () => {
		const input = buildWorkersAiImageInput(
			"@cf/black-forest-labs/flux-1-schnell",
			"Create a social post image",
		);

		expect(input).toEqual({ prompt: "Create a social post image", steps: 4 });
	});

	it("normalises Workers AI base64 image output to PNG bytes", async () => {
		const image = await normaliseWorkersAiImageOutput({ image: mockPngBase64() });

		expect(image.contentType).toBe("image/png");
		expect(Array.from(image.bytes.slice(0, 4))).toEqual([137, 80, 78, 71]);
		expect(image.imageBase64).toBe(mockPngBase64());
	});

	it("builds tenant-scoped R2 keys without path traversal", () => {
		expect(buildCreativeR2Key("brand_abc123", "creative_def456")).toBe(
			"creatives/brand_abc123/creative_def456.png",
		);
		expect(() => buildCreativeR2Key("../brand", "creative_def456")).toThrow(
			"invalid_creative_r2_key_segment",
		);
	});
});
