import { DurableObject } from "cloudflare:workers";

import type { Env } from "../env";

export type MarketingAgentStatus =
	| "idle"
	| "onboarding"
	| "generating"
	| "waiting_approval"
	| "scheduling"
	| "reporting"
	| "paused"
	| "error";

export interface MarketingAgentState {
	brandId?: string;
	workspaceId?: string;
	status: MarketingAgentStatus;
	paused: boolean;
	pendingApprovalsCount: number;
	scheduledThisWeekCount: number;
	lastRunAt?: string;
	errors: Array<{ at: string; message: string; severity: "info" | "warning" | "error" }>;
	activity: Array<{ at: string; action: string; status: "started" | "complete" | "failed" }>;
}

const initialState: MarketingAgentState = {
	status: "idle",
	paused: false,
	pendingApprovalsCount: 0,
	scheduledThisWeekCount: 0,
	errors: [],
	activity: [],
};

export class MarketingAgent extends DurableObject<Env> {
	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/state") || url.pathname.endsWith("/command-center")) {
			const state = await this.readState();
			return Response.json({ success: true, data: state });
		}

		if (url.pathname.endsWith("/pause") && request.method === "POST") {
			return Response.json({ success: true, data: await this.pauseAgent() });
		}

		if (url.pathname.endsWith("/resume") && request.method === "POST") {
			return Response.json({ success: true, data: await this.resumeAgent() });
		}

		if (url.pathname.endsWith("/activity")) {
			const state = await this.readState();
			return Response.json({ success: true, data: state.activity });
		}

		if (url.pathname.endsWith("/onboarding/start") && request.method === "POST") {
			const payload = (await request.json().catch(() => ({}))) as {
				brandId?: string;
				workspaceId?: string;
			};
			const patch: Partial<MarketingAgentState> = {
				status: "onboarding",
				paused: false,
				lastRunAt: new Date().toISOString(),
				activity: [
					{
						at: new Date().toISOString(),
						action: "startOnboardingScan",
						status: "started",
					},
				],
			};
			if (payload.brandId) {
				patch.brandId = payload.brandId;
			}
			if (payload.workspaceId) {
				patch.workspaceId = payload.workspaceId;
			}
			const state = await this.updateState(patch);
			return Response.json({ success: true, data: state });
		}

		return Response.json(
			{
				success: false,
				error: {
					code: "NOT_IMPLEMENTED",
					message: "MarketingAgent callable bridge is not implemented yet.",
				},
			},
			{ status: 501 },
		);
	}

	private async readState(): Promise<MarketingAgentState> {
		return (await this.ctx.storage.get<MarketingAgentState>("state")) ?? initialState;
	}

	private async pauseAgent(): Promise<MarketingAgentState> {
		return this.updateState({
			status: "paused",
			paused: true,
			activity: [{ at: new Date().toISOString(), action: "pauseAgent", status: "complete" }],
		});
	}

	private async resumeAgent(): Promise<MarketingAgentState> {
		return this.updateState({
			status: "idle",
			paused: false,
			activity: [{ at: new Date().toISOString(), action: "resumeAgent", status: "complete" }],
		});
	}

	private async updateState(patch: Partial<MarketingAgentState>): Promise<MarketingAgentState> {
		const current = await this.readState();
		const next: MarketingAgentState = {
			...current,
			...patch,
			errors: [...current.errors, ...(patch.errors ?? [])].slice(-20),
			activity: [...(patch.activity ?? []), ...current.activity].slice(0, 50),
		};
		await this.ctx.storage.put("state", next);
		return next;
	}
}
