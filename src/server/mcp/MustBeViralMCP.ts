import { DurableObject } from "cloudflare:workers";

import type { Env } from "../env";

export class MustBeViralMCP extends DurableObject<Env> {
	override fetch(): Response {
		return Response.json(
			{
				success: false,
				error: {
					code: "NOT_IMPLEMENTED",
					message: "Read-only MCP server is reserved for a later build phase.",
				},
			},
			{ status: 501 },
		);
	}
}
