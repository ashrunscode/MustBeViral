import { describe, expect, it } from "vitest";

import {
	buildScheduledPostWritePlan,
	evaluateApprovedPostsForScheduling,
	evaluateDmRuleAction,
	resolveSchedulingProviderDecision,
	type WorkflowSchedulablePost,
} from "../../src/server/workflows/workflow-policy";

const approvedPost: WorkflowSchedulablePost = {
	id: "post_approved",
	brand_id: "brand_1",
	platform: "instagram",
	status: "approved",
	caption: "Approved caption",
	scheduled_at: "2026-05-08T10:00:00.000Z",
};

describe("workflow policy helpers", () => {
	it("blocks scheduling when a requested post is not approved", () => {
		const evaluation = evaluateApprovedPostsForScheduling(
			[{ ...approvedPost, id: "post_pending", status: "pending_approval" }],
			["post_pending"],
		);

		expect(evaluation).toEqual({
			ok: false,
			errorCode: "POST_NOT_APPROVED",
			postId: "post_pending",
			message: "Only approved posts can be scheduled or exported.",
		});
	});

	it("builds a manual export write plan that marks the post scheduled after approval", () => {
		const evaluation = evaluateApprovedPostsForScheduling([approvedPost], [approvedPost.id]);
		expect(evaluation.ok).toBe(true);
		if (!evaluation.ok) {
			throw new Error(evaluation.message);
		}
		const post = evaluation.posts[0];
		expect(post).toBeDefined();
		if (!post) {
			throw new Error("expected approved post");
		}

		const plan = buildScheduledPostWritePlan({
			post,
			scheduledPostId: "sched_1",
			scheduledAt: approvedPost.scheduled_at ?? "2026-05-08T10:00:00.000Z",
			result: {
				provider: "manual",
				status: "manual_export",
				exportPayload: { postId: approvedPost.id },
			},
		});

		expect(plan).toMatchObject({
			postId: approvedPost.id,
			provider: "manual",
			status: "manual_export",
			nextPostStatus: "scheduled",
		});
		expect(JSON.parse(plan.metadataJson)).toEqual({ postId: approvedPost.id });
	});

	it("defers non-manual providers instead of calling external scheduler adapters", () => {
		const decision = resolveSchedulingProviderDecision("buffer");

		expect(decision).toEqual({
			ok: false,
			provider: "buffer",
			workflowStatus: "waiting_manual",
			reason: "provider_deferred",
			message: "buffer scheduling is deferred in Phase 1; use manual export.",
		});
	});

	it("does not execute DMs when activation is requested before approval", () => {
		const plan = evaluateDmRuleAction(
			{ id: "rule_1", brand_id: "brand_1", requires_approval: 1, status: "pending_approval" },
			"activate",
		);

		expect(plan).toEqual({
			workflowStatus: "waiting_manual",
			nextStatus: null,
			auditAction: "dm_rule.workflow_activation_deferred",
			reason: "approval_required",
			outboundExecution: "none",
			browserBot: false,
		});
	});

	it("plans approved DM activation as an audited state change only", () => {
		const plan = evaluateDmRuleAction(
			{ id: "rule_1", brand_id: "brand_1", requires_approval: 1, status: "approved" },
			"activate",
		);

		expect(plan).toEqual({
			workflowStatus: "complete",
			nextStatus: "active",
			auditAction: "dm_rule.workflow_activated",
			reason: null,
			outboundExecution: "none",
			browserBot: false,
		});
	});
});
