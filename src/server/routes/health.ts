import { Hono } from "hono";

import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";

export const healthRoutes = new Hono<AppHonoContext>();

healthRoutes.get("/health", (c) => {
	return c.json(
		successEnvelope(
			{
				name: "mustbeviral",
				status: "ok",
				environment: c.env.APP_ENV,
				schedulerProvider: c.env.DEFAULT_SCHEDULER_PROVIDER,
			},
			c.get("requestId"),
		),
	);
});
