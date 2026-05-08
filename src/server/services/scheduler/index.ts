export type SchedulerProviderId = "manual" | "vista_social" | "buffer";

export interface SchedulerPost {
	postId: string;
	brandId: string;
	platform: string;
	caption: string;
	scheduledAt: string;
}

export interface SchedulerResult {
	provider: SchedulerProviderId;
	status: "manual_export" | "scheduled" | "failed";
	externalId?: string;
	exportPayload?: Record<string, unknown>;
	message?: string;
}

export interface SchedulerProvider {
	id: SchedulerProviderId;
	schedule(post: SchedulerPost): Promise<SchedulerResult>;
}

export class ManualExportAdapter implements SchedulerProvider {
	readonly id = "manual" as const;

	schedule(post: SchedulerPost): Promise<SchedulerResult> {
		return Promise.resolve({
			provider: this.id,
			status: "manual_export",
			exportPayload: {
				postId: post.postId,
				brandId: post.brandId,
				platform: post.platform,
				caption: post.caption,
				scheduledAt: post.scheduledAt,
			},
		});
	}
}

export class VistaSocialAdapter implements SchedulerProvider {
	readonly id = "vista_social" as const;

	schedule(): Promise<SchedulerResult> {
		return Promise.resolve({
			provider: this.id,
			status: "failed",
			message: "Vista Social adapter is a typed skeleton until provider credentials are configured.",
		});
	}
}

export class BufferAdapter implements SchedulerProvider {
	readonly id = "buffer" as const;

	schedule(): Promise<SchedulerResult> {
		return Promise.resolve({
			provider: this.id,
			status: "failed",
			message: "Buffer adapter is a typed skeleton until provider credentials are configured.",
		});
	}
}

export function getSchedulerProvider(provider: SchedulerProviderId): SchedulerProvider {
	if (provider === "vista_social") {
		return new VistaSocialAdapter();
	}
	if (provider === "buffer") {
		return new BufferAdapter();
	}
	return new ManualExportAdapter();
}
