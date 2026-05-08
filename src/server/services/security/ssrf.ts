export interface SafeUrlResult {
	ok: true;
	url: string;
	hostname: string;
}

export interface UnsafeUrlResult {
	ok: false;
	code: "INVALID_URL" | "UNSUPPORTED_PROTOCOL" | "PRIVATE_HOST" | "BLOCKED_HOST";
	message: string;
}

const blockedHosts = new Set([
	"localhost",
	"metadata.google.internal",
	"metadata",
	"instance-data",
	"169.254.169.254",
]);

export function normalizeScanUrl(input: string): SafeUrlResult | UnsafeUrlResult {
	const trimmed = input.trim();
	let parsed: URL;

	try {
		parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
	} catch {
		return { ok: false, code: "INVALID_URL", message: "URL is not valid." };
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, code: "UNSUPPORTED_PROTOCOL", message: "Only http and https URLs are allowed." };
	}

	parsed.username = "";
	parsed.password = "";
	parsed.hash = "";

	const hostname = parsed.hostname.toLowerCase();
	if (blockedHosts.has(hostname) || hostname.endsWith(".localhost")) {
		return { ok: false, code: "BLOCKED_HOST", message: "Internal metadata and localhost hosts are blocked." };
	}

	if (isPrivateHostname(hostname)) {
		return { ok: false, code: "PRIVATE_HOST", message: "Private and loopback network targets are blocked." };
	}

	return { ok: true, url: parsed.toString(), hostname };
}

function isPrivateHostname(hostname: string): boolean {
	const normalized = hostname.replace(/^\[|\]$/g, "");
	if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) {
		return true;
	}
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
		return true;
	}

	const octets = normalized.split(".").map((part) => Number(part));
	if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
		return false;
	}

	const [first = 0, second = 0] = octets;
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 198 && (second === 18 || second === 19)) ||
		first >= 224
	);
}
