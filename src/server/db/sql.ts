export type SqlValue = string | number | boolean | null;
export type SqlBindings = readonly SqlValue[];

export async function dbFirst<T extends Record<string, unknown>>(
	db: D1Database,
	sql: string,
	bindings: SqlBindings = [],
): Promise<T | null> {
	return db.prepare(sql).bind(...bindings).first<T>();
}

export async function dbAll<T extends Record<string, unknown>>(
	db: D1Database,
	sql: string,
	bindings: SqlBindings = [],
): Promise<T[]> {
	const result = await db.prepare(sql).bind(...bindings).all<T>();
	return result.results ?? [];
}

export async function dbRun(
	db: D1Database,
	sql: string,
	bindings: SqlBindings = [],
): Promise<D1Result> {
	return db.prepare(sql).bind(...bindings).run();
}

export function toJson(value: unknown): string {
	return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}
