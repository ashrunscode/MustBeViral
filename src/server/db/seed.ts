import { getDb } from "./client";
import type { Env } from "../env";

export async function seedDevelopmentData(env: Env): Promise<void> {
	if (env.APP_ENV !== "development") {
		throw new Error("Development seed can only run when APP_ENV=development.");
	}

	const db = getDb(env);
	await db
		.prepare(
			`INSERT OR IGNORE INTO users (id, email, name, role)
			 VALUES ('usr_dev_owner', 'owner@example.com', 'Dev Owner', 'admin')`,
		)
		.run();
}
