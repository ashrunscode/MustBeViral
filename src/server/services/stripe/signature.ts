const encoder = new TextEncoder();
const toleranceSeconds = 300;

export interface StripeSignatureVerification {
	ok: boolean;
	eventTimestamp?: number;
	reason?: string;
}

export async function verifyStripeWebhookSignature(
	payload: string,
	header: string | undefined,
	secret: string | undefined,
	nowMs = Date.now(),
): Promise<StripeSignatureVerification> {
	if (!secret) {
		return { ok: false, reason: "missing_secret" };
	}
	if (!header) {
		return { ok: false, reason: "missing_signature" };
	}

	const parsed = parseStripeHeader(header);
	if (!parsed.timestamp || parsed.signatures.length === 0) {
		return { ok: false, reason: "malformed_signature" };
	}

	const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
	if (ageSeconds > toleranceSeconds) {
		return { ok: false, reason: "timestamp_outside_tolerance", eventTimestamp: parsed.timestamp };
	}

	const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
	const ok = parsed.signatures.some((signature) => constantTimeStringEqual(signature, expected));

	return ok
		? { ok: true, eventTimestamp: parsed.timestamp }
		: { ok: false, reason: "signature_mismatch", eventTimestamp: parsed.timestamp };
}

function parseStripeHeader(header: string): { timestamp?: number; signatures: string[] } {
	const output: { timestamp?: number; signatures: string[] } = { signatures: [] };
	for (const part of header.split(",")) {
		const [key, value] = part.split("=");
		if (key === "t" && value) {
			output.timestamp = Number(value);
		}
		if (key === "v1" && value) {
			output.signatures.push(value);
		}
	}
	return output;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeStringEqual(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return diff === 0;
}
