const compactUuidLength = 32;

export function createId(prefix: string): string {
	const compact = crypto.randomUUID().replaceAll("-", "");
	return `${prefix}_${compact.slice(0, compactUuidLength)}`;
}

export function nowIso(): string {
	return new Date().toISOString();
}

export function addDaysIso(days: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString();
}
