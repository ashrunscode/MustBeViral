import type { SchedulerProviderId, SchedulerResult } from "../services/scheduler";

export interface WorkflowSchedulablePost {
	id: string;
	brand_id: string;
	platform: string;
	status: string;
	caption: string;
	scheduled_at: string | null;
}

export type SchedulingProviderDecision =
	| { ok: true; provider: "manual" }
	| {
			ok: false;
			provider: Exclude<SchedulerProviderId, "manual">;
			workflowStatus: "waiting_manual";
			reason: "provider_deferred";
			message: string;
		};

export type SchedulingPostEvaluation =
	| { ok: true; posts: WorkflowSchedulablePost[] }
	| {
			ok: false;
			errorCode: "POST_NOT_FOUND" | "POST_NOT_APPROVED";
			postId: string;
			message: string;
		};

export interface ScheduledPostWritePlan {
	scheduledPostId: string;
	postId: string;
	provider: SchedulerProviderId;
	externalId: string | null;
	status: "manual_export" | "scheduled" | "failed";
	scheduledAt: string;
	failureReason: string | null;
	metadataJson: string;
	nextPostStatus: "scheduled";
}

export interface DmRuleWorkflowState {
	id: string;
	brand_id: string;
	requires_approval: number;
	status: string;
}

export type DmWorkflowAction = "validate" | "approve" | "activate";

export interface DmRuleActionPlan {
	workflowStatus: "complete" | "waiting_manual";
	nextStatus: "approved" | "active" | null;
	auditAction:
		| "dm_rule.workflow_validated"
		| "dm_rule.workflow_approved"
		| "dm_rule.workflow_activated"
		| "dm_rule.workflow_activation_deferred";
	reason: "approval_required" | null;
	outboundExecution: "none";
	browserBot: false;
}

export function resolveSchedulingProviderDecision(
	provider: SchedulerProviderId | undefined,
): SchedulingProviderDecision {
	const selected = provider ?? "manual";
	if (selected === "manual") {
		return { ok: true, provider: selected };
	}
	return {
		ok: false,
		provider: selected,
		workflowStatus: "waiting_manual",
		reason: "provider_deferred",
		message: `${selected} scheduling is deferred in Phase 1; use manual export.`,
	};
}

export function evaluateApprovedPostsForScheduling(
	posts: readonly WorkflowSchedulablePost[],
	requestedPostIds: readonly string[],
): SchedulingPostEvaluation {
	const byId = new Map(posts.map((post) => [post.id, post]));
	const approved: WorkflowSchedulablePost[] = [];
	for (const postId of requestedPostIds) {
		const post = byId.get(postId);
		if (!post) {
			return {
				ok: false,
				errorCode: "POST_NOT_FOUND",
				postId,
				message: "Content post was not found for this brand.",
			};
		}
		if (post.status !== "approved") {
			return {
				ok: false,
				errorCode: "POST_NOT_APPROVED",
				postId,
				message: "Only approved posts can be scheduled or exported.",
			};
		}
		approved.push(post);
	}
	return { ok: true, posts: approved };
}

export function buildScheduledPostWritePlan(input: {
	post: WorkflowSchedulablePost;
	scheduledPostId: string;
	scheduledAt: string;
	result: SchedulerResult;
}): ScheduledPostWritePlan {
	return {
		scheduledPostId: input.scheduledPostId,
		postId: input.post.id,
		provider: input.result.provider,
		externalId: input.result.externalId ?? null,
		status: input.result.status,
		scheduledAt: input.scheduledAt,
		failureReason: input.result.message ?? null,
		metadataJson: JSON.stringify(input.result.exportPayload ?? {}),
		nextPostStatus: "scheduled",
	};
}

export function evaluateDmRuleAction(
	rule: DmRuleWorkflowState,
	action: DmWorkflowAction | undefined,
): DmRuleActionPlan {
	const selected = action ?? "validate";
	if (selected === "approve") {
		return {
			workflowStatus: "complete",
			nextStatus: "approved",
			auditAction: "dm_rule.workflow_approved",
			reason: null,
			outboundExecution: "none",
			browserBot: false,
		};
	}
	if (selected === "activate") {
		if (rule.status === "approved" || rule.status === "active") {
			return {
				workflowStatus: "complete",
				nextStatus: "active",
				auditAction: "dm_rule.workflow_activated",
				reason: null,
				outboundExecution: "none",
				browserBot: false,
			};
		}
		return {
			workflowStatus: "waiting_manual",
			nextStatus: null,
			auditAction: "dm_rule.workflow_activation_deferred",
			reason: "approval_required",
			outboundExecution: "none",
			browserBot: false,
		};
	}
	return {
		workflowStatus:
			rule.requires_approval === 1 && rule.status === "pending_approval"
				? "waiting_manual"
				: "complete",
		nextStatus: null,
		auditAction: "dm_rule.workflow_validated",
		reason:
			rule.requires_approval === 1 && rule.status === "pending_approval"
				? "approval_required"
				: null,
		outboundExecution: "none",
		browserBot: false,
	};
}
