const encoder = new TextEncoder();
const defaultIterations = 120_000;
const hashBytes = 64;
const saltBytes = 16;

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}

	return diff === 0;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-512", salt: saltBuffer, iterations },
		key,
		hashBytes * 8,
	);
	return new Uint8Array(bits);
}

export function validatePasswordStrength(password: string): string[] {
	const errors: string[] = [];

	if (password.length < 12) {
		errors.push("Password must be at least 12 characters.");
	}
	if (password.length > 128) {
		errors.push("Password must be 128 characters or fewer.");
	}
	if (!/[a-z]/.test(password)) {
		errors.push("Password must include a lowercase letter.");
	}
	if (!/[A-Z]/.test(password)) {
		errors.push("Password must include an uppercase letter.");
	}
	if (!/[0-9]/.test(password)) {
		errors.push("Password must include a number.");
	}

	return errors;
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
	const hash = await derive(password, salt, defaultIterations);
	return `pbkdf2-sha512$${defaultIterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const parts = storedHash.split("$");
	if (parts.length !== 4 || parts[0] !== "pbkdf2-sha512") {
		return false;
	}

	const iterations = Number(parts[1]);
	const saltPart = parts[2];
	const hashPart = parts[3];
	if (!Number.isInteger(iterations) || iterations < 10_000 || !saltPart || !hashPart) {
		return false;
	}

	const expected = base64ToBytes(hashPart);
	const actual = await derive(password, base64ToBytes(saltPart), iterations);
	return constantTimeEqual(actual, expected);
}
