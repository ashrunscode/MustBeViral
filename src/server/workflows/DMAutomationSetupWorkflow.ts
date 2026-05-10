import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import type { Env } from "../env";
import { writeAuditLog } from "../services/audit";
import { getBrand } from "../services/brand-operations";
import { createId } from "../utils/id";
import { type BrandWorkflowInput } from "./base";
import {
	evaluateDmRuleAction,
	type DmRuleActionPlan,
	type DmRuleWorkflowState,
	type DmWorkflowAction,
} from "./workflow-policy";

export interface DMAutomationSetupWorkflowInput extends BrandWorkflowInput {
	ruleId?: string;
	action?: DmWorkflowAction;
}

interface DmRuleValidationResult {
	ok: true;
	brandId: string;
	workspaceId: string;
	rule: DmRuleWorkflowState;
	workflowRunId: string;
	requestedBy: string | null;
	action: DmWorkflowAction;
}

interface DmRuleValidationFailure {
	ok: false;
	errorCode: "BRAND_NOT_FOUND" | "DM_RULE_NOT_FOUND";
	message: string;
	brandId: string;
	ruleId: string;
}

type DmRuleValidation = DmRuleValidationResult | DmRuleValidationFailure;

interface DmApplyResult {
	status: "complete" | "waiting_manual";
	workflowRunId: string;
	ruleId: string;
	nextStatus: "approved" | "active" | null;
	outboundExecution: "none";
	browserBot: false;
}

interface DmRuleWorkflowRow extends Record<string, unknown> {
	id: string;
	brand_id: string;
	requires_approval: number;
	status: string;
}

export class DMAutomationSetupWorkflow extends WorkflowEntrypoint<
	Env,
	DMAutomationSetupWorkflowInput
> {
	override async run(
		event: Readonly<WorkflowEvent<DMAutomationSetupWorkflowInput>>,
		step: WorkflowStep,
	): Promise<unknown> {
		const { brandId, ruleId } = event.payload;
		if (!brandId) {
			return {
				workflow: "DMAutomationSetupWorkflow",
				status: "skipped",
				reason: "missing_brandId",
				instanceId: event.instanceId,
			};
		}
		if (!ruleId) {
			return {
				workflow: "DMAutomationSetupWorkflow",
				status: "skipped",
				reason: "missing_ruleId",
				instanceId: event.instanceId,
			};
		}

		const validation: DmRuleValidation = await step.do(
			"validate-brand-and-rule",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<DmRuleValidation> => {
				const db = getDb(this.env);
				const brand = await getBrand(db, brandId);
				if (!brand) {
					return {
						ok: false,
						errorCode: "BRAND_NOT_FOUND",
						message: "Brand was not found.",
						brandId,
						ruleId,
					};
				}
				const rule = await dbFirst<DmRuleWorkflowRow>(
					db,
					`SELECT id, brand_id, requires_approval, status
					FROM dm_rules
					WHERE id = ? AND brand_id = ?
					LIMIT 1`,
					[ruleId, brand.id],
				);
				if (!rule) {
					return {
						ok: false,
						errorCode: "DM_RULE_NOT_FOUND",
						message: "DM rule was not found for this brand.",
						brandId: brand.id,
						ruleId,
					};
				}
				return {
					ok: true,
					brandId: brand.id,
					workspaceId: brand.workspace_id,
					rule: toDmRuleWorkflowState(rule),
					workflowRunId: createId("workflow"),
					requestedBy: event.payload.requestedBy ?? null,
					action: event.payload.action ?? "validate",
				};
			},
		);

		if (!validation.ok) {
			return {
				workflow: "DMAutomationSetupWorkflow",
				status: "failed",
				instanceId: event.instanceId,
				errorCode: validation.errorCode,
				message: validation.message,
				brandId: validation.brandId,
				ruleId: validation.ruleId,
			};
		}

		const plan: DmRuleActionPlan = await step.do(
			"plan-safe-dm-rule-action",
			(): Promise<DmRuleActionPlan> =>
				Promise.resolve(evaluateDmRuleAction(validation.rule, validation.action)),
		);

		const applied: DmApplyResult = await step.do(
			"apply-rule-state-without-execution",
			{ retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
			async (): Promise<DmApplyResult> => {
				const db = getDb(this.env);
				if (plan.nextStatus && validation.rule.status !== plan.nextStatus) {
					await dbRun(
						db,
						"UPDATE dm_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND brand_id = ?",
						[plan.nextStatus, validation.rule.id, validation.brandId],
					);
				}
				await writeAuditLog(db, {
					workspaceId: validation.workspaceId,
					brandId: validation.brandId,
					userId: validation.requestedBy,
					action: plan.auditAction,
					entityType: "dm_rule",
					entityId: validation.rule.id,
					before: { status: validation.rule.status },
					after: {
						status: plan.nextStatus ?? validation.rule.status,
						reason: plan.reason,
						outboundExecution: plan.outboundExecution,
						browserBot: plan.browserBot,
					},
				});
				await dbRun(
					db,
					`INSERT OR REPLACE INTO workflow_runs (
						id, external_workflow_id, brand_id, workspace_id, workflow_name, status, progress,
						input_json, output_json
					) VALUES (?, ?, ?, ?, 'DMAutomationSetupWorkflow', ?, 100, ?, ?)`,
					[
						validation.workflowRunId,
						event.instanceId,
						validation.brandId,
						validation.workspaceId,
						plan.workflowStatus,
						toJson({
							brandId: validation.brandId,
							ruleId: validation.rule.id,
							action: validation.action,
							requestedBy: validation.requestedBy,
						}),
						toJson({
							ruleId: validation.rule.id,
							nextStatus: plan.nextStatus,
							reason: plan.reason,
							outboundExecution: plan.outboundExecution,
							browserBot: plan.browserBot,
						}),
					],
				);
				return {
					status: plan.workflowStatus,
					workflowRunId: validation.workflowRunId,
					ruleId: validation.rule.id,
					nextStatus: plan.nextStatus,
					outboundExecution: plan.outboundExecution,
					browserBot: plan.browserBot,
				};
			},
		);

		return {
			workflow: "DMAutomationSetupWorkflow",
			status: applied.status,
			instanceId: event.instanceId,
			workflowRunId: applied.workflowRunId,
			ruleId: applied.ruleId,
			nextStatus: applied.nextStatus,
			outboundExecution: applied.outboundExecution,
			browserBot: applied.browserBot,
		};
	}
}

function toDmRuleWorkflowState(row: DmRuleWorkflowRow): DmRuleWorkflowState {
	return {
		id: row.id,
		brand_id: row.brand_id,
		requires_approval: row.requires_approval,
		status: row.status,
	};
}
