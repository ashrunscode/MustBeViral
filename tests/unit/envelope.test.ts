import { describe, expect, it } from "vitest";

import { errorEnvelope, successEnvelope } from "../../src/server/http/envelope";

describe("API envelopes", () => {
	it("creates a standard success envelope", () => {
		const envelope = successEnvelope({ ok: true }, "req_test");

		expect(envelope.success).toBe(true);
		expect(envelope.data.ok).toBe(true);
		expect(envelope.meta.requestId).toBe("req_test");
		expect(envelope.meta.timestamp).toEqual(expect.any(String));
	});

	it("creates a standard error envelope", () => {
		const envelope = errorEnvelope("VALIDATION_ERROR", "Invalid input.", "req_test", {
			field: "email",
		});

		expect(envelope.success).toBe(false);
		expect(envelope.error.code).toBe("VALIDATION_ERROR");
		expect(envelope.error.requestId).toBe("req_test");
		expect(envelope.error.details).toEqual({ field: "email" });
	});
});
